const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const localVideo = document.getElementById('local-video');
const chatMessages = document.getElementById('chat-messages');

let localStream;
let screenStream;
const peers = {};
const dataChannels = {};

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.stunprotocol.org:3478" }
    ]
};

// 1. Initialize Local Media
async function initLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true } });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Failed to access hardware devices:", err);
        alert("Camera/Microphone access required. Ensure you are on HTTPS.");
    }
}

// 2. Create RTCPeerConnection for a specific remote user
function createPeerConnection(targetId, initiator) {
    const pc = new RTCPeerConnection(rtcConfig);
    
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    if (screenStream) {
        screenStream.getTracks().forEach(track => pc.addTrack(track, screenStream));
    }

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { target: targetId, candidate: event.candidate });
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log("ICE State:", pc.iceConnectionState);

        if (pc.iceConnectionState === "failed") {
            console.log("Restarting ICE...");
            pc.restartIce();
        }
    };

    pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!document.getElementById(stream.id)) {
            const videoWrapper = document.createElement('div');
            videoWrapper.className = "relative rounded-xl overflow-hidden shadow-lg bg-black border border-gray-700";
            videoWrapper.id = 'wrapper-' + stream.id;

            const remoteVid = document.createElement('video');
            remoteVid.id = stream.id;
            remoteVid.className = "w-full h-full object-cover";
            remoteVid.srcObject = stream;
            remoteVid.autoplay = true;
            remoteVid.playsInline = true;

            videoWrapper.appendChild(remoteVid);
            videoGrid.appendChild(videoWrapper);
            updateGridCSS();
        }
    };

    if (initiator) {
        const dc = pc.createDataChannel('mesh-data');
        setupDataChannel(dc, targetId);
    } else {
        pc.ondatachannel = (event) => {
            setupDataChannel(event.channel, targetId);
        };
    }

    // pc.onnegotiationneeded = async () => {
    //     if (initiator) {
    //         try {
    //             const offer = await pc.createOffer();
    //             await pc.setLocalDescription(offer);
    //             socket.emit('offer', { target: targetId, sdp: pc.localDescription });
    //         } catch(e) { console.error(e); }
    //     }
    // };

    peers[targetId] = pc;
    return pc;
}

// 3. Signaling Event Handlers
socket.on('connect', async () => {
    await initLocalMedia();
    startTelemetry();
});

socket.on('user-connected', async (newUserId) => {
    console.log("New user joined:", newUserId);
    const pc = createPeerConnection(newUserId, true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { target: newUserId, sdp: pc.localDescription });
});

socket.on('offer', async (payload) => {
    const pc = createPeerConnection(payload.callerId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { target: payload.callerId, sdp: pc.localDescription });
});

socket.on('answer', async (payload) => {
    const pc = peers[payload.responderId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
});

socket.on('ice-candidate', async (payload) => {
    const pc = peers[payload.senderId];
    if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); }
        catch(e) { console.error(e); }
    }
});

socket.on('user-disconnected', (userId) => {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
    if (dataChannels[userId]) delete dataChannels[userId];
    // Remove orphaned video elements
    document.querySelectorAll('video').forEach(v => {
        if (v.id !== 'local-video' && (!v.srcObject || v.srcObject.getTracks().every(t => t.readyState === 'ended'))) {
            v.parentElement && v.parentElement.remove();
        }
    });
    updateGridCSS();
});

// 4. Screen Sharing
document.getElementById('share-screen').addEventListener('click', async () => {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        for (let targetId in peers) {
            peers[targetId].addTrack(screenTrack, screenStream);
        }

        screenTrack.onended = () => {
            for (let targetId in peers) {
                const sender = peers[targetId].getSenders().find(s => s.track === screenTrack);
                if (sender) peers[targetId].removeTrack(sender);
            }
            screenStream = null;
        };
    } catch (err) {
        console.error("Screen share failed:", err);
    }
});

// 5. Toggle Video/Audio
document.getElementById('toggle-video').addEventListener('click', () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (track) track.enabled = !track.enabled;
});

document.getElementById('toggle-audio').addEventListener('click', () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (track) track.enabled = !track.enabled;
});

// 6. RTCDataChannel Chat and File Transfer
let incomingFileChunks = [];
let incomingMetadata = null;

function setupDataChannel(channel, targetId) {
    channel.binaryType = "arraybuffer";
    dataChannels[targetId] = channel;

    channel.onmessage = (event) => {
        if (typeof event.data === 'string') {
            if (event.data.startsWith('METADATA:')) {
                incomingMetadata = JSON.parse(event.data.replace('METADATA:', ''));
                incomingFileChunks = [];
            } else if (event.data === 'EOF') {
                const blob = new Blob(incomingFileChunks, { type: incomingMetadata.mime });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = incomingMetadata.name;
                a.click();
                URL.revokeObjectURL(url);
                appendMessage('System', `Received file: ${incomingMetadata.name}`);
                incomingFileChunks = [];
                incomingMetadata = null;
            } else {
                appendMessage(`User-${targetId.substring(0,4)}`, event.data);
            }
        } else if (event.data instanceof ArrayBuffer) {
            incomingFileChunks.push(event.data);
        }
    };
}

document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const CHUNK_SIZE = 16384;
    const metadata = JSON.stringify({ name: file.name, size: file.size, mime: file.type });
    const buffer = await file.arrayBuffer();

    document.getElementById('transfer-progress').classList.remove('hidden');

    for (let targetId in dataChannels) {
        const dc = dataChannels[targetId];
        if (dc.readyState !== 'open') continue;
        dc.send(`METADATA:${metadata}`);
        for (let i = 0; i < buffer.byteLength; i += CHUNK_SIZE) {
            dc.send(buffer.slice(i, i + CHUNK_SIZE));
        }
        dc.send('EOF');
    }

    document.getElementById('transfer-progress').classList.add('hidden');
    appendMessage('You', `Sent file: ${file.name}`);
    e.target.value = '';
});

document.getElementById('send-msg').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    for (let targetId in dataChannels) {
        if (dataChannels[targetId].readyState === 'open') {
            dataChannels[targetId].send(msg);
        }
    }
    appendMessage('You', msg);
    input.value = '';
}

function appendMessage(sender, text) {
    const div = document.createElement('div');
    div.className = "p-2 bg-gray-700 rounded text-gray-200";
    div.innerHTML = `<span class="font-bold text-blue-400">${sender}:</span> ${escapeHtml(text)}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function updateGridCSS() {
    const count = videoGrid.children.length;
    videoGrid.className = "grid gap-4 w-full h-full auto-rows-fr";
    if (count === 1) videoGrid.classList.add("grid-cols-1");
    else if (count <= 2) videoGrid.classList.add("grid-cols-1", "md:grid-cols-2");
    else if (count <= 4) videoGrid.classList.add("grid-cols-2", "md:grid-cols-2");
    else videoGrid.classList.add("grid-cols-2", "md:grid-cols-3");
}

// 7. Network Telemetry
function startTelemetry() {
    setInterval(async () => {
        const firstPeerId = Object.keys(peers)[0];
        if (!firstPeerId) return;
        const pc = peers[firstPeerId];
        const stats = await pc.getStats(null);
        stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                document.getElementById('rtt-val').innerText =
                    report.currentRoundTripTime ? (report.currentRoundTripTime * 1000).toFixed(0) : 0;
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
                const total = (report.packetsReceived || 0) + (report.packetsLost || 0);
                const lossRate = total > 0 ? (report.packetsLost / total * 100) : 0;
                document.getElementById('loss-val').innerText = lossRate.toFixed(1);
            }
        });
    }, 2000);
}


