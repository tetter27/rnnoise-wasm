

let localMediaStream = null;
let localScriptProcessorNode = null;
let audioContext = new AudioContext();
const bufferSize = 480 * 4; // 480 frames x 4 bytes (f32)


let onAudioProcess = function (e) {
  let input = e.
}


navigator.mediaDevices
  .getUserMedia({ video: false, audio: true })
  .then((stream) => {
    localMediaStream = stream;

    const audioElm = document.getElementById("my-audio");
    audioElm.srcObject = stream;
    audioElm.play();

    let scriptProcessorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
    localScriptProcessorNode = scriptProcessorNode;

    let mediaStreamSource = audioContext.createMediaStreamSource(stream);
    mediaStreamSource.connect(scriptProcessorNode);

    scriptProcessorNode.onaudioprocess = onAudioProcess;
    scriptProcessorNode.connect(audioContext.destination);

  })
  .catch((error) => {
    console.error("mediaDevice.getUserMedia() error:", error);
    return;
  });
