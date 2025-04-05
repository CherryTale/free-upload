import fs from 'fs';
import CryptoJS from 'crypto-js';
import multer from 'multer';
import path from 'path';
import { Server as SocketIoServer } from 'socket.io';
import { Express, Request, Response, NextFunction } from 'express';
import { NextServer } from 'next/dist/server/next';
import { OutputChannel } from 'vscode';
import { getFileNameWithTag, getIPFromRequest } from './utils';
import { Application, RequestHandler } from 'express';
import { Server } from 'socket.io';

// 封装延迟与丢包模拟函数
const simulateNetworkConditions = (callback: (error?: Error) => void): void => {
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

    // 配置 multer 用于文件上传
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });

    const upload = multer({ storage });

    // 文件上传路由
    const uploadHandler: RequestHandler = (req, res, next) => {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const fileInfo = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: path.join(uploadDir, req.file.filename)
        };

        output.appendLine(`File uploaded: ${JSON.stringify(fileInfo)}`);
        io.emit('file uploaded', fileInfo);
        res.json(fileInfo);
    };

    app.post('/upload', upload.single('file'), uploadHandler);

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
                return {
                    filename,
                    size: stats.size,
                    created: stats.birthtime
                };
            });

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