document.getElementById("file").addEventListener('change', changeFile);
const video = document.getElementById('local-video');
function changeFile(e) {
  const file = e.target.files[0];
  console.error("file", file);
  const pos = file.name.lastIndexOf('.');
  let ext = (pos === -1) ? '' : file.name.slice(pos);
  dodo4(file, ext);
}

async function dodo4(blob, ext) {
  video.muted = false;
  video.autoplay = false;
  video.src = URL.createObjectURL(blob);
  const voice_ranges = await FullRNNoise();
  console.error("voice_ranges", voice_ranges);
  const blobBuffer = await blob.arrayBuffer();
  console.error("blobBuffer", blobBuffer)
  const inputfilename = 'input' + ext;
  await ffmpeg.FS('writeFile', inputfilename, new Uint8Array(blobBuffer));
  let filelist = "";
  for(let i=0;i<voice_ranges.length;i++){
    const splitfilename = 'output' + i + ext;
    // await ffmpeg.run('-i', inputfilename, '-ss', sec2time(voice_ranges[i][0]), '-t', sec2time(voice_ranges[i][1] - voice_ranges[i][0]), splitfilename);
    await ffmpeg.run('-i', inputfilename, '-c', 'copy', '-ss', sec2time(voice_ranges[i][0]), '-t', sec2time(voice_ranges[i][1] - voice_ranges[i][0]), splitfilename);
    filelist += 'file ' + splitfilename + "\n";
  }
  console.error("filelist", filelist);
  const listfilename = 'list.txt';
  await ffmpeg.FS('writeFile', listfilename, filelist);
  const outputfilename = 'output' + ext;
  await ffmpeg.run('-f', 'concat', '-i', listfilename, '-c', 'copy', outputfilename);
  const data = ffmpeg.FS('readFile', outputfilename);
  ffmpeg.FS('unlink', inputfilename);
  ffmpeg.FS('unlink', outputfilename);
  video.src = URL.createObjectURL(new Blob([data.buffer]));
  video.play();
}

function zeroPadding(NUM, LEN){
	return ( Array(LEN).join('0') + NUM ).slice( -LEN );
}

function sec2time(sec){
  const hours = Math.floor(sec / 3600);
  sec -= hours * 3600;
  const minutes = Math.floor(sec / 60);
  sec -= minutes * 60;
  const seconds = Math.floor(sec);
  const millseconds = Math.floor(1000 * (sec - seconds));
  return zeroPadding(hours, 2)+":"+zeroPadding(minutes, 2)+":"+zeroPadding(seconds, 2)+"."+zeroPadding(millseconds, 3)
}

(async () => {
  const { createFFmpeg } = FFmpeg;
  window.ffmpeg = createFFmpeg({ log: true });
  await ffmpeg.load();
  console.error("ffmpeg loaded");
})();

