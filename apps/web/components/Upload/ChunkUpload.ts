import SparkMD5 from 'spark-md5';
import {
  customXHR,
  XhrWithTimeout,
  loadMapFromLocalStorage,
  promiseWithRetry,
  saveMapToLocalStorage,
} from './utils';
import { ParallelController } from './utils'; // 引入 ParallelController 类型

const chunkSize = 64 * 1024 * 1024; // 每个分片的大小
const chunkUploadURL = "/upload/chunk";
const finishURL = "/upload/finish";
const chance = 3; // 重试次数
const retryDelay = 1000; // 重试延迟
const timeout = 30 * 1000; // 超时时间

// 定义更新进度函数类型
type UpdateProgressFunc = (progressValue: number, status?: "active" | "success" | "exception") => void;

// 定义 uploadFinish 函数类型
const uploadFinish = async (
  totalChunks: number, // 总分片数
  file: File, // 文件对象
  incrementalHash: string, // 文件的 MD5 哈希
  parallelController: ParallelController // 并行上传控制器
): Promise<void> => {
  const finishData = new FormData();
  finishData.append('totalChunks', totalChunks.toString());
  finishData.append('fileId', file.name);
  finishData.append('hash', incrementalHash);

  let finishPromise: Promise<void>;

  await parallelController.push(() => {
    const promise = promiseWithRetry(
      async () => {
        const response = await customXHR(finishURL, {
          method: 'POST',
          body: finishData,
        });
        const json = await response.json();
        console.log(json.message);
      },
      chance,
      (error, remainingChances) => console.log(`Upload failed: ${error}\n${remainingChances} more chances`),
      () => console.error(`Upload ${file.name} failed`),
      retryDelay,
    );
    finishPromise = promise;
    return promise;
  });

  await finishPromise!;
};

// 定义 ChunkUploadFunc 函数类型
const ChunkUploadFunc = async (
  file: File, // 文件对象
  parallelController: ParallelController, // 并行上传控制器
  updateProgress: UpdateProgressFunc // 更新进度的函数
): Promise<void> => {
  const uploadPromiseList: Promise<void>[] = [];
  const uploadedIndices = loadMapFromLocalStorage(file.name) as Map<number, string>;

  try {
    let incrementalHash = new SparkMD5.ArrayBuffer(); // 用于计算文件的增量 MD5 哈希
    const totalChunks = Math.ceil(file.size / chunkSize);
    const controller = new AbortController();

    for (let i = 0; i < totalChunks; i++) {
      if (controller.signal.aborted) {
        throw new Error(controller.signal.reason?.toString() ?? 'Upload aborted.');
      }

      const start = i * chunkSize;
      const end = start + chunkSize > file.size ? file.size : start + chunkSize;
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();
      incrementalHash = incrementalHash.append(arrayBuffer);
      const chunkHash = SparkMD5.ArrayBuffer.hash(arrayBuffer);

      if (uploadedIndices.has(i)) {
        console.log(`Chunk-${i} already uploaded.`);
        updateProgress(chunkSize);
      } else {
        const formData = new FormData();
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileId', file.name);
        formData.append('hash', chunkHash);
        formData.append('chunk', chunk, `chunk-${i}`);

        await parallelController.push(() => {
          console.log(`Start uploading chunk-${i}`);
          let prevLoaded = 0;

          const promise = promiseWithRetry(
            async () => {
              const response = await XhrWithTimeout(
                (signal: AbortSignal) => customXHR(
                  chunkUploadURL,
                  { method: 'POST', body: formData, signal },
                  (evt: ProgressEvent) => {
                    if (evt.lengthComputable) {
                      updateProgress(evt.loaded - prevLoaded);
                      prevLoaded = evt.loaded;
                    }
                  }
                ), timeout
              );

              const json = await response.json();
              const result = json.message;
              console.log(`Chunk-${i} uploaded successfully.`);

              // 将上传成功的分片索引存储到 localStorage
              uploadedIndices.set(i, result);
              saveMapToLocalStorage(uploadedIndices, file.name);
            },
            chance,
            (error, remainingChances) => console.log(`Upload chunk-${i} failed: ${error}\n${remainingChances} more chances`),
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
    updateProgress(0, "success");
    localStorage.removeItem(file.name);
  } catch (err) {
    console.error('Failed: ' + err);
    updateProgress(0, "exception");
    await Promise.allSettled(uploadPromiseList);
  }
};

export default ChunkUploadFunc;
