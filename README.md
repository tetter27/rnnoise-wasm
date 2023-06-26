# rnnoise-wasm

### Roadmap
- [x] RAWファイル形式で入力して処理する
- [x] getUserMediaで取得したMediaStreamをリアルタイム処理する
- [x] WasmをSIMD対応版にする
  - [ ] SIMD版が高速に動作しない点を調査して修正する
- [ ] ブラウザの対応状況を確認してSIMD版と通常版を出し分ける
- [ ] WasmをMultiThread対応する
- [ ] WebWorkerとAudioWorkletを実装する


### LICENCE
 Apache-2.0 license


### Refer
https://github.com/xiph/rnnoise  
https://github.com/jitsi/rnnoise-wasm
