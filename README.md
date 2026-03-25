# 🎥 Video Call & Chat Web App (LAN)

A real-time **peer-to-peer video calling and messaging application** built for **Local Area Network (LAN)** environments using WebRTC and Socket.IO.

---

## 🚀 Features

* 📹 Real-time video calling (WebRTC)
* 💬 Live text chat between users
* 🔄 Auto-detection of users on same network
* ⚡ Low latency communication (LAN optimized)
* 📱 Works across devices (Laptop ↔ Phone)
* 🎙️ Microphone & camera support

---

## 🛠️ Tech Stack

| Technology  | Purpose                             |
| ----------- | ----------------------------------- |
| WebRTC      | Peer-to-peer video/audio streaming  |
| Socket.IO   | Signaling & real-time communication |
| Node.js     | Backend server                      |
| Express.js  | Server framework                    |
| HTML/CSS/JS | Frontend UI                         |

---

## 📂 Project Structure

```
project/
│── public/
│   ├── index.html
│   └── app.js
│
│── server.js
│── package.json
```

---

## ⚙️ How It Works

1. User opens app in browser
2. Server connects users via Socket.IO
3. WebRTC handles:

   * Video stream
   * Audio stream
4. ICE candidates + SDP exchange happens via server
5. Direct peer-to-peer connection is established

---

## 🧪 Setup & Run Locally

### 1. Clone Repository

```bash
git clone https://github.com/achintya-goyal/Video-Call-And-Chat-Web-App-on-LAN.git
cd Video-Call-And-Chat-Web-App-on-LAN
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Server

```bash
node server.js
```

### 4. Open in Browser

```
http://localhost:3000
```

---

## 🌐 How to Use on LAN

1. Find your local IP:

   ```bash
   ipconfig   # Windows
   ifconfig   # Mac/Linux
   ```

2. Open app on other devices:

   ```
   http://YOUR-IP:3000
   ```

Example:

```
http://192.168.1.5:3000
```

---

## ⚠️ Known Issues

* 📱 Mobile refresh may disconnect stream
* 🔇 Mic permission issues on some browsers
* 🖥️ Black screen when peer disconnects unexpectedly

---

## 🧠 Future Improvements

* 🔐 Add authentication system
* 🌍 Support for internet (STUN/TURN servers)
* 🎨 Better UI/UX
* 👥 Group video calls
* 📁 File sharing

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first.

---

## 📄 License

This project is open-source and free to use.

---

## 👨‍💻 Author

**Achintya Goyal**

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!

---
