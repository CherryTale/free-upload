const messageHistory = [];
let shareId;

const setupSocketEvents = (io, output) => {
    io.on('connection', (socket) => {
        const { address } = socket.handshake;
        const userIp = address.substr(0, 7) === "::ffff:" ? address.substr(7) : address;

        // 将历史消息发送给新连接的客户端
        socket.emit('chat history', messageHistory);

        socket.on('chat message', (msg) => {
            let message = { from: socket.id, msg, id: messageHistory.length };
            messageHistory.push(message);
            io.emit('chat message', message);
        });

        socket.on('start-share', () => {
            shareId = socket.id;
            socket.broadcast.emit('new-peer', shareId);
        });

        if (shareId) {
            socket.emit('new-peer', shareId);
        }

        socket.on('offer', (data) => {
            io.to(data.peerId).emit('offer', { offer: data.offer, peerId: socket.id });
        });

        socket.on('answer', (data) => {
            io.to(data.peerId).emit('answer', { answer: data.answer, peerId: socket.id });
        });

        socket.on('ice-candidate', (data) => {
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
    });
}

module.exports = { setupSocketEvents };
