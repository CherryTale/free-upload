const fs = require('fs');
const CryptoJS = require('crypto-js');
const multer = require('multer');
const path = require('path');
const { getFileNameWithTag, getIPFromRequest } = require('./utils.js');

// 封装延迟与丢包模拟函数
const simulateNetworkConditions = (callback) => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        callback();
    } else {
        const delay = 0 * Math.random();
        const shouldDropPacket = Math.random() < 0;

        setTimeout(() => {
            if (shouldDropPacket) {
                callback(new Error('Simulated packet loss.'));
            } else {
                callback();
            }
        }, delay);
    }
};

const setupRoutes = (expressApp, io, app, handle, uploadDir, output) => {
    // 设定 multer 存储方式
    const chunkUpload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                const chunkDir = path.join(uploadDir, req.body.fileId + '_chunks');
                fs.mkdirSync(chunkDir, { recursive: true });
                cb(null, chunkDir);
            },
            filename: (req, file, cb) => {
                cb(null, `chunk-${req.body.chunkIndex}-temp`);
            },
        }),
    });

    expressApp.post('/upload/chunk', chunkUpload.single('chunk'), async (req, res) => {
        try {
            const { chunkIndex, fileId, hash } = req.body;
            const chunkDir = path.join(uploadDir, fileId + '_chunks');
            const tempFilePath = path.join(chunkDir, req.file.filename);
            const targetFilePath = path.join(chunkDir, req.file.filename.replace('-temp', ''));

            // 读取文件并计算 MD5 哈希
            const fileBuffer = fs.readFileSync(tempFilePath); // 读取文件内容
            const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
            const localHash = CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);

            simulateNetworkConditions((error) => {
                if (error) {
                    res.status(500).json({ message: `Chunk-${chunkIndex} upload failed due to ${error.message}` });
                    return;
                }

                if (localHash === hash) {
                    fs.renameSync(tempFilePath, targetFilePath);
                    res.status(200).json({ message: `Chunk-${chunkIndex} uploaded successfully.` });
                } else {
                    fs.rmSync(tempFilePath);
                    throw new Error('File Corrupted');
                }
            });
        } catch (err) {
            res.status(500).json({ message: `Failed. ${err}` });
        }
    });

    expressApp.post('/upload/finish', chunkUpload.none(), async (req, res) => {
        try {
            const { fileId, hash, totalChunks } = req.body;
            const chunkDir = path.join(uploadDir, fileId + '_chunks');
            // 检查是否所有分片都已经上传完成
            const chunkFiles = fs.readdirSync(chunkDir);
            const allChunksUploaded = new Array(parseInt(totalChunks))
                .fill(0)
                .map((_, i) => `chunk-${i}`)
                .every(chunkName => chunkFiles.includes(chunkName));

            if (allChunksUploaded) {
                // 合并分片
                const filePath = path.join(uploadDir, getFileNameWithTag(fileId));
                const writeStream = fs.createWriteStream(filePath);
                for (let i = 0; i < totalChunks; i++) {
                    const data = fs.readFileSync(path.join(chunkDir, `chunk-${i}`));
                    writeStream.write(data);
                }
                writeStream.end();

                writeStream.on('finish', () => {
                    // 读取文件并计算 MD5 哈希
                    const fileBuffer = fs.readFileSync(filePath); // 读取文件内容
                    const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
                    const localHash = CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);
                    if (localHash !== hash) {
                        res.status(500).json({ message: `Failed. File Corrupted` });
                    } else {
                        fs.rmSync(chunkDir, { recursive: true, force: true });
                        output.appendLine(filePath);
                        res.status(200).json({ message: 'All chunks uploaded successfully.' });
                        io.emit('chat message', { from: 'server', msg: `Received ${fileId}` });
                    }
                });
            } else {
                throw new Error('missing chunk');
            }
        } catch (err) {
            res.status(500).json({ message: `Failed. ${err}` });
        }
    });

    const upload = multer({
        storage: multer.diskStorage({
            destination: function (req, file, cb) {
                fs.mkdirSync(uploadDir, { recursive: true });
                cb(null, uploadDir);
            },
            filename: function (req, file, cb) {
                cb(null, getFileNameWithTag(req.body.fileName));
            },
        }),
    });

    expressApp.post('/upload', upload.single('file'), (req, res) => {
        const filePath = path.join(uploadDir, getFileNameWithTag(req.body.fileName));
        output.appendLine(filePath);

        simulateNetworkConditions((error) => {
            if (error) {
                res.status(500).json({ message: `File upload failed due to ${error.message}` });
                return;
            }
            res.status(200).json({ message: 'All files uploaded successfully.' });
            io.emit('chat message', { from: 'server', msg: `Received ${req.body.fileName}` });
        });
    });

    // 处理所有其他请求，交给 Next.js 进行处理
    expressApp.all('*', (req, res) => {
        return handle(req, res);
    });
};

// 使用 CommonJS 模块的导出语法
module.exports = { setupRoutes };
