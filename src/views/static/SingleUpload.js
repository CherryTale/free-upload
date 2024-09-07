import {
  customXHR,
  fetchWithTimeout,
  promiseWithRetry,
} from './utils.js';

const singleUploadURL = window.singleUploadURL;
const SparkMD5 = window.SparkMD5;
const chance = 3;
const retryDelay = 1000;
const timeout = Math.pow(2, 31) - 1;

export default async (file, parallelController, progressBar) => {
  progressBar.max = file.size;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileHash = SparkMD5.ArrayBuffer.hash(arrayBuffer);
    const formData = new FormData();
    formData.append('fileName', file.name);
    formData.append('hash', fileHash);
    formData.append('file', file);

    let singleUploadPromise;
    await parallelController.push(() => {
      console.log(`Start upoading ${file.name}`);
      const promise = promiseWithRetry(
        async () => {
          await fetchWithTimeout(signal => customXHR(
            singleUploadURL,
            { method: 'POST', body: formData, signal },
            evt => {
              if (evt.lengthComputable) {
                progressBar.value = evt.loaded;
              }
            }
          ), timeout);
          console.log(`${file.name} uploaded successfully.`);
        }, chance,
        (error, chance) => console.log(`Upload ${file.name} failed: ${error}\n${chance} more chance`),
        () => console.error(`Failed: Upload ${file.name} failed after ${chance} attempts`),
        retryDelay,
      );
      singleUploadPromise = promise;
      return promise;
    });
    await singleUploadPromise;
  } catch (err) {
    console.error('Failed: ' + err);
  }
}
