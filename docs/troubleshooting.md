# Troubleshooting

## Python dylib Loading Issue

```bash
dyld[59248]: Library not loaded: @rpath/libpython3.12.dylib

...
```

This problem occurs because PyO3 cannot dynamically link to Python. To resolve this, you can specify the library path before execution using the RUSTFLAGS environment variable.

Set it like this:

```bash
RUSTFLAGS='-C link-arg=-Wl,-rpath,<path_to_lib_folder_containing_dylib>' npm run server
```

For example:

```bash
RUSTFLAGS='-C link-arg=-Wl,-rpath,/opt/homebrew/Cellar/python@3.12/3.12.11/Frameworks/Python.framework/Versions/3.12/lib' npm run server
```
