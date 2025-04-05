import { Server } from 'socket.io';
import { OutputChannel } from 'vscode';

interface Message {
    from: string;
    msg: string;
    id: number;
}

interface OfferData {
    offer: RTCSessionDescription;
    peerId: string;
}

interface AnswerData {
    answer: RTCSessionDescription;
    peerId: string;
}

interface IceCandidateData {
    candidate: RTCIceCandidate;
    peerId: string;
}

const messageHistory: Message[] = [];
let shareId: string | undefined;

export const setupSocketEvents = (io: Server, output: OutputChannel): void => {
    io.on('connection', (socket) => {
        output.appendLine(`Client connected: ${socket.id}`);

        const { address } = socket.handshake;
        const userIp = address.substr(0, 7) === "::ffff:" ? address.substr(7) : address;

        // 将历史消息发送给新连接的客户端
        socket.emit('chat history', messageHistory);

        socket.on('chat message', (msg: { from: string; msg: string }) => {
            output.appendLine(`Message from ${msg.from}: ${msg.msg}`);
            io.emit('chat message', msg);
        });

        socket.on('start-share', () => {
            shareId = socket.id;
            socket.broadcast.emit('new-peer', shareId);
        });

        if (shareId) {
            socket.emit('new-peer', shareId);
        }

        socket.on('offer', (data: OfferData) => {
            io.to(data.peerId).emit('offer', { offer: data.offer, peerId: socket.id });
        });

        socket.on('answer', (data: AnswerData) => {
            io.to(data.peerId).emit('answer', { answer: data.answer, peerId: socket.id });
        });

        socket.on('ice-candidate', (data: IceCandidateData) => {
            io.to(data.peerId).emit('ice-candidate', { candidate: data.candidate, peerId: socket.id });
        });

        socket.on('stop-share', () => {
            shareId = undefined;
            socket.broadcast.emit('stop-share');
        });

        socket.on('disconnect', () => {
            socket.broadcast.emit('peer-disconnected', socket.id);
            output.appendLine(`${userIp} disconnected`);
            if (socket.id === shareId) {
                shareId = undefined;
            }
        });

        socket.on('error', (error: Error) => {
            output.appendLine(`Socket error from ${socket.id}: ${error.message}`);
        });
    });
}; 