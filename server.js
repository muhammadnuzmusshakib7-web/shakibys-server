const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const users = new Map();

app.get("/api/status", (req, res) => {
    res.json({
        app: "ShakibYS",
        status: "online",
        message: "ShakibYS real-time server is running!",
        users: users.size
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    socket.on("join", (username) => {

        username = String(username || "User")
            .trim()
            .slice(0, 30);

        users.set(socket.id, {
            id: socket.id,
            name: username,
            online: true
        });

        socket.username = username;

        socket.emit("joined", {
            id: socket.id,
            name: username
        });

        io.emit("users", Array.from(users.values()));

        io.emit("system_message", {
            text: `${username} ShakibYS-এ যোগ দিয়েছে`
        });
    });

    socket.on("public_message", (data) => {

        if (!socket.username) return;

        const text = String(data?.text || "")
            .trim()
            .slice(0, 1000);

        if (!text) return;

        io.emit("public_message", {
            id: Date.now() + Math.random(),
            senderId: socket.id,
            sender: socket.username,
            text,
            time: new Date().toISOString()
        });
    });

    socket.on("private_message", (data) => {

        if (!socket.username) return;

        const receiverId = data?.receiverId;

        const text = String(data?.text || "")
            .trim()
            .slice(0, 1000);

        if (!receiverId || !text) return;

        const message = {
            id: Date.now() + Math.random(),
            senderId: socket.id,
            sender: socket.username,
            receiverId,
            text,
            time: new Date().toISOString()
        };

        socket.emit("private_message", message);
        io.to(receiverId).emit("private_message", message);
    });

    socket.on("disconnect", () => {

        const user = users.get(socket.id);

        if (user) {
            users.delete(socket.id);

            io.emit("users", Array.from(users.values()));

            io.emit("system_message", {
                text: `${user.name} অফলাইনে গেছে`
            });
        }
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`ShakibYS server running on port ${PORT}`);
});
