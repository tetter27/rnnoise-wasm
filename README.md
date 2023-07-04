# rnnoise-wasm

### Overview
WebAssemblyを学習し、動作を確認するためのRepo  

### Usage
0. イヤホンをつける

1. 以下のPageにChromeでアクセスする  
https://tetter27.github.io/rnnoise-wasm/

2. ノイズが除去された音声がエコーされる (トグルで音声除去のOFFが可能)


### Roadmap
- [x] RAWファイル形式で入力して処理する
- [x] getUserMediaで取得したMediaStreamをリアルタイム処理する
- [x] WasmをSIMD対応版にする
  - [ ] SIMD版が高速に動作しない点を調査して修正する
- [ ] ブラウザの対応状況を確認してSIMD版と通常版を出し分ける
- [ ] WasmをMultiThread対応する
- [ ] WebWorkerとAudioWorkletを実装する


### LICENCE
 MIT license (index.html, src/index.js)  
 Apache-2.0 license (build.sh)  
 BSD-3-Clause license (src/rnnoise.wasm, src/rnnoise.js)

### Refer
https://github.com/xiph/rnnoise  
https://github.com/jitsi/rnnoise-wasm
