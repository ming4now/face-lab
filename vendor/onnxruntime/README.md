# ONNX Runtime Web 1.23.2

Downloaded from the official npm package `onnxruntime-web@1.23.2`.
Package SHA-1: `1d7883e7bc1d717f85d75ca7d564b3129feed51b`.
Source: https://github.com/microsoft/onnxruntime/tree/v1.23.2

The ESM WebGPU build uses the matching asyncify WASM loader and binary. Both WebGPU and CPU/WASM paths run in Face Lab's own dedicated Worker. WASM is forced to one thread to support GitHub Pages without cross-origin isolation. All files are served from the same site; no runtime CDN or cloud inference.

See LICENSE (MIT) and ThirdPartyNotices.txt. Runtime files are copied without modifications.
