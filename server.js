const express = require("express");
const path = require("path");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   BASIC API
========================= */

app.get("/api/status", (req, res) => {
    res.json({
        app: "ShakibYS",
        status: "online",
        message: "ShakibYS real-time server is running!"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        server: "ShakibYS",
        time: new Date().toISOString()
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});


/* =========================
   TEMPORARY IN-MEMORY DATA
========================= */

const users = new Map();
const groups = new Map();
const messages = new Map();
const stories = [];
const posts = [];
const marketplace = [];


/* =========================
   SOCKET.IO
========================= */

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    socket.on("user:online", (data) => {

        const name = data?.name || "Unknown";

        users.set(socket.id, {
            socketId: socket.id,
            name,
            online: true,
            joinedAt: Date.now()
        });

        io.emit("users:update", {
            onlineUsers: users.size
        });

    });


    /* =========================
       PRIVATE / GROUP CHAT
    ========================= */

    socket.on("chat:join", (room) => {

        if (!room) return;

        socket.join(room);

        console.log(
            `${socket.id} joined ${room}`
        );

    });


    socket.on("chat:message", (data) => {

        if (!data) return;

        const room = data.room || "global";

        const message = {
            id: Date.now().toString(),
            room,
            sender: data.sender || "Unknown",
            text: data.text || "",
            time: new Date().toISOString()
        };

        if (!messages.has(room)) {
            messages.set(room, []);
        }

        messages.get(room).push(message);

        io.to(room).emit(
            "chat:message",
            message
        );

    });


    /* =========================
       GROUP CREATE
    ========================= */

    socket.on("group:create", (data) => {

        if (!data?.name) return;

        const id =
            "group_" +
            Date.now();

        const group = {
            id,
            name: data.name,
            creator: data.creator || "Unknown",
            members: [],
            createdAt: new Date().toISOString()
        };

        groups.set(id, group);

        io.emit(
            "group:created",
            group
        );

    });


    /* =========================
       POST
    ========================= */

    socket.on("post:create", (data) => {

        const post = {
            id: Date.now().toString(),
            author: data?.author || "Unknown",
            content: data?.content || "",
            createdAt: new Date().toISOString()
        };

        posts.unshift(post);

        io.emit(
            "post:created",
            post
        );

    });


    /* =========================
       STORY
       24 HOUR EXPIRY
    ========================= */

    socket.on("story:create", (data) => {

        const story = {
            id: Date.now().toString(),
            author: data?.author || "Unknown",
            content: data?.content || "",
            media: data?.media || null,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000
        };

        stories.push(story);

        io.emit(
            "story:created",
            story
        );

    });


    /* =========================
       DISCONNECT
    ========================= */

    socket.on("disconnect", () => {

        users.delete(socket.id);

        io.emit("users:update", {
            onlineUsers: users.size
        });

        console.log(
            "User disconnected:",
            socket.id
        );

    });

});


/* =========================
   AUTOMATIC STORY CLEANUP
========================= */

setInterval(() => {

    const now = Date.now();

    for (
        let i = stories.length - 1;
        i >= 0;
        i--
    ) {

        if (
            stories[i].expiresAt <= now
        ) {

            stories.splice(i, 1);

        }

    }

}, 60 * 1000);


/* =========================
   SERVER
========================= */

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `ShakibYS server running on port ${PORT}`
        );

    }
);
