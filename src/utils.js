const os = require('os');
const net = require('net');

const getInternalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interfaceInfo of interfaces[name]) {
            // 忽略IPv6、内部环回地址（如127.0.0.1）和未分配的地址
            if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal && interfaceInfo.address !== '127.0.0.1') {
                return interfaceInfo.address;
            }
        }
    }
    throw new Error('No internal IP found');
};

const getFreePort = (start, end) => {
    return new Promise((resolve, reject) => {
        const testPort = (port) => {
            if (port === end) {
                reject('No free port found');
            }
            const server = net.createServer().listen(port, () => {
                server.once('close', () => {
                    resolve(port);
                });
                server.close();
            });
            server.on('error', () => {
                setImmediate(() => testPort(port + 1));
            });
        };
        testPort(start);
    });
};

const getFileNameWithTag = (fileName) => {
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString();
    const fileNameWithTag = `${date}_${time}_${fileName}`;
    const regex = /[ :\/\\*?"<>|]/g;
    return fileNameWithTag.replace(regex, '_');
};

const getIPFromRequest = (req) => {
    let sourceAddr = req?.ip;
    if (sourceAddr?.substr(0, 7) === "::ffff:") {
        sourceAddr = sourceAddr.substr(7);
    }
    return sourceAddr;
};

const serverListen = (server, port) => {
    return new Promise((res, rej) => {
        try {
            server.listen(port, () => {
                res(server);
            });
        } catch (err) {
            rej(err);
        }
    });
};


const serverClose = (server, timeout = 10000) => {
    return new Promise((res, rej) => {
        const timer = setTimeout(() => {
            rej(new Error('Server close timeout'));
        }, timeout);

        server.close((err) => {
            clearTimeout(timer);
            if (err) {
                rej(err);
            } else {
                res();
            }
        });
    });
};

module.exports = {
    getInternalIP,
    getFreePort,
    getFileNameWithTag,
    getIPFromRequest,
    serverListen,
    serverClose,
};
