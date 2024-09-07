import chunkUploadFunc from './ChunkUpload.js';
import singleUploadFunc from './SingleUpload.js';
import {
  ParallelController,
} from './utils.js';

const fileInput = document.getElementById('uploader');
const progressContainer = document.getElementById('progress-container');
// const progressBar = document.getElementById('progress-bar');
const threshold = Math.pow(2, 26); // 大于64MiB开启分片上传
const maxInParallel = 3;

fileInput.addEventListener('change', async (evt) => {
  const parallelController = new ParallelController(maxInParallel);
  const files = Array.from(evt.target.files);
  if (files.length === 0) {
    console.error('No file.');
  } else {
    const promiseList = [];
    files.forEach(file => {
      const item = document.createElement('li');
      const fileName = document.createElement('span');
      fileName.textContent = file.name;
      item.appendChild(fileName);
      const progressBar = document.createElement('progress');
      item.appendChild(progressBar);
      progressContainer.appendChild(item);

      if (file.size > threshold) {
        promiseList.push(chunkUploadFunc(file, parallelController, progressBar));
      } else {
        promiseList.push(singleUploadFunc(file, parallelController, progressBar));
      }
    });

    await Promise.all(promiseList);
    console.log('All clear');
    evt.target.value = null;
    progressContainer.innerHTML = '';
  }
});