async function FullRNNoise() {
  const { _rnnoise_create, _free, _malloc, _rnnoise_process_frame, _rnnoise_destroy, HEAPF32 } = await Module();

  const SAMPLE_LENGTH = 480;
  const BUFFER_SIZE = SAMPLE_LENGTH * 4;

  const pcmInputBuf = _malloc(BUFFER_SIZE);
  const pcmOutputBuf = _malloc(BUFFER_SIZE);
  const pcmInputIndex = pcmInputBuf / 4;

  let rnn = _rnnoise_create();
  const destroy = () => {
    if (!rnn) return;
    pcmInputBuf && _free(pcmInputBuf);
    pcmOutputBuf && _free(pcmOutputBuf);
    _rnnoise_destroy(rnn);
    rnn = 0;
  };
  window.addEventListener('onunload', destroy);

  const processFrame = sample => {
    for (const [i, value] of sample.entries()) sample[i] = value * 0x7fff;
    HEAPF32.set(sample, pcmInputIndex);
    return _rnnoise_process_frame(rnn, pcmOutputBuf, pcmInputBuf);
  }

  let bufferResidue = new Float32Array([]);

  let score_avg50 = 0;
  let voice_off50 = true;
  let voice_off50_prev = true;

  if(!window.audioContext){
    window.audioContext = new AudioContext();
    window.source = audioContext.createMediaElementSource(video); 
  }
  source.disconnect();

  window.processor = audioContext.createScriptProcessor(512, 1, 1);
  let voice_range = [0, 0];
  const scores = [];
  const voice_ranges = [];
  processor.onaudioprocess = e => {
    const inData = [...bufferResidue, ...e.inputBuffer.getChannelData(0)];
    let i = 0;
    for (; i + SAMPLE_LENGTH < inData.length; i += SAMPLE_LENGTH) {
      const sample = inData.slice(i, i + SAMPLE_LENGTH);
      const score = processFrame(sample);

      if (voice_off50 && score > 0.9) {
        score_avg50 = score;
      } else {
        score_avg50 = (score_avg50 * 49 + score * 1) / 50;
      }
      voice_off50_prev = voice_off50;
      voice_off50 = score_avg50 < 0.5;
      const trigger_voice50 = (voice_off50 != voice_off50_prev);

      scores.push({"time": e.playbackTime + i/48000, score, trigger_voice50, voice_off50, score_avg50});

      if (trigger_voice50) {
        if (voice_off50) {
          voice_range[1] = e.playbackTime;
          voice_ranges.push(voice_range);
          voice_range = [0, 0];
        } else {
          voice_range[0] = e.playbackTime;
        }
        console.error("trigger", !voice_off50, e.playbackTime);
      }
    }
    bufferResidue = inData.slice(i);

    let inputBuffer = e.inputBuffer;
    let outputBuffer = e.outputBuffer;
    for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
      let inputData = inputBuffer.getChannelData(channel);
      let outputData = outputBuffer.getChannelData(channel);
      outputData.set(inputData);
    }
  };
  source.connect(processor);
  processor.connect(audioContext.destination);

  let video_pause_promise_resolve = undefined;
  const video_pause_promise = new Promise((resolve) => video_pause_promise_resolve = resolve)
  video.ontimeupdate = (e) => {
    if (video.currentTime >= 30) {
      video.pause();
    }
  };
  video.onpause = video_pause_promise_resolve;
  video.onended = video_pause_promise_resolve;
  await video.play();//再生開始
  await video_pause_promise;//ポーズか終了するまで待機
  video.ontimeupdate = null;
  video.onpause = null;
  video.onended = null;

  source.disconnect();
  processor.disconnect();
  source.connect(audioContext.destination);

  destroy();
  return voice_ranges;
}

