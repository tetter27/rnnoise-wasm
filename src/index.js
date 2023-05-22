import createRNNWasmModule from './rnnoise.js';

const FRAME_SIZE = 480;
const BUFFER_SIZE = FRAME_SIZE * 4;

async function denoise(inputData) {
  console.log("start denoising.")
  const wasmModule = await createRNNWasmModule();

  const pcmInputBuf= wasmModule._malloc(BUFFER_SIZE);
  const pcmOutputBuf = wasmModule._malloc(BUFFER_SIZE);
  const pcmInputIndex = pcmInputBuf / 4;
  const pcmOutputIndex = pcmOutputBuf / 4;

  const inputF32Data = new Float32Array(inputData);
  const tmpOutputData = new Int16Array(inputData.length);
  const outputF32Data = new Float32Array(tmpOutputData);

  const denoiser = wasmModule._rnnoise_create();

  for (let i = 0; i + FRAME_SIZE < inputF32Data.length; i += FRAME_SIZE) {
      const sample = inputF32Data.slice(i, i + FRAME_SIZE);

      wasmModule.HEAPF32.set(sample, pcmInputIndex);
      wasmModule._rnnoise_process_frame(denoiser, pcmOutputBuf, pcmInputBuf);

      const denoise = wasmModule.HEAPF32.subarray(pcmOutputIndex, pcmOutputIndex + FRAME_SIZE);
    
      outputF32Data.set(denoise, i);
  }

  wasmModule._rnnoise_destroy(denoiser);

  wasmModule._free(pcmInputBuf);
  wasmModule._free(pcmOutputBuf);

  const outputData = new Int16Array(outputF32Data);

  return outputData;
}

const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('player');
const downloadButton = document.getElementById('downloadButton');

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log("data is loaded.")

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = new Int16Array(arrayBuffer);

    const denoisedBuffer = await denoise(audioBuffer);
    console.log(denoisedBuffer);

    const denoisedBlob = new Blob([denoisedBuffer], {type: ''});
    const denoisedUrl = URL.createObjectURL(denoisedBlob);
    audioPlayer.src = denoisedUrl;
    
    // ダウンロードボタンの設定
    downloadButton.href = denoisedUrl;
    downloadButton.download = 'denoised_audio.raw';
    downloadButton.style.display = 'inline'; // ボタンを表示する
    console.log("downloader is prepared.")
});
