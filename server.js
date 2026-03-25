const express = require('express');
const https = require('https');
const fs = require('fs');
const os = require('os');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

const httpsOptions = {
    key: fs.readFileSync('./security/cert.key'),
    cert: fs.readFileSync('./security/cert.pem'),
    requestCert: false,
    rejectUnauthorized: false
};

const server = https.createServer(httpsOptions, app);

const io = socketIo(server, {
    cors: { origin: "*" }
});

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '0.0.0.0';
}

const ROOM_NAME = 'lan-mesh-network';

io.on('connection', (socket) => {
    console.log(`New peer connected: ${socket.id}`);
    socket.join(ROOM_NAME);
    socket.to(ROOM_NAME).emit('user-connected', socket.id);

    socket.on('offer', (payload) => {
        io.to(payload.target).emit('offer', {
            callerId: socket.id,
            sdp: payload.sdp
        });
    });

    socket.on('answer', (payload) => {
        io.to(payload.target).emit('answer', {
            responderId: socket.id,
            sdp: payload.sdp
        });
    });

    socket.on('ice-candidate', (payload) => {
        io.to(payload.target).emit('ice-candidate', {
            senderId: socket.id,
            candidate: payload.candidate
        });
    });

    socket.on('disconnect', () => {
        console.log(`Peer disconnected: ${socket.id}`);
        socket.to(ROOM_NAME).emit('user-disconnected', socket.id);
    });
});

const localIp = getLocalIPAddress();
server.listen(port, '0.0.0.0', () => {
    console.log('===================================================');
    console.log('Secure WebRTC LAN Server is actively running.');
    console.log(`Tell your friends to connect to: https://${localIp}:${port}`);
    console.log('Note: Accept the self-signed certificate warning in the browser.');
    console.log('===================================================');
});
