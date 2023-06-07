import createRNNWasmModule from './rnnoise.js';

(async () => {

  const FRAME_SIZE = 480; // RNNoiseの入力フレームサイズ
  const BUFFER_SIZE = FRAME_SIZE * 4; // Float32
  console.log("start denoising.")

  const wasmModule = await createRNNWasmModule();
  const denoiser = wasmModule._rnnoise_create();

  const pcmInputBuf= wasmModule._malloc(BUFFER_SIZE);
  const pcmOutputBuf = wasmModule._malloc(BUFFER_SIZE);
  const pcmInputIndex = pcmInputBuf / 4;
  const pcmOutputIndex = pcmOutputBuf / 4;

  // MediaStream取得とInsertableStream用processor
  const gUMStream = await navigator.mediaDevices
    .getUserMedia({ video: false, audio: true })
    .then((stream) => {
      const audioElm = document.getElementById("my-audio");
      audioElm.srcObject = stream;
      return stream;
    })
    .catch((error) => {
      console.error("mediaDevice.getUserMedia() error:", error);
      return;
  });
  const audioTrack = gUMStream.getAudioTracks()[0]
  const processor = new MediaStreamTrackProcessor({ track: audioTrack });
  const generator = new MediaStreamTrackGenerator({ kind: "audio" });

  const denoisedAudioElm = document.getElementById("denoised-audio");
  const denoisedStream = new MediaStream();
  denoisedStream.addTrack(generator);
  denoisedAudioElm.srcObject = denoisedStream;
  await denoisedAudioElm.play();

  const transformer = new TransformStream({
    async transform(inputAudioData, controller) {
      const audioByteLength = await inputAudioData.numberOfFrames;

      const inputArray = new Float32Array(audioByteLength);
      const denormalizedInputArray = new Float32Array(inputArray.length);
      const outputArray = new Float32Array(inputArray.length);
      const normalizedOutputArray = new Float32Array(inputArray.length);

      inputAudioData.copyTo(inputArray, {planeIndex: 0});

      // 非正規化
      // AudioDataの値の範囲は -1 〜 1
      // RNNoiseの値の範囲は -32767 〜 32767
      for (let i = 0; i < inputArray.length; i++) {
        denormalizedInputArray[i] = inputArray[i] * 0x7FFF; // Multiply by 2^15-1 (32767) to Int16 range
      }

      wasmModule.HEAPF32.set(denormalizedInputArray, pcmInputIndex);
      wasmModule._rnnoise_process_frame(denoiser, pcmOutputBuf, pcmInputBuf);

      const denoisedFrame = wasmModule.HEAPF32.subarray(pcmOutputIndex, pcmOutputIndex + FRAME_SIZE);
      outputArray.set(denoisedFrame, 0);

      // 正規化
      // AudioDataの値の範囲は -1 〜 1
      // RNNoiseの値の範囲は -32767 〜 32767
      for (let i = 0; i < outputArray.length; i++) {
        normalizedOutputArray[i] = outputArray[i] / 0x7FFF;
      }

      // [Chrome] sampleRate: 48000, numberOfFrames: 480, format: `f32-planar`
      // Insertable Streamsの対応ブラウザが増えたら可変にする必要がある
      const format = 'f32-planar';
      let outputAudioData = new AudioData({
        format,
        sampleRate: inputAudioData.sampleRate,
        numberOfFrames: inputAudioData.numberOfFrames,
        numberOfChannels: inputAudioData.numberOfChannels,
        timestamp: inputAudioData.timestamp,
        data: normalizedOutputArray
      });
      controller.enqueue(outputAudioData);
      inputAudioData.close();

    },
  });

  processor.readable.pipeThrough(transformer).pipeTo(generator.writable);

})();