var Module = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  
  return (
function(Module) {
  Module = Module || {};

null;var Module=typeof Module!=="undefined"?Module:{};var readyPromiseResolve,readyPromiseReject;Module["ready"]=new Promise(function(resolve,reject){readyPromiseResolve=resolve;readyPromiseReject=reject});var moduleOverrides={};var key;for(key in Module){if(Module.hasOwnProperty(key)){moduleOverrides[key]=Module[key]}}var arguments_=[];var thisProgram="./this.program";var quit_=function(status,toThrow){throw toThrow};var ENVIRONMENT_IS_WEB=false;var ENVIRONMENT_IS_WORKER=false;var ENVIRONMENT_IS_NODE=false;var ENVIRONMENT_IS_SHELL=false;ENVIRONMENT_IS_WEB=typeof window==="object";ENVIRONMENT_IS_WORKER=typeof importScripts==="function";ENVIRONMENT_IS_NODE=typeof process==="object"&&typeof process.versions==="object"&&typeof process.versions.node==="string";ENVIRONMENT_IS_SHELL=!ENVIRONMENT_IS_WEB&&!ENVIRONMENT_IS_NODE&&!ENVIRONMENT_IS_WORKER;var scriptDirectory="";function locateFile(path){if(Module["locateFile"]){return Module["locateFile"](path,scriptDirectory)}return scriptDirectory+path}var read_,readAsync,readBinary,setWindowTitle;if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){if(ENVIRONMENT_IS_WORKER){scriptDirectory=self.location.href}else if(document.currentScript){scriptDirectory=document.currentScript.src}if(_scriptDir){scriptDirectory=_scriptDir}if(scriptDirectory.indexOf("blob:")!==0){scriptDirectory=scriptDirectory.substr(0,scriptDirectory.lastIndexOf("/")+1)}else{scriptDirectory=""}{read_=function shell_read(url){var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.send(null);return xhr.responseText};if(ENVIRONMENT_IS_WORKER){readBinary=function readBinary(url){var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.responseType="arraybuffer";xhr.send(null);return new Uint8Array(xhr.response)}}readAsync=function readAsync(url,onload,onerror){var xhr=new XMLHttpRequest;xhr.open("GET",url,true);xhr.responseType="arraybuffer";xhr.onload=function xhr_onload(){if(xhr.status==200||xhr.status==0&&xhr.response){onload(xhr.response);return}onerror()};xhr.onerror=onerror;xhr.send(null)}}setWindowTitle=function(title){document.title=title}}else{}var out=Module["print"]||console.log.bind(console);var err=Module["printErr"]||console.warn.bind(console);for(key in moduleOverrides){if(moduleOverrides.hasOwnProperty(key)){Module[key]=moduleOverrides[key]}}moduleOverrides=null;if(Module["arguments"])arguments_=Module["arguments"];if(Module["thisProgram"])thisProgram=Module["thisProgram"];if(Module["quit"])quit_=Module["quit"];var wasmBinary;if(Module["wasmBinary"])wasmBinary=Module["wasmBinary"];var noExitRuntime;if(Module["noExitRuntime"])noExitRuntime=Module["noExitRuntime"];if(typeof WebAssembly!=="object"){err("no native wasm support detected")}var wasmMemory;var wasmTable=new WebAssembly.Table({"initial":1,"maximum":1+0,"element":"anyfunc"});var ABORT=false;var EXITSTATUS=0;var WASM_PAGE_SIZE=65536;function alignUp(x,multiple){if(x%multiple>0){x+=multiple-x%multiple}return x}var buffer,HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64;function updateGlobalBufferAndViews(buf){buffer=buf;Module["HEAP8"]=HEAP8=new Int8Array(buf);Module["HEAP16"]=HEAP16=new Int16Array(buf);Module["HEAP32"]=HEAP32=new Int32Array(buf);Module["HEAPU8"]=HEAPU8=new Uint8Array(buf);Module["HEAPU16"]=HEAPU16=new Uint16Array(buf);Module["HEAPU32"]=HEAPU32=new Uint32Array(buf);Module["HEAPF32"]=HEAPF32=new Float32Array(buf);Module["HEAPF64"]=HEAPF64=new Float64Array(buf)}var DYNAMIC_BASE=5340496,DYNAMICTOP_PTR=97456;var INITIAL_INITIAL_MEMORY=Module["INITIAL_MEMORY"]||16777216;if(Module["wasmMemory"]){wasmMemory=Module["wasmMemory"]}else{wasmMemory=new WebAssembly.Memory({"initial":INITIAL_INITIAL_MEMORY/WASM_PAGE_SIZE,"maximum":2147483648/WASM_PAGE_SIZE})}if(wasmMemory){buffer=wasmMemory.buffer}INITIAL_INITIAL_MEMORY=buffer.byteLength;updateGlobalBufferAndViews(buffer);HEAP32[DYNAMICTOP_PTR>>2]=DYNAMIC_BASE;function callRuntimeCallbacks(callbacks){while(callbacks.length>0){var callback=callbacks.shift();if(typeof callback=="function"){callback(Module);continue}var func=callback.func;if(typeof func==="number"){if(callback.arg===undefined){Module["dynCall_v"](func)}else{Module["dynCall_vi"](func,callback.arg)}}else{func(callback.arg===undefined?null:callback.arg)}}}var __ATPRERUN__=[];var __ATINIT__=[];var __ATMAIN__=[];var __ATPOSTRUN__=[];var runtimeInitialized=false;function preRun(){if(Module["preRun"]){if(typeof Module["preRun"]=="function")Module["preRun"]=[Module["preRun"]];while(Module["preRun"].length){addOnPreRun(Module["preRun"].shift())}}callRuntimeCallbacks(__ATPRERUN__)}function initRuntime(){runtimeInitialized=true;callRuntimeCallbacks(__ATINIT__)}function preMain(){callRuntimeCallbacks(__ATMAIN__)}function postRun(){if(Module["postRun"]){if(typeof Module["postRun"]=="function")Module["postRun"]=[Module["postRun"]];while(Module["postRun"].length){addOnPostRun(Module["postRun"].shift())}}callRuntimeCallbacks(__ATPOSTRUN__)}function addOnPreRun(cb){__ATPRERUN__.unshift(cb)}function addOnPostRun(cb){__ATPOSTRUN__.unshift(cb)}var runDependencies=0;var runDependencyWatcher=null;var dependenciesFulfilled=null;function addRunDependency(id){runDependencies++;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}}function removeRunDependency(id){runDependencies--;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}if(runDependencies==0){if(runDependencyWatcher!==null){clearInterval(runDependencyWatcher);runDependencyWatcher=null}if(dependenciesFulfilled){var callback=dependenciesFulfilled;dependenciesFulfilled=null;callback()}}}Module["preloadedImages"]={};Module["preloadedAudios"]={};function abort(what){if(Module["onAbort"]){Module["onAbort"](what)}what+="";out(what);err(what);ABORT=true;EXITSTATUS=1;what="abort("+what+"). Build with -s ASSERTIONS=1 for more info.";throw new WebAssembly.RuntimeError(what)}function hasPrefix(str,prefix){return String.prototype.startsWith?str.startsWith(prefix):str.indexOf(prefix)===0}var dataURIPrefix="data:application/octet-stream;base64,";function isDataURI(filename){return hasPrefix(filename,dataURIPrefix)}var wasmBinaryFile="https://cdn.jsdelivr.net/gh/jitsi/rnnoise-wasm/dist/rnnoise.wasm";if(!isDataURI(wasmBinaryFile)){wasmBinaryFile=locateFile(wasmBinaryFile)}function getBinary(){try{if(wasmBinary){return new Uint8Array(wasmBinary)}if(readBinary){return readBinary(wasmBinaryFile)}else{throw"both async and sync fetching of the wasm failed"}}catch(err){abort(err)}}function getBinaryPromise(){if(!wasmBinary&&(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER)&&typeof fetch==="function"){return fetch(wasmBinaryFile,{credentials:"same-origin"}).then(function(response){if(!response["ok"]){throw"failed to load wasm binary file at '"+wasmBinaryFile+"'"}return response["arrayBuffer"]()}).catch(function(){return getBinary()})}return new Promise(function(resolve,reject){resolve(getBinary())})}function createWasm(){var info={"a":asmLibraryArg};function receiveInstance(instance,module){var exports=instance.exports;Module["asm"]=exports;removeRunDependency("wasm-instantiate")}addRunDependency("wasm-instantiate");function receiveInstantiatedSource(output){receiveInstance(output["instance"])}function instantiateArrayBuffer(receiver){return getBinaryPromise().then(function(binary){return WebAssembly.instantiate(binary,info)}).then(receiver,function(reason){err("failed to asynchronously prepare wasm: "+reason);abort(reason)})}function instantiateAsync(){if(!wasmBinary&&typeof WebAssembly.instantiateStreaming==="function"&&!isDataURI(wasmBinaryFile)&&typeof fetch==="function"){fetch(wasmBinaryFile,{credentials:"same-origin"}).then(function(response){var result=WebAssembly.instantiateStreaming(response,info);return result.then(receiveInstantiatedSource,function(reason){err("wasm streaming compile failed: "+reason);err("falling back to ArrayBuffer instantiation");return instantiateArrayBuffer(receiveInstantiatedSource)})})}else{return instantiateArrayBuffer(receiveInstantiatedSource)}}if(Module["instantiateWasm"]){try{var exports=Module["instantiateWasm"](info,receiveInstance);return exports}catch(e){err("Module.instantiateWasm callback failed with error: "+e);return false}}instantiateAsync();return{}}__ATINIT__.push({func:function(){___wasm_call_ctors()}});function _emscripten_memcpy_big(dest,src,num){HEAPU8.copyWithin(dest,src,src+num)}function _emscripten_get_heap_size(){return HEAPU8.length}function emscripten_realloc_buffer(size){try{wasmMemory.grow(size-buffer.byteLength+65535>>>16);updateGlobalBufferAndViews(wasmMemory.buffer);return 1}catch(e){}}function _emscripten_resize_heap(requestedSize){requestedSize=requestedSize>>>0;var oldSize=_emscripten_get_heap_size();var PAGE_MULTIPLE=65536;var maxHeapSize=2147483648;if(requestedSize>maxHeapSize){return false}var minHeapSize=16777216;for(var cutDown=1;cutDown<=4;cutDown*=2){var overGrownHeapSize=oldSize*(1+.2/cutDown);overGrownHeapSize=Math.min(overGrownHeapSize,requestedSize+100663296);var newSize=Math.min(maxHeapSize,alignUp(Math.max(minHeapSize,requestedSize,overGrownHeapSize),PAGE_MULTIPLE));var replacement=emscripten_realloc_buffer(newSize);if(replacement){return true}}return false}var asmLibraryArg={"a":_emscripten_memcpy_big,"b":_emscripten_resize_heap,"memory":wasmMemory,"table":wasmTable};var asm=createWasm();var ___wasm_call_ctors=Module["___wasm_call_ctors"]=function(){return(___wasm_call_ctors=Module["___wasm_call_ctors"]=Module["asm"]["c"]).apply(null,arguments)};var _rnnoise_init=Module["_rnnoise_init"]=function(){return(_rnnoise_init=Module["_rnnoise_init"]=Module["asm"]["d"]).apply(null,arguments)};var _rnnoise_create=Module["_rnnoise_create"]=function(){return(_rnnoise_create=Module["_rnnoise_create"]=Module["asm"]["e"]).apply(null,arguments)};var _malloc=Module["_malloc"]=function(){return(_malloc=Module["_malloc"]=Module["asm"]["f"]).apply(null,arguments)};var _rnnoise_destroy=Module["_rnnoise_destroy"]=function(){return(_rnnoise_destroy=Module["_rnnoise_destroy"]=Module["asm"]["g"]).apply(null,arguments)};var _free=Module["_free"]=function(){return(_free=Module["_free"]=Module["asm"]["h"]).apply(null,arguments)};var _rnnoise_process_frame=Module["_rnnoise_process_frame"]=function(){return(_rnnoise_process_frame=Module["_rnnoise_process_frame"]=Module["asm"]["i"]).apply(null,arguments)};var calledRun;dependenciesFulfilled=function runCaller(){if(!calledRun)run();if(!calledRun)dependenciesFulfilled=runCaller};function run(args){args=args||arguments_;if(runDependencies>0){return}preRun();if(runDependencies>0)return;function doRun(){if(calledRun)return;calledRun=true;Module["calledRun"]=true;if(ABORT)return;initRuntime();preMain();readyPromiseResolve(Module);if(Module["onRuntimeInitialized"])Module["onRuntimeInitialized"]();postRun()}if(Module["setStatus"]){Module["setStatus"]("Running...");setTimeout(function(){setTimeout(function(){Module["setStatus"]("")},1);doRun()},1)}else{doRun()}}Module["run"]=run;if(Module["preInit"]){if(typeof Module["preInit"]=="function")Module["preInit"]=[Module["preInit"]];while(Module["preInit"].length>0){Module["preInit"].pop()()}}noExitRuntime=true;run();


  return Module.ready
}
);
})();