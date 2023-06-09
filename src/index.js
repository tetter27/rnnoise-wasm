import createRNNWasmModule from './rnnoise.js';
import RingBuffer from '../audio-utils/src/ringBuffer.js';

(async () => {

  const FRAME_SIZE = 480; // RNNoiseの入力フレームサイズ
  const BUFFER_SIZE = FRAME_SIZE * 4; // Float32
  const INPUT_BUFFER_FRAMES = 10;
  console.log("start denoising.");

  const wasmModule = await createRNNWasmModule();
  const denoiser = wasmModule._rnnoise_create();

  const pcmInputBuf= wasmModule._malloc(BUFFER_SIZE);
  const pcmOutputBuf = wasmModule._malloc(BUFFER_SIZE);
  const pcmInputIndex = pcmInputBuf / 4;
  const pcmOutputIndex = pcmOutputBuf / 4;

  const inputRingBuffer = new RingBuffer(INPUT_BUFFER_FRAMES * FRAME_SIZE, Float32Array);
  const outputRingBuffer = new RingBuffer(INPUT_BUFFER_FRAMES * FRAME_SIZE, Float32Array);

  const audioElm = document.getElementById("my-audio");

  // MediaStream取得とInsertableStream用processor
  const gUMStream = await navigator.mediaDevices.getUserMedia({ 
    video: false, 
    audio: {
      noiseSuppression: false,
      echoCancellation: false, 
      
    }})
    .then((stream) => {
      return stream;
    })
    .catch((error) => {
      console.error("mediaDevice.getUserMedia() error:", error);
      return;
  });
  const audioTrack = gUMStream.getAudioTracks()[0];
  const processor = new MediaStreamTrackProcessor({ track: audioTrack });
  const generator = new MediaStreamTrackGenerator({ kind: "audio" });

  const denoisedStream = new MediaStream();
  denoisedStream.addTrack(generator);


  //audioElm.srcObject = stream;

  audioElm.srcObject = denoisedStream;
  audioElm.play();

  var checkbox = document.getElementById("denoise-switch");

  checkbox.addEventListener('change', function() {
    if (this.checked) {
      audioElm.srcObject = denoisedStream;
      audioElm.play();
      console.log("Denoised Audio");
    } else {
      audioElm.srcObject = gUMStream;
      audioElm.play();
      console.log("Original Audio");
    }
  });

  let counter = 0;
  let totalTime = 0.0;

  const transformer = new TransformStream({
    async transform(inputAudioData, controller) {
      const audioByteLength = await inputAudioData.numberOfFrames;

      const inputArray = new Float32Array(audioByteLength);
      const denormalizedInputArray = new Float32Array(FRAME_SIZE);
      const outputArray = new Float32Array(FRAME_SIZE);
      const normalizedOutputArray = new Float32Array(FRAME_SIZE);

      inputAudioData.copyTo(inputArray, {planeIndex: 0});
      inputRingBuffer.write(inputArray);
      let denoisingArray;

      if(denoisingArray = inputRingBuffer.read(FRAME_SIZE)){

        // 非正規化
        // AudioDataの値の範囲は -1 〜 1
        // RNNoiseの値の範囲は -32767 〜 32767
        for (let i = 0; i < denoisingArray.length; i++) {
          denormalizedInputArray[i] = denoisingArray[i] * 0x7FFF; // Multiply by 2^15-1 (32767) to Int16 range
        }

        const start = performance.now();

        wasmModule.HEAPF32.set(denormalizedInputArray, pcmInputIndex);
        await wasmModule._rnnoise_process_frame(denoiser, pcmOutputBuf, pcmInputBuf)

        const denoisedFrame = wasmModule.HEAPF32.subarray(pcmOutputIndex, pcmOutputIndex + FRAME_SIZE);
        outputArray.set(denoisedFrame, 0);

        const end = performance.now();
        
        totalTime = totalTime + (end - start);
        counter++;

        if (counter % 1000 == 0){
          console.log("Average process time: " + (totalTime / counter) + "[ms]");
          counter = 0;
          totalTime = 0.0;
        }

        // console.log("start: " + start + "  end: " + end + "  total: " + (end - start));


        // 正規化
        // AudioDataの値の範囲は -1 〜 1
        // RNNoiseの値の範囲は -32767 〜 32767
        for (let i = 0; i < outputArray.length; i++) {
          normalizedOutputArray[i] = outputArray[i] / 0x7FFF;
        }

        outputRingBuffer.write(normalizedOutputArray);

      }

      let denoisedArray;

      while(denoisedArray = outputRingBuffer.read(inputAudioData.numberOfFrames)){

        // [Chrome] sampleRate: 48000, numberOfFrames: 480, format: `f32-planar`
        // Insertable Streamsの対応ブラウザが増えたら可変にする必要がある
        const format = 'f32-planar';
        let outputAudioData = new AudioData({
          format,
          sampleRate: inputAudioData.sampleRate,
          numberOfFrames: inputAudioData.numberOfFrames,
          numberOfChannels: inputAudioData.numberOfChannels,
          timestamp: inputAudioData.timestamp,
          data: denoisedArray,
        });
        controller.enqueue(outputAudioData);

      }
      inputAudioData.close();

    },
  });

  processor.readable.pipeThrough(transformer).pipeTo(generator.writable);

})();