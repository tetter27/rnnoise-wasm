import createRNNWasmModuleSync from './rnnoise-sync.js';
let cutoff = 100;
let wasmModule;
let denoiser;

const getModule = async () => {
    if (!wasmModule) wasmModule = createRNNWasmModuleSync();
    denoiser = wasmModule._rnnoise_create();
  };

function denoiseWithRNNoise() {
  const format = 'f32-planar';
  let lastValuePerChannel = undefined;
  
  return (data, controller) => {
    console.log(denoiser);
    const rc = 1.0 / (cutoff * 2 * Math.PI);
    const dt = 1.0 / data.sampleRate;
    const alpha = dt / (rc + dt);
    const nChannels = data.numberOfChannels;
    if (!lastValuePerChannel) {
      console.log(`Audio stream has ${nChannels} channels.`);
      lastValuePerChannel = Array(nChannels).fill(0);
    }
    const buffer = new Float32Array(data.numberOfFrames * nChannels);
    for (let c = 0; c < nChannels; c++) {
      const offset = data.numberOfFrames * c;
      const samples = buffer.subarray(offset, offset + data.numberOfFrames);
      data.copyTo(samples, {planeIndex: c, format});
      let lastValue = lastValuePerChannel[c];

      for (let i = 0; i < samples.length; ++i) {
        lastValue = lastValue + alpha * (samples[i] - lastValue);
        samples[i] = lastValue;
      }

      lastValuePerChannel[c] = lastValue;
    }
    controller.enqueue(new AudioData({
      format,
      sampleRate: data.sampleRate,
      numberOfFrames: data.numberOfFrames,
      numberOfChannels: nChannels,
      timestamp: data.timestamp,
      data: buffer
    }));
  };
}

let abortController;

onmessage = async (event) => {
  if (event.data.command == 'abort') {
    abortController.abort();
    abortController = null;
  } else {
    await getModule();
    const source = event.data.source;
    const sink = event.data.sink;
    const transformer = new TransformStream({transform: denoiseWithRNNoise()});
    abortController = new AbortController();
    const signal = abortController.signal;
    const promise = source.pipeThrough(transformer, {signal}).pipeTo(sink);
    promise.catch((e) => {
      if (signal.aborted) {
        console.log('Shutting down streams after abort.');
      } else {
        console.error('Error from stream transform:', e);
      }
      source.cancel(e);
      sink.abort(e);
    });
  }
};