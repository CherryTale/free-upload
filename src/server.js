const express = require('express');
const fileUpload = require('express-fileupload');
const qr = require('qrcode-terminal');
const path = require('path');
const fs = require('fs').promises;

const vscode = require('vscode');
const output = vscode.window.createOutputChannel('Upload');
output.show();

//const chalk = require('chalk');
const { getFileNameWithTag } = require('./utils.js');

function createThenStartServer(ip, port, uploadURL, uploadDir) {
  const app = express();
  app.use(fileUpload());
  app.use(express.static(path.join(__dirname, 'views', 'static')));

  app.get(uploadURL, (req, res) => {
    res.render(path.join(__dirname, 'views', 'index.ejs'), { uploadRoute: `http://${ip}:${port}${uploadURL}` });
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
        const filePath = path.join(uploadDir, getFileNameWithTag(file.name));
        await fs.writeFile(filePath, file.data);
        output.appendLine('file://' + filePath);
        return file.name;
      });
      const uploadedFileNames = await Promise.all(uploadPromises);
      res.send(`Files uploaded successfully: ${uploadedFileNames.join(', ')}`);
    } catch (err) {
      output.appendLine('Error during file upload:' + err);
      res.status(500).send('An error occurred while uploading files.');
    }
  });

  app.listen(port, () => {
    qr.generate(`http://${ip}:${port}${uploadURL}`, { small: true }, (qrcode) => {
      output.appendLine(qrcode);
      //output.appendLine(chalk.green(`Server is running on http://${ip}:${port}${uploadURL}`));
      //output.appendLine(chalk.green(`Receiving files in ${uploadDir}`));
      output.appendLine("Server is running on 🌐 " + `http://${ip}:${port}${uploadURL}`);
      output.appendLine("Receiving files in 📁 file://" + uploadDir);
      output.appendLine("Be sure you are using the 🚨️ " + "same network.");
    });
  });
}

module.exports = createThenStartServer;