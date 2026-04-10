use crate::db::models::SystemConfiguration;

pub fn replace_config_placeholders(template: &str, configs: &[SystemConfiguration]) -> String {
    let mut result = String::with_capacity(template.len());
    let mut last_end = 0;

    while let Some(start) = template[last_end..].find("{:") {
        let absolute_start = last_end + start;
        result.push_str(&template[last_end..absolute_start]);

        let search_area = &template[absolute_start + 2..];
        if let Some(end) = search_area.find('}') {
            let absolute_end = absolute_start + 2 + end;
            let key = &template[absolute_start + 2..absolute_end];

            let value = configs
                .iter()
                .find(|config| config.key == key)
                .map(|config| config.value.as_str());

            if let Some(v) = value {
                result.push_str(v);
            } else {
                result.push_str(&template[absolute_start..absolute_end + 1]);
            }

            last_end = absolute_end + 1;
        } else {
            result.push_str(&template[absolute_start..absolute_start + 2]);
            last_end = absolute_start + 2;
        }
    }

    result.push_str(&template[last_end..]);
    result
}
