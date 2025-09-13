use crate::flow::engine::ExecutionContext;
use crate::flow::types::{ExecutionResult, Node};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use pyo3::types::{PyBool, PyDict, PyFloat, PyInt, PyList, PyString};
use pyo3::{prelude::*, IntoPyObjectExt};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::ffi::CString;
use tokio::task;
use tracing::{error, info};

use super::ExecutableNode;

pub struct CustomNode {
    node: Node,
}

impl CustomNode {
    pub fn new(node: &Node) -> Result<Self> {
        let node = node.clone();
        Ok(Self { node })
    }
}

fn json_to_py<'py>(py: Python<'py>, value: &Value) -> PyResult<Py<PyAny>> {
    match value {
        Value::Null => Ok(py.None()),
        Value::Bool(b) => Ok(PyBool::new(py, *b).to_owned().into()),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(PyInt::new(py, i).into_any().into())
            } else if let Some(f) = n.as_f64() {
                Ok(PyFloat::new(py, f).into_any().into())
            } else {
                Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                    "Invalid number type",
                ))
            }
        }
        Value::String(s) => Ok(PyString::new(py, s).into_any().into()),
        Value::Array(arr) => {
            let elements: Vec<Py<PyAny>> = arr
                .iter()
                .map(|v| json_to_py(py, v))
                .collect::<PyResult<_>>()?;
            let list = PyList::new(py, &elements)?;
            Ok(list.into_any().into())
        }
        Value::Object(obj) => {
            let dict = PyDict::new(py);
            for (key, val) in obj {
                dict.set_item(key, json_to_py(py, val)?)?;
            }
            Ok(dict.into_any().into())
        }
    }
}

fn py_to_json(val: &Bound<PyAny>) -> Result<Value> {
    if val.is_none() {
        return Ok(Value::Null);
    }
    if let Ok(b) = val.extract::<bool>() {
        return Ok(Value::Bool(b));
    }
    if let Ok(i) = val.extract::<i64>() {
        return Ok(Value::Number(i.into()));
    }
    if let Ok(f) = val.extract::<f64>() {
        let num = serde_json::Number::from_f64(f).ok_or_else(|| anyhow!("Invalid f64 value"))?;
        return Ok(Value::Number(num));
    }
    if let Ok(s) = val.extract::<String>() {
        return Ok(Value::String(s));
    }
    if let Ok(list) = val.downcast::<PyList>() {
        let mut arr = Vec::new();
        for item in list {
            arr.push(py_to_json(&item)?);
        }
        return Ok(Value::Array(arr));
    }
    if let Ok(dict) = val.downcast::<PyDict>() {
        let mut map = Map::new();
        for (key, value) in dict {
            let key_str = key.extract::<String>()?;
            map.insert(key_str, py_to_json(&value)?);
        }
        return Ok(Value::Object(map));
    }
    Err(anyhow!(
        "Unsupported Python type for JSON conversion: {}",
        val.get_type().name()?
    ))
}

#[async_trait]
impl ExecutableNode for CustomNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let path_value = self
            .node
            .data
            .get("path")
            .ok_or_else(|| anyhow!("'path' not found in node data"))?;
        let original_path = path_value
            .as_str()
            .ok_or_else(|| anyhow!("'path' must be a string"))?;

        let script_path = original_path.replace("{:code}", "./storage");

        let code = match tokio::fs::read_to_string(&script_path).await {
            Ok(c) => c,
            Err(e) => {
                let err_msg = format!("Failed to read Python script at '{}': {}", script_path, e);
                error!("{}", err_msg);
                return Err(anyhow!(err_msg));
            }
        };

        Python::initialize();

        let blocking_task = task::spawn_blocking(move || {
            Python::attach(|py| -> Result<HashMap<String, Value>> {
                let inputs_dict = PyDict::new(py);
                for (key, value) in &inputs {
                    inputs_dict.set_item(key, json_to_py(py, value)?)?;
                }

                let code_cstr = CString::new(code.as_bytes())
                    .map_err(|e| anyhow!("Failed to convert code to CString: {}", e))?;
                let path_cstr = CString::new(script_path.as_bytes())
                    .map_err(|e| anyhow!("Failed to convert script path to CString: {}", e))?;
                let mod_name_cstr = CString::new("custom_module")
                    .map_err(|e| anyhow!("Failed to convert module name to CString: {}", e))?;

                let module = PyModule::from_code(py, &code_cstr, &path_cstr, &mod_name_cstr)?;
                let main_fn = module.getattr("main")?;
                let py_result = main_fn.call1((inputs_dict,))?;

                let outputs_dict = py_result
                    .downcast::<PyDict>()
                    .map_err(|e| anyhow!("Python script must return a dict. Error: {}", e))?;

                let mut outputs = HashMap::new();
                for (key, value) in outputs_dict {
                    let key_str: String = key.extract()?;
                    let value_json = py_to_json(&value)?;
                    outputs.insert(key_str, value_json);
                }
                Ok(outputs)
            })
            .map_err(|e| anyhow!("Python execution failed: {}", e))
        });

        match blocking_task.await {
            Ok(Ok(outputs)) => {
                info!("Python script executed successfully");
                Ok(ExecutionResult {
                    outputs,
                    ..Default::default()
                })
            }
            Ok(Err(e)) => {
                error!("Error inside python script execution for {}", e);
                Err(e)
            }
            Err(e) => {
                error!("Failed to run python script blocking task fo {}", e);
                Err(anyhow!("Task join error: {}", e))
            }
        }
    }
}
