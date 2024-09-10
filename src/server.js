const os = require('os');
const fs = require('fs').promises;
const vscode = require('vscode');
const http = require('http');
const express = require('express');
const fileUpload = require('express-fileupload');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const { getFileNameWithTag } = require('./utils.js');

function createThenStartServer(ip, port, output) {
  const uploadURL = '/upload';
  const chatURL = '/chat';
  const uploadDir = vscode.workspace.getConfiguration('free-upload').get('uploadFolder', '') || path.join(os.homedir(), 'uploads');
  let qrCodeRef = null;
  // 用于存储聊天消息的数组
  const messageHistory = [];

  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  app.use(fileUpload());
  app.use(express.static(path.join(__dirname, 'views', 'static')));
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs').__express);

  app.get('/', (req, res) => {
    res.render(path.join(__dirname, 'views', 'index.ejs'), {
      uploadRoute: `http://${ip}:${port}${uploadURL}`,
      qrCode: qrCodeRef,
    });

    let sourceAddr = req.ip;
    if (sourceAddr.substr(0, 7) == "::ffff:") {
      sourceAddr = sourceAddr.substr(7)
    }
    output.appendLine(`${sourceAddr} connected`);
    // vscode.window.showInformationMessage(`${sourceAddr} connected`);
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
        // vscode.window.showInformationMessage("Received " + fileName);
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
    console.log('A user connected:', userIp);
    // 将历史消息发送给新连接的客户端
    socket.emit('chat history', messageHistory);

    socket.on('chat message', (msg) => {
      console.log(`Client: ${msg}`); // 在控制台显示来自客户端的消息

      // 将新消息添加到历史数组
      messageHistory.push(msg);

      // 广播给所有连接的客户端
      io.emit('chat message', msg);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userIp}`);
    });
  });

  const runningServer = server.listen(port, () => {
    QRCode.toDataURL(`http://${ip}:${port}`, { errorCorrectionLevel: 'H' }, (err, url) => {
      if (err) {
        output.appendLine(err);
        return;
      } else {
        qrCodeRef = url;
        vscode.env.openExternal(`http://${ip}:${port}`);
      }
    });
  });

  const stopServer = () => {
    io.emit('chat message', 'The server is shutting down.'); // 通知所有客户端服务器正在关闭
    runningServer.close();
    io.close();
    output.appendLine('Server stopped');
  }
  process.on('SIGTERM', stopServer);
  process.on('SIGINT', stopServer);
  return stopServer;
}

// eslint-disable-next-line no-undef
module.exports = createThenStartServer;