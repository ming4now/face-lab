# OpenGraphAU experimental nose signals

- Official source: https://github.com/lingjivoo/OpenGraphAU
- Source commit: `a0ad10d516ed121f476cbc6d66a84ebfc033a53f`
- Architecture: ResNet-18, stage 1 / ANFL, 27 main + 14 lateral AUs, 4 graph neighbors, dot similarity.
- Official checkpoint: https://drive.google.com/file/d/1b9yrKF663K9IwY2C2-1SD6azpAdNgBm7/view
- Original checkpoint SHA-256: `4ad635b5550263e09e01e1c526838a3281e8ae42caf7cb889b600c0f401c2bfe`
- Exported ONNX SHA-256: `67a03656dbf11d3b999319e98cce60de09295255ea6d2030d34b389453d837ce`
- Float32, ONNX opset 17, fixed `[1,3,224,224]` RGB NCHW input. ImageNet mean `[0.485,0.456,0.406]`, standard deviation `[0.229,0.224,0.225]`.
- 41 output action scores. Nose indices: AU9 = 6; AU38 = 25; AU39 = 26 (zero based). These are action recognition scores, not ARKit blendshape intensities or measured nostril area.

Conversion uses the exact official state dictionary with strict key validation. No retraining, quantization, or gain was applied. See `export-report.json` for PyTorch / ONNX CPU parity on five upstream sample images. This validates conversion, **not** nose-tracking accuracy.

The browser reuses MediaPipe landmarks to crop a padded square face and correct in-plane roll, then applies the upstream 256-to-224 center crop and normalization. Face positioning/cropping can affect predictions; browser results require real-user validation. No pose-invariance or mobile frame-rate guarantee is made.

Upstream code is Apache-2.0; its license is retained here. The checkpoint was publicly released in the official repository's README. No separate checkpoint-specific commercial license was included in that download; verify weight and training-data terms before a commercial release. ONNX Runtime has its own MIT license and third-party notices under `vendor/onnxruntime/`.

Citation: Luo, C. et al. Learning Multi-dimensional Edge Feature-based AU Relation Graph for Facial Action Unit Recognition. IJCAI 2022, pp. 1239–1246.

This derivative exports the official network to ONNX and adds a separate browser inference and diagnostic interface in Face Lab (2026-09-28).
