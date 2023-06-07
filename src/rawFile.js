import { denoise } from './processor.js';

const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('player');
const downloadButton = document.getElementById('downloadButton');

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log("data is loaded.")

    const arrayBuffer = await file.arrayBuffer();

    
    const audioBuffer = new Int16Array(arrayBuffer);
    //console.log(audioBuffer);

    const denoisedBuffer = await denoise(audioBuffer);
    //console.log(denoisedBuffer);

    const denoisedBlob = new Blob([denoisedBuffer],  {type: ''});
    const denoisedUrl = URL.createObjectURL(denoisedBlob);
    audioPlayer.src = denoisedUrl;
    
    // ダウンロードボタンの設定
    downloadButton.href = denoisedUrl;
    downloadButton.download = 'denoised_audio.raw';
    downloadButton.style.display = 'inline'; // ボタンを表示する
    console.log("downloader is prepared.")
});


// const arrayBuffer = []



