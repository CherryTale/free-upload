import SparkMD5 from 'spark-md5';
import { customXHR, XhrWithTimeout, promiseWithRetry } from './utils';
import { ParallelController } from './utils'; // 引入 ParallelController 类型

const singleUploadURL = "/upload";
const chance = 3;
const retryDelay = 1000;
const timeout = 30 * 1000;

// 定义更新进度函数类型
type UpdateProgressFunc = (progressValue: number, status?: "active" | "success" | "exception") => void;

// SingleUploadFunc 函数类型定义
const SingleUploadFunc = async (
  file: File, // 文件类型
  parallelController: ParallelController, // 并行上传控制器
  updateProgress: UpdateProgressFunc // 进度更新函数
): Promise<void> => { // 返回类型为 Promise<void>
  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileHash = SparkMD5.ArrayBuffer.hash(arrayBuffer);

    const formData = new FormData();
    formData.append('fileName', file.name);
    formData.append('hash', fileHash);
    formData.append('file', file);

    let singleUploadPromise: Promise<void>;

    await parallelController.push(() => {
      console.log(`Start uploading ${file.name}`);
      let prevLoaded = 0;

      const promise = promiseWithRetry(
        async () => {
          await XhrWithTimeout(signal => customXHR(
            singleUploadURL,
            { method: 'POST', body: formData, signal },
            (evt: ProgressEvent) => {
              if (evt.lengthComputable) {
                updateProgress(evt.loaded - prevLoaded);
                prevLoaded = evt.loaded; // 更新已加载数据量
              }
            }
          ), timeout);
          console.log(`${file.name} uploaded successfully.`);
        },
        chance,
        (error, remainingChances) => console.log(`Upload ${file.name} failed: ${error}\n${remainingChances} more chances`),
        () => console.error(`Failed: Upload ${file.name} failed after ${chance} attempts`),
        retryDelay,
      );

      singleUploadPromise = promise;
      return promise;
    });

    await singleUploadPromise!;
    updateProgress(0, "success");
  } catch (err) {
    console.error(`Failed: ${err}`);
    updateProgress(0, "exception");
  }
};

export default SingleUploadFunc;
