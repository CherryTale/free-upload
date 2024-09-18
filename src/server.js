const os = require('os');
const fs = require('fs').promises;
const vscode = require('vscode');
const http = require('http');
const express = require('express');
const fileUpload = require('express-fileupload');
const socketIo = require('socket.io');
const qr = require('qrcode-terminal');
const path = require('path');
const ngrok = require('ngrok');
const { getFileNameWithTag, getIPFromRequest } = require('./utils.js');

function createThenStartServer(ip, port, output) {
  const uploadURL = '/upload';
  const uploadDir = vscode.workspace.getConfiguration('free-upload').get('uploadFolder', '') || path.join(os.homedir(), 'uploads');
  const authtoken = vscode.workspace.getConfiguration('free-upload').get('authToken', '') || "2mG3aOFfRr6VRESr6skE4d1XmCX_3SZamRMDWBNNmFdW731BQ";
  // 用于存储聊天消息的数组
  const messageHistory = [];

  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  app.use(fileUpload());
  app.use(express.static(path.join(__dirname, 'views', 'static')));
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs').__express);

  app.get('/', async (req, res) => {
    res.render(path.join(__dirname, 'views', 'index.ejs'), {
      uploadRoute: `http://${ip}:${port}${uploadURL}`,
    });

    const reqIp = getIPFromRequest(req);
    output.appendLine(`${reqIp} connected`);
    io.emit('chat message', `Server: ${reqIp} connected`);
  });

  app.post(uploadURL, async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }

    let files = req.files.uploadFiles;
    files = Array.isArray(files) ? files : [files];

    try {
      await fs.mkdir(uploadDir, { recursive: true });

      const uploadPromises = files.map(async (file) => {
        const fileName = Buffer.from(file.name, "latin1").toString("utf8");
        const filePath = path.join(uploadDir, getFileNameWithTag(fileName));
        await fs.writeFile(filePath, file.data);
        output.appendLine('file://' + filePath);
        io.emit('chat message', `Server: Received ${fileName} from ${getIPFromRequest(req)}`);
        return fileName;
      });
      const uploadedFileNames = await Promise.all(uploadPromises);
      res.send(`Files uploaded successfully: ${uploadedFileNames.join(', ')}`);
    } catch (err) {
      output.appendLine('Error during file upload: ' + err);
      res.status(500).send('An error occurred while uploading files.');
    }
  });

  io.on('connection', (socket) => {
    const { address } = socket.handshake;
    const userIp = address.substr(0, 7) === "::ffff:" ? address.substr(7) : address;
    // 将历史消息发送给新连接的客户端
    socket.emit('chat history', messageHistory);

    socket.on('chat message', (msg) => {

      // 将新消息添加到历史数组
      messageHistory.push(msg);

      // 广播给所有连接的客户端
      io.emit('chat message', msg);
    });

    socket.on('disconnect', () => {
      output.appendLine(`${userIp} disconnected`);
    });
  });

  const runningServer = server.listen(port, async () => {
    const localUrl = `http://${ip}:${port}`;

    try {
      if (!authtoken) {
        throw new Error('authtoken not found');
      }
      const remoteUrl = await ngrok.connect({
        addr: port,
        authtoken,
      });

      qr.generate(remoteUrl, { small: true }, (qrcode) => {
        const lines = qrcode.split('\n');
        const filtered = lines.filter(line => line.trim() !== '');
        filtered[filtered.length - 3] += "\tServer is running on 🌐 " + remoteUrl;
        filtered[filtered.length - 2] += "\tLocal address: " + localUrl;
        filtered[filtered.length - 1] += "\tReceiving files in 📁 file://" + uploadDir;

        output.appendLine('\n' + filtered.join('\n'));
      });

      output.appendLine(`ngrok tunnel established at ${remoteUrl}`);
    } catch (err) {
      output.appendLine(`ngrok tunnel failed: ${err}. Falling back to local URL.`);
      qr.generate(localUrl, { small: true }, (qrcode) => {
        const lines = qrcode.split('\n');
        const filtered = lines.filter(line => line.trim() !== '');
        filtered[filtered.length - 3] += "\tServer is running on 🌐 " + localUrl;
        filtered[filtered.length - 2] += "\tReceiving files in 📁 file://" + uploadDir;
        filtered[filtered.length - 1] += "\tBe sure you are using the 🚨️ same network.";

        output.appendLine('\n' + filtered.join('\n'));
      });
    }
  });

  const stopServer = () => {
    io.emit('chat message', 'Server: The server is shutting down.'); // 通知所有客户端服务器正在关闭
    runningServer.close(err => {
      if (err) {
        output.appendLine(`Error stopping server: ${err}`);
      }
      io.close();
      output.appendLine('Server stopped');
    });
    ngrok.disconnect();
  };
  process.on('SIGTERM', stopServer);
  process.on('SIGINT', stopServer);
  return {
    stopServer,
    url: `http://${ip}:${port}`,
  };
}

module.exports = createThenStartServer;