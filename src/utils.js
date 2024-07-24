const os = require('os');
const net = require('net');

function getInternalIP() {
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
}

function getFreePort(start, end) {
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
      server.on('error', (err) => {
        setImmediate(() => testPort(port + 1));
      });
    };
    testPort(start);
  });
}

function getFileNameWithTag(fileName) {
  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString();
  const fileNameWithTag = `${date}_${time}_${fileName}`;
  const regex = /[ :\/\\*?"<>|]/g;
  return fileNameWithTag.replace(regex, '_');
}

module.exports = { getInternalIP, getFreePort, getFileNameWithTag };
