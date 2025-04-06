import os from 'os';
import net from 'net';
import { Request } from 'express';
import { Server } from 'http';

export const getInternalIP = (): string => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const networkInterface = interfaces[name];
        if (!networkInterface) continue;

        for (const info of networkInterface) {
            if (info.family === 'IPv4' && !info.internal) {
                return info.address;
            }
        }
    }
    return 'localhost';
};

export const getFreePort = async (start: number, end: number): Promise<number> => {
    for (let port = start; port <= end; port++) {
        try {
            const server = net.createServer();
            await new Promise<void>((resolve, reject) => {
                server.on('error', reject);
                server.listen(port, () => {
                    server.close(() => resolve());
                });
            });
            return port;
        } catch {
            continue;
        }
    }
    throw new Error(`No free port found between ${start} and ${end}`);
};

export const getFileNameWithTag = (fileName: string): string => {
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString();
    const fileNameWithTag = `${date}_${time}_${fileName}`;
    const regex = /[ :\/\\*?"<>|]/g;
    return fileNameWithTag.replace(regex, '_');
};

export const getIPFromRequest = (req: Request): string | undefined => {
    let sourceAddr = req?.ip;
    if (sourceAddr?.substr(0, 7) === "::ffff:") {
        sourceAddr = sourceAddr.substr(7);
    }
    return sourceAddr;
};

export const serverListen = (server: Server, port: number): Promise<Server> => {
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(port, () => {
            resolve(server);
        });
    });
};

export const serverClose = (server: Server): Promise<void> => {
    return new Promise((resolve, reject) => {
        server.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

export const simulateNetworkConditions = (callback: (error?: Error) => void): void => {
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