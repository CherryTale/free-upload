import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { Server } from 'socket.io';
import { Request, Response, NextFunction, Application, RequestHandler } from 'express';
import { NextServer } from 'next/dist/server/next';
import { OutputChannel } from 'vscode';
import { getFileNameWithTag, simulateNetworkConditions } from './utils';

export const setupRoutes = (
    app: Application,
    io: Server,
    nextApp: NextServer,
    handle: (req: Request, res: Response) => Promise<void>,
    uploadDir: string,
    output: OutputChannel
): void => {
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 配置分片上传的 multer
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

    // 分片上传路由
    app.post('/upload/chunk', chunkUpload.single('chunk'), async (req, res) => {
        try {
            const { chunkIndex, fileId, hash } = req.body;
            const chunkDir = path.join(uploadDir, fileId + '_chunks');
            const tempFilePath = path.join(chunkDir, req.file!.filename);
            const targetFilePath = path.join(chunkDir, req.file!.filename.replace('-temp', ''));

            // 读取文件并计算 MD5 哈希
            const fileBuffer = fs.readFileSync(tempFilePath);
            const localHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

            simulateNetworkConditions((error) => {
                if (error) {
                    output.appendLine(`Chunk-${chunkIndex} upload failed due to ${error.message}`);
                    res.status(500).json({ message: `Chunk-${chunkIndex} upload failed due to ${error.message}` });
                    return;
                }

                if (localHash === hash) {
                    fs.renameSync(tempFilePath, targetFilePath);
                    output.appendLine(`Chunk-${chunkIndex} uploaded successfully.`);
                    res.status(200).json({ message: `Chunk-${chunkIndex} uploaded successfully.` });
                } else {
                    fs.rmSync(tempFilePath);
                    output.appendLine(`Hash verification failed for chunk-${chunkIndex}`);
                    output.appendLine(`Client hash: ${hash}, Server hash: ${localHash}`);
                    throw new Error('File Corrupted');
                }
            });
        } catch (err) {
            output.appendLine(`Failed to upload chunk-${req.body.chunkIndex}: ${err}`);
            res.status(500).json({ message: `Failed. ${err}` });
        }
    });

    // 分片上传完成路由
    app.post('/upload/finish', chunkUpload.none(), async (req, res) => {
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
                const hashStream = crypto.createHash('md5');

                // 使用流式处理合并分片
                for (let i = 0; i < totalChunks; i++) {
                    const chunkPath = path.join(chunkDir, `chunk-${i}`);
                    const chunkStream = fs.createReadStream(chunkPath);
                    
                    await new Promise<void>((resolve, reject) => {
                        chunkStream
                            .on('data', (chunk) => {
                                writeStream.write(chunk);
                                hashStream.update(chunk);
                            })
                            .on('end', () => resolve())
                            .on('error', reject);
                    });
                }

                writeStream.end();

                writeStream.on('finish', () => {
                    const localHash = hashStream.digest('hex');
                    if (localHash !== hash) {
                        output.appendLine(`Hash verification failed for file: ${fileId}`);
                        output.appendLine(`Client hash: ${hash}, Server hash: ${localHash}`);
                        res.status(500).json({ message: `Failed. File Corrupted` });
                    } else {
                        fs.rmSync(chunkDir, { recursive: true, force: true });
                        output.appendLine('file://' + filePath);
                        res.status(200).json({ message: 'All chunks uploaded successfully.' });
                        io.emit('chat message', { from: 'server', msg: `Received ${fileId}` });
                    }
                });
            } else {
                output.appendLine(`Missing chunks for file: ${fileId}`);
                throw new Error('missing chunk');
            }
        } catch (err) {
            output.appendLine(`Failed to finish upload: ${err}`);
            res.status(500).json({ message: `Failed. ${err}` });
        }
    });

    // 配置单文件上传的 multer
    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                fs.mkdirSync(uploadDir, { recursive: true });
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                cb(null, getFileNameWithTag(req.body.fileName));
            },
        }),
    });

    // 单文件上传路由
    app.post('/upload', upload.single('file'), (req, res) => {
        const filePath = path.join(uploadDir, getFileNameWithTag(req.body.fileName));
        output.appendLine('file://' + filePath);

        simulateNetworkConditions((error) => {
            if (error) {
                output.appendLine(`File upload failed due to ${error.message}`);
                res.status(500).json({ message: `File upload failed due to ${error.message}` });
                return;
            }
            res.status(200).json({ message: 'All files uploaded successfully.' });
            io.emit('chat message', { from: 'server', msg: `Received ${req.body.fileName}` });
        });
    });

    // 获取上传的文件列表
    const listFilesHandler: RequestHandler = (req, res, next) => {
        fs.readdir(uploadDir, (err, files) => {
            if (err) {
                output.appendLine(`Error reading upload directory: ${err}`);
                res.status(500).json({ error: 'Failed to read files' });
                return;
            }

            const fileList = files.map(filename => {
                const filePath = path.join(uploadDir, filename);
                const stats = fs.statSync(filePath);
                const fileBuffer = fs.readFileSync(filePath);
                const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
                
                return {
                    filename,
                    size: stats.size,
                    created: stats.birthtime,
                    hash: fileHash
                };
            });

            output.appendLine(`Found ${files.length} files in upload directory`);
            res.json(fileList);
        });
    };

    app.get('/files', listFilesHandler);

    // 处理所有其他请求通过 Next.js
    app.all('*', async (req: Request, res: Response, next: NextFunction) => {
        try {
            await handle(req, res);
        } catch (error) {
            next(error);
        }
    });
}; 