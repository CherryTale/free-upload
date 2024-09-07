export const saveMapToLocalStorage = (map, storageKey) => {
  const mapArray = Array.from(map);
  const mapJson = JSON.stringify(mapArray);
  localStorage.setItem(storageKey, mapJson);
}

export const loadMapFromLocalStorage = (storageKey) => {
  const mapJson = localStorage.getItem(storageKey);
  if (mapJson === null) {
    return new Map();
  } else {
    const mapArray = JSON.parse(mapJson);
    return new Map(mapArray);
  }
}

export const fetchWithTimeout = async (promiseGenerator, timeout) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await promiseGenerator(controller.signal);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timed out after ${timeout} ms`);
    } else {
      throw error;
    }
  }
}

export const customXHR = (url, options = {}, onprogress = () => { }) => {
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

export const promiseWithRetry = async (
  promiseGenerator,
  chance,
  beforeRetry = () => { },
  afterAllFailed = () => { },
  retryDelay = 0,
) => {
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
};

export class ParallelController {
  constructor(maxInParallel) {
    this.maxInParallel = maxInParallel;
    this.executing = [];
  }

  async push(promiseGenerator) {
    while (this.executing.length >= this.maxInParallel) {
      await Promise.race(this.executing);
    }
    const promise = promiseGenerator();
    promise.catch(() => { }).finally(() => {
      this.executing.splice(this.executing.findIndex(item => item === promise), 1);
    })
    this.executing.push(promise);
  }
}
