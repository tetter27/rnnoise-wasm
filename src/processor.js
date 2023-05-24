import createRNNWasmModule from './rnnoise.js';

export function add(a, b) {
    return a + b;
}

export async function denoise(inputData) {

  const FRAME_SIZE = 480;
  const BUFFER_SIZE = FRAME_SIZE * 4;
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
