const fileInput = document.getElementById('uploader');
const progressBar = document.getElementById('progress-bar');
const chunkSize = 1024 * 1024; // 每个分片大小为1MB
const uploadURL = window.uploadURL;
const finishURL = window.finishURL;
const maxRetries = 2;
const maxInParallel = 3;
const retryDelay = 1000;

const createForm = (file, i, totalChunks) => {
    const start = i * chunkSize;
    const end = start + chunkSize > file.size ? file.size : start + chunkSize;
    const chunk = file.slice(start, end);
    const formData = new FormData();
    formData.append('chunkIndex', i); // 分片索引
    formData.append('totalChunks', totalChunks); // 总分片数
    formData.append('fileId', file.name); // 文件唯一标识
    formData.append('chunk', chunk, `chunk-${i}`); // 分片数据
    return formData;
}

const uploadChunk = async (formData, chunkIndex) => {
    const response = await fetch(uploadURL, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        throw new Error(`Upload chunk-${chunkIndex} failed: ${response.statusText}`);
    } else {
        console.log(`Chunk-${chunkIndex} uploaded successfully.`);
        progressBar.value += chunkSize;
        return response.json();
    }
}

const uploadWithRetry = async (
    formData,
    i,
    chance,
    promiseRef,
    executing,
    retryList,
    results,
    uploadedIndices,
    file
) => {
    try {
        results[i] = await uploadChunk(formData, i);
        executing.splice(executing.findIndex(item => item === promiseRef.self), 1);
        // 将上传成功的分片索引存储到 localStorage
        uploadedIndices.add(i);
        localStorage.setItem(file.name, JSON.stringify([...uploadedIndices]));
    } catch (error) {
        console.log(error + `\n${chance} more chance`);

        const oldSelf = promiseRef.self;
        retryList.push(oldSelf);
        executing.splice(executing.findIndex(item => item === oldSelf), 1);
        if (chance) {
            // 重试前等待一段时间
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            while (executing.length >= maxInParallel) {
                await Promise.race(executing);
            }
            // 创建新的重试任务
            const newSelf = uploadWithRetry(
                formData,
                i,
                chance - 1,
                promiseRef,
                executing,
                retryList,
                results,
                uploadedIndices,
                file
            )
            promiseRef.self = newSelf;
            executing.push(newSelf);
        } else {
            throw new Error(`Chunk-${i} failed after ${maxRetries} retries`);
        }
        retryList.splice(retryList.findIndex(item => item === oldSelf), 1);
    }
};

const uploadFunc = async (file) => {
    const results = [];
    const executing = [];
    const retryList = [];
    try {
        progressBar.max = file.size;
        progressBar.value = 0;
        const totalChunks = Math.ceil(file.size / chunkSize);
        // 从 localStorage 获取已上传的分片索引
        const uploadedIndices = new Set(JSON.parse(localStorage.getItem(file.name) || '[]'));

        for (let i = 0; i < totalChunks; i++) {
            // 跳过已上传的分片
            if (uploadedIndices.has(i)) {
                console.log(`Chunk-${i} already uploaded.`);
                progressBar.value += chunkSize;
                continue;
            }

            const formData = createForm(file, i, totalChunks);

            while (executing.length >= maxInParallel) {
                await Promise.race(executing);
            }
            console.log(`Start upoading chunk-${i}`);
            const promiseRef = { self: null };
            const promise = uploadWithRetry(
                formData,
                i,
                maxRetries,
                promiseRef,
                executing,
                retryList,
                results,
                uploadedIndices,
                file
            )
            promiseRef.self = promise;
            executing.push(promise);
        }
        while (retryList.length || executing.length) {
            await Promise.all(retryList);
            await Promise.all(executing);
        }
        localStorage.removeItem(file.name);

        const finishData = new FormData();
        finishData.append('totalChunks', totalChunks)
        finishData.append('fileId', file.name)
        const response = await fetch(finishURL, {
            method: 'POST',
            body: finishData
        })
        if (!response.ok) {
            throw new Error(`Upload ${file.name} failed: ${response.statusText}`);
        } else {
            console.log(response.json());
        }
    } catch (err) {
        if (err) {
            console.error("Failed: " + err)
        } else {
            console.log("Failed.");
        }
        await Promise.allSettled(retryList);
        await Promise.allSettled(executing);
    }
}

fileInput.addEventListener("change", async (evt) => {
    const [file] = evt.target.files;
    if (!file) {
        console.log("No file.");
    } else {
        await uploadFunc(file)
        console.log("All clear");
        evt.target.value = null;
        progressBar.value = 0;
    }
});