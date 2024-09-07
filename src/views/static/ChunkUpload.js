import {
  customXHR,
  fetchWithTimeout,
  loadMapFromLocalStorage,
  promiseWithRetry,
  saveMapToLocalStorage,
} from './utils.js';

const chunkSize = 1024 * 1024; // 每个分片大小为1MB
const chunkUploadURL = window.chunkUploadURL;
const finishURL = window.finishURL;
const SparkMD5 = window.SparkMD5;
const chance = 3;
const retryDelay = 1000;
const timeout = 333;

const uploadFinish = async (totalChunks, file, incrementalHash, parallelController) => {
  const finishData = new FormData();
  finishData.append('totalChunks', totalChunks);
  finishData.append('fileId', file.name);
  finishData.append('hash', incrementalHash);

  let finishPromise;
  await parallelController.push(() => {
    const promise = promiseWithRetry(
      async () => {
        const response = await customXHR(finishURL, {
          method: 'POST',
          body: finishData,
        });
        const json = await response.json();
        console.log(json.message);
      }, chance,
      (error, chance) => console.log(`Upload failed: ${error}\n${chance} more chance`),
      () => console.error(`Upload ${file.name} failed`),
      retryDelay,
    );
    finishPromise = promise;
    return promise;
  });
  await finishPromise;
}

export default async (file, parallelController, progressBar) => {
  progressBar.max = file.size;
  const uploadPromiseList = [];
  // 从 localStorage 获取已上传的分片索引
  const uploadedIndices = loadMapFromLocalStorage(file.name);
  try {
    let incrementalHash = new SparkMD5.ArrayBuffer();
    const totalChunks = Math.ceil(file.size / chunkSize);
    const controller = new AbortController();
    for (let i = 0; i < totalChunks; i++) {
      if (controller.signal.aborted) {
        throw new Error(controller.signal.reason);
      }
      const start = i * chunkSize;
      const end = start + chunkSize > file.size ? file.size : start + chunkSize;
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();
      incrementalHash = incrementalHash.append(arrayBuffer);
      const chunkHash = SparkMD5.ArrayBuffer.hash(arrayBuffer);

      if (uploadedIndices.has(i)) {
        // 跳过已上传的分片
        console.log(`Chunk-${i} already uploaded.`);
        progressBar.value += chunkSize;
      } else {
        const formData = new FormData();
        formData.append('chunkIndex', i); // 分片索引
        formData.append('totalChunks', totalChunks); // 总分片数
        formData.append('fileId', file.name); // 文件唯一标识
        formData.append('hash', chunkHash); // 分片的MD5值
        formData.append('chunk', chunk, `chunk-${i}`); // 分片数据

        await parallelController.push(() => {
          console.log(`Start upoading chunk-${i}`);
          let prevLoaded = 0;
          const promise = promiseWithRetry(
            async () => {
              const response = await fetchWithTimeout(signal => customXHR(
                chunkUploadURL,
                { method: 'POST', body: formData, signal },
                evt => {
                  if (evt.lengthComputable) {
                    progressBar.value += evt.loaded - prevLoaded;
                    prevLoaded = evt.loaded;
                  }
                }
              ), timeout);
              const json = await response.json();
              const result = json.message;
              console.log(`Chunk-${i} uploaded successfully.`);

              // 将上传成功的分片索引存储到 localStorage
              uploadedIndices.set(i, result);
              saveMapToLocalStorage(uploadedIndices, file.name);
            }, chance,
            (error, chance) => console.log(`Upload chunk-${i} failed: ${error}\n${chance} more chance`),
            () => controller.abort(`Chunk-${i} failed after ${chance} attempts`),
            retryDelay,
          );
          uploadPromiseList.push(promise);
          return promise;
        });
      }
    }

    await Promise.all(uploadPromiseList);
    await uploadFinish(totalChunks, file, incrementalHash.end(), parallelController);
    localStorage.removeItem(file.name);
  } catch (err) {
    console.error('Failed: ' + err);
    await Promise.allSettled(uploadPromiseList);
  }
}
