// 保存 Map 到 localStorage
export const saveMapToLocalStorage = (map: Map<number, string>, storageKey: string): void => {
  const mapArray = Array.from(map);
  const mapJson = JSON.stringify(mapArray);
  localStorage.setItem(storageKey, mapJson);
};

// 从 localStorage 加载 Map
export const loadMapFromLocalStorage = (storageKey: string): Map<number, string> => {
  const mapJson = localStorage.getItem(storageKey);
  if (mapJson === null) {
    return new Map<number, string>();
  } else {
    const mapArray: [number, string][] = JSON.parse(mapJson);
    return new Map<number, string>(mapArray);
  }
};

// 带有超时功能的 XHR
export const XhrWithTimeout = async (
  promiseGenerator: (signal: AbortSignal) => Promise<{ json: () => Promise<any> }>,
  timeout: number
): Promise<{ json: () => Promise<any> }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await promiseGenerator(controller.signal);
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Timed out after ${timeout} ms`);
    } else {
      throw error;
    }
  }
};

// 自定义的 XMLHttpRequest 封装
interface CustomXHROptions {
  method?: string;
  headers?: Record<string, string>;
  body?: XMLHttpRequestBodyInit | null;
  signal?: AbortSignal;
}

export const customXHR = (
  url: string,
  options: CustomXHROptions = {},
  onprogress: (event: ProgressEvent) => void = () => { }
): Promise<{ json: () => Promise<any> }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', url);
    Object.entries(options.headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ json: () => Promise.resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null) });
      } else {
        reject(new Error(`Request failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network Error'));
    };

    xhr.upload.onprogress = onprogress;

    options.signal?.addEventListener('abort', () => {
      xhr.abort();
      reject(new Error('Request aborted'));
    });

    xhr.send(options.body || null);
  });
};

// 带重试功能的 Promise 执行函数
export const promiseWithRetry = async <T>(
  promiseGenerator: () => Promise<T>,
  chance: number,
  beforeRetry: (error: any, remainingChances: number) => void = () => { },
  afterAllFailed: () => void = () => { },
  retryDelay: number = 0
): Promise<T> => {
  while (chance--) {
    try {
      return await promiseGenerator();
    } catch (error) {
      beforeRetry(error, chance);
      if (chance) {
        // 重试前等待一段时间
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  afterAllFailed();
  throw new Error('All retry attempts failed.');
};

// 并行控制器类
export class ParallelController {
  private maxInParallel: number;
  private executing: Promise<void>[];

  constructor(maxInParallel: number) {
    this.maxInParallel = maxInParallel;
    this.executing = [];
  }

  async push(promiseGenerator: () => Promise<void>): Promise<void> {
    while (this.executing.length >= this.maxInParallel) {
      await Promise.race(this.executing);
    }

    const promise = promiseGenerator();

    promise.catch(() => { }).finally(() => {
      // 从执行队列中移除已完成的任务
      const index = this.executing.findIndex(item => item === promise);
      if (index > -1) {
        this.executing.splice(index, 1);
      }
    });

    this.executing.push(promise);
  }
}
