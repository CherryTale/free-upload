import dotenv from 'dotenv';
import os from 'os';
import http from 'http';
import { Server as SocketIoServer } from 'socket.io';
import express from 'express';
import vscode from 'vscode';
import qr from 'qrcode-terminal';
import ngrok from '@ngrok/ngrok';
import next from 'next';
import path from 'path';
import { getInternalIP, getFreePort, serverListen, serverClose } from './utils';
import { setupSocketEvents } from './socket';
import { setupRoutes } from './routes';

dotenv.config();

interface ServerInfo {
  stopServer: () => Promise<void>;
  remoteUrl?: string;
  localUrl: string;
}

const createThenStartServer = async (output: vscode.OutputChannel): Promise<ServerInfo> => {
  const ip = getInternalIP();
  const port = await getFreePort(3000, 4000);

  const localUrl = `http://${ip}:${port}`;
  let remoteUrl: string | undefined;
  const uploadDir = vscode.workspace.getConfiguration('free-upload').get('uploadFolder', '') || path.join(os.homedir(), 'uploads');
  const authtoken = vscode.workspace.getConfiguration('free-upload').get('authToken', '') || process.env.NGROK_AUTH_TOKEN;

  // 初始化 Next.js 应用
  const app = next({
    dev: process.env.NODE_ENV !== 'production',
    dir: path.resolve(__dirname, './fe')
  });
  const handle = app.getRequestHandler();
  await app.prepare();

  const expressApp = express();
  const server = http.createServer(expressApp);
  const io = new SocketIoServer(server);

  expressApp.use(express.static(path.join(__dirname, 'public')));

  setupRoutes(expressApp, io, app, handle, uploadDir, output);
  setupSocketEvents(io, output);

  const runningServer = await serverListen(server, port);
  if (authtoken) {
    try {
      const listener = await ngrok.forward({ addr: port, authtoken });
      const url = listener.url();
      if (url) {
        remoteUrl = url;
        qr.generate(remoteUrl, { small: true }, (qrcode) => {
          const lines = qrcode.split('\n');
          const filtered = lines.filter(line => line.trim() !== '');
          filtered[filtered.length - 1] += "\tRemote address: " + remoteUrl;
          output.appendLine('\n' + filtered.join('\n'));
        });
      }
    } catch (err) {
      output.appendLine(`ngrok tunnel failed: ${err}. Falling back to local URL.`);
    }
  }
  qr.generate(localUrl, { small: true }, (qrcode) => {
    const lines = qrcode.split('\n');
    const filtered = lines.filter(line => line.trim() !== '');
    filtered[filtered.length - 3] += "\tServer is running on 🌐 " + localUrl;
    filtered[filtered.length - 2] += "\tReceiving files in 📁 file://" + uploadDir;
    filtered[filtered.length - 1] += "\tBe sure you are using the 🚨️ same network.";
    output.appendLine('\n' + filtered.join('\n'));
  });

  // 停止服务器函数
  const stopServer = async () => {
    io.emit('chat message', { from: 'server', msg: 'The server is shutting down.' }); // 通知所有客户端服务器正在关闭

    try {
      await serverClose(runningServer);
      output.appendLine('Server closed');
    } catch (err) {
      output.appendLine(`Error when closing server: ${err}`);
    }

    if (remoteUrl) {
      try {
        await ngrok.disconnect(remoteUrl);
        remoteUrl = undefined;
        output.appendLine('ngrok closed');
      } catch (err) {
        output.appendLine(`Error when closing ngrok: ${err}`);
      }
    }
  };

  // 当进程退出时，关闭服务器
  process.on('beforeExit', async () => {
    await stopServer();
    process.exit(0);
  });

  return { stopServer, remoteUrl, localUrl };
};

module.exports = createThenStartServer; 