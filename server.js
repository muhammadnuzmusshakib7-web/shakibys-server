const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Temporary online users
const users = new Map();

app.get("/", (req, res) => {
  res.json({
    app: "ShakibYS",
    status: "online",
    message: "ShakibYS real-time server is running!"
  });
});

// User connects
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User online
  socket.on("user:online", (user) => {
    if (!user || !user.id) return;

    users.set(String(user.id), {
      id: String(user.id),
      name: user.name || "User",
      socketId: socket.id,
      lastSeen: Date.now()
    });

    socket.userId = String(user.id);

    io.emit("users:online", Array.from(users.values()).map(u => ({
      id: u.id,
      name: u.name
    })));

    console.log(`${user.name || "User"} is online`);
  });

  // Private message
  socket.on("private:message", (data) => {
    if (!data) return;

    const senderId = String(data.senderId || "");
    const receiverId = String(data.receiverId || "");
    const message = String(data.message || "").trim();

    if (!senderId || !receiverId || !message) return;

    const receiver = users.get(receiverId);

    const messageData = {
      id: Date.now().toString(),
      senderId,
      receiverId,
      message,
      time: new Date().toISOString()
    };

    // Send to receiver
    if (receiver) {
      io.to(receiver.socketId).emit("private:message", messageData);
    }

    // Send back to sender
    socket.emit("private:message", messageData);

    console.log(
      `Message: ${senderId} -> ${receiverId}: ${message}`
    );
  });

  // Typing
  socket.on("typing", (data) => {
    if (!data) return;

    const receiver = users.get(String(data.receiverId));

    if (receiver) {
      io.to(receiver.socketId).emit("typing", {
        senderId: data.senderId,
        typing: true
      });
    }
  });

  // Stop typing
  socket.on("stopTyping", (data) => {
    if (!data) return;

    const receiver = users.get(String(data.receiverId));

    if (receiver) {
      io.to(receiver.socketId).emit("typing", {
        senderId: data.senderId,
        typing: false
      });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (socket.userId) {
      const user = users.get(socket.userId);

      if (user) {
        user.lastSeen = Date.now();
        users.delete(socket.userId);

        io.emit("user:offline", {
          id: socket.userId,
          lastSeen: user.lastSeen
        });

        console.log(`${user.name} went offline`);
      }
    }

    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ShakibYS server running on port ${PORT}`);
});
