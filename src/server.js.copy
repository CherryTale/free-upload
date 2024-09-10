const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const CryptoJS = require('crypto-js');
const express = require('express');
const multer = require('multer');
const qr = require('qrcode-terminal');
const { getFileNameWithTag } = require('./utils.js');

function createThenStartServer(ip, port, uploadURL, uploadDir) {
  const app = express();
  app.use(express.static(path.join(__dirname, 'views', 'static')));

  app.get(uploadURL, (req, res) => {
    res.render(
      path.join(__dirname, 'views', 'legacy.ejs'),
      {
        chunkUploadURL: `http://${ip}:${port}/upload/chunk`,
        finishURL: `http://${ip}:${port}/upload/finish`,
        singleUploadURL: `http://${ip}:${port}/upload`,
      },
    );
  });

  // 设定multer存储方式
  const chunkUpload = multer({
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        const chunkDir = path.join(uploadDir, req.body.fileId + '_chunks');
        fs.mkdirSync(chunkDir, { recursive: true });
        cb(null, chunkDir);
      },
      filename: function (req, file, cb) {
        cb(null, `chunk-${req.body.chunkIndex}-temp`);
      },
    }),
  });

  app.post('/upload/chunk', chunkUpload.single('chunk'), async (req, res) => {
    try {
      if (Math.random() < 0.05) {
        return res.status(503).json({ message: 'Service Unavailable - Simulated Packet Loss' });
      }

      const { chunkIndex, fileId, hash } = req.body;
      const chunkDir = path.join(uploadDir, fileId + '_chunks');
      const tempFilePath = path.join(chunkDir, req.file.filename);
      const targetFilePath = path.join(chunkDir, req.file.filename.replace('-temp', ''));

      // 读取文件并计算 MD5 哈希
      const fileBuffer = fs.readFileSync(tempFilePath); // 读取文件内容
      const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
      const localHash = CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);

      if (localHash === hash) {
        fs.renameSync(tempFilePath, targetFilePath);

        setTimeout(() => {
          res.status(200).json({ message: `Chunk-${chunkIndex} uploaded successfully.` });
        }, Math.floor(Math.random() * 300));
      } else {
        fs.rm(tempFilePath);
        throw new Error('File Corrupted');
      }
    } catch (err) {
      res.status(500).json({ message: `Failed. ${err}` })
    }
  });

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
            console.log(filePath);
            res.status(200).json({ message: 'All chunks uploaded successfully.' });
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

  app.post('/upload', upload.single('file'), (req, res) => {
    const filePath = path.join(uploadDir, getFileNameWithTag(req.body.fileName));
    console.log(filePath);
    setTimeout(() => {
      res.status(200).json({ message: 'All files uploaded successfully.' });
    }, Math.floor(Math.random() * 300));
  })

  app.listen(port, () => {
    qr.generate(`http://${ip}:${port}${uploadURL}`, { small: true }, (qrcode) => {
      console.log(qrcode);
      console.log('Server is running on 🌐 ' + chalk.green(`http://${ip}:${port}${uploadURL}`));
      console.log('Receiving files in 📁 ' + chalk.green(uploadDir));
      console.log('Be sure you are using the 🚨️ ' + chalk.yellow('same network.'));
    });
  });
}

module.exports = createThenStartServer;
