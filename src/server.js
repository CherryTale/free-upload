const os = require('os');
const fs = require('fs').promises;
const vscode = require('vscode');
const express = require('express');
const fileUpload = require('express-fileupload');
const qr = require('qrcode-terminal');
const path = require('path');
const { getFileNameWithTag } = require('./utils.js');

function createThenStartServer(ip, port, output) {
  const uploadURL = '/upload';
  let uploadDir = vscode.workspace.getConfiguration('free-upload').get('uploadFolder', path.join(os.homedir(), 'uploads'));
  if (!uploadDir) {
    uploadDir = path.join(os.homedir(), 'uploads');
  }

  const app = express();
  app.use(fileUpload());
  app.use(express.static(path.join(__dirname, 'views', 'static')));

  app.get(uploadURL, (req, res) => {
    res.render(path.join(__dirname, 'views', 'index.ejs'), { uploadRoute: `http://${ip}:${port}${uploadURL}` });

    let sourceAddr = req.ip;
    if (sourceAddr.substr(0, 7) == "::ffff:") {
      sourceAddr = sourceAddr.substr(7)
    }
    output.appendLine(`${sourceAddr} connected`);
    vscode.window.showInformationMessage(`${sourceAddr} connected`);
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
        vscode.window.showInformationMessage("Received " + fileName);
        return fileName;
      });
      const uploadedFileNames = await Promise.all(uploadPromises);
      res.send(`Files uploaded successfully: ${uploadedFileNames.join(', ')}`);
    } catch (err) {
      output.appendLine('Error during file upload:' + err);
      res.status(500).send('An error occurred while uploading files.');
    }
  });

  const server = app.listen(port, () => {
    qr.generate(`http://${ip}:${port}${uploadURL}`, { small: true }, (qrcode) => {
      const lines = qrcode.split('\n');
      const filtered = lines.filter(line => line.trim() !== '');
      filtered[filtered.length - 3] += "\tServer is running on 🌐 " + `http://${ip}:${port}${uploadURL}`;
      filtered[filtered.length - 2] += "\tReceiving files in 📁 file://" + uploadDir;
      filtered[filtered.length - 1] += "\tBe sure you are using the 🚨️ same network.";

      output.appendLine('\n' + filtered.join('\n'));
    });
  });

  function stopServer() {
    server.close(() => {
      output.appendLine('Gracefully Shutdown');
    });
  }
  process.on('SIGTERM', stopServer);
  process.on('SIGINT', stopServer);

  return stopServer;
}

// eslint-disable-next-line no-undef
module.exports = createThenStartServer;