const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

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

// Temporary memory storage
const users = new Map();
const messages = new Map();
const friends = new Map();
const blockedUsers = new Map();

// Home
app.get("/", (req, res) => {
  res.json({
    app: "ShakibYS",
    status: "online",
    message: "ShakibYS real-time server is running!"
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    users: users.size,
    time: new Date().toISOString()
  });
});

// Create / update user
app.post("/api/users", (req, res) => {
  const { userId, name } = req.body;

  if (!userId || !name) {
    return res.status(400).json({
      error: "userId and name are required"
    });
  }

  users.set(String(userId), {
    userId: String(userId),
    name: String(name),
    online: false,
    lastSeen: new Date().toISOString(),
    socketId: null
  });

  res.json({
    success: true,
    user: users.get(String(userId))
  });
});

// Get users
app.get("/api/users", (req, res) => {
  res.json([...users.values()].map(user => ({
    userId: user.userId,
    name: user.name,
    online: user.online,
    lastSeen: user.lastSeen
  })));
});

// Get conversation
app.get("/api/messages/:user1/:user2", (req, res) => {
  const user1 = String(req.params.user1);
  const user2 = String(req.params.user2);

  const key = conversationKey(user1, user2);

  res.json(messages.get(key) || []);
});

function conversationKey(a, b) {
  return [String(a), String(b)].sort().join(":");
}

function isBlocked(user1, user2) {
  return (
    blockedUsers.get(user1)?.has(user2) ||
    blockedUsers.get(user2)?.has(user1)
  );
}

// Socket connection
io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  // User comes online
  socket.on("user_online", ({ userId, name }) => {

    if (!userId) return;

    userId = String(userId);

    users.set(userId, {
      userId,
      name: name || "User",
      online: true,
      lastSeen: new Date().toISOString(),
      socketId: socket.id
    });

    socket.userId = userId;

    socket.join(`user:${userId}`);

    io.emit("user_status", {
      userId,
      online: true,
      lastSeen: null
    });

    console.log(`${name || userId} is online`);
  });

  // Send message
  socket.on("send_message", (data) => {

    const {
      senderId,
      receiverId,
      text,
      messageId
    } = data;

    if (!senderId || !receiverId || !text) return;

    const sender = String(senderId);
    const receiver = String(receiverId);

    if (isBlocked(sender, receiver)) {
      socket.emit("message_error", {
        message: "You cannot message this user."
      });
      return;
    }

    const message = {
      messageId:
        messageId ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`,

      senderId: sender,
      receiverId: receiver,
      text: String(text),

      createdAt: new Date().toISOString(),

      status: "sent"
    };

    const key = conversationKey(sender, receiver);

    if (!messages.has(key)) {
      messages.set(key, []);
    }

    messages.get(key).push(message);

    // Send to receiver
    io.to(`user:${receiver}`).emit("new_message", message);

    // Send back to sender
    io.to(`user:${sender}`).emit("message_sent", message);

    console.log(
      `Message: ${sender} -> ${receiver}: ${text}`
    );
  });

  // Typing
  socket.on("typing", ({ senderId, receiverId }) => {

    if (!senderId || !receiverId) return;

    io.to(`user:${receiverId}`).emit("typing", {
      senderId: String(senderId)
    });
  });

  // Stop typing
  socket.on("stop_typing", ({ senderId, receiverId }) => {

    if (!senderId || !receiverId) return;

    io.to(`user:${receiverId}`).emit("stop_typing", {
      senderId: String(senderId)
    });
  });

  // Friend request
  socket.on("friend_request", ({ senderId, receiverId }) => {

    if (!senderId || !receiverId) return;

    io.to(`user:${receiverId}`).emit("friend_request", {
      senderId: String(senderId),
      receiverId: String(receiverId)
    });
  });

  // Accept friend
  socket.on("accept_friend", ({ userId, friendId }) => {

    if (!userId || !friendId) return;

    userId = String(userId);
    friendId = String(friendId);

    if (!friends.has(userId)) {
      friends.set(userId, new Set());
    }

    if (!friends.has(friendId)) {
      friends.set(friendId, new Set());
    }

    friends.get(userId).add(friendId);
    friends.get(friendId).add(userId);

    io.to(`user:${friendId}`).emit("friend_accepted", {
      userId,
      friendId
    });

    io.to(`user:${userId}`).emit("friend_accepted", {
      userId,
      friendId
    });
  });

  // Block user
  socket.on("block_user", ({ userId, blockedId }) => {

    if (!userId || !blockedId) return;

    userId = String(userId);
    blockedId = String(blockedId);

    if (!blockedUsers.has(userId)) {
      blockedUsers.set(userId, new Set());
    }

    blockedUsers.get(userId).add(blockedId);

    io.to(`user:${userId}`).emit("user_blocked", {
      blockedId
    });
  });

  // Mark message as read
  socket.on("message_read", ({ messageId, senderId }) => {

    if (!messageId || !senderId) return;

    io.to(`user:${senderId}`).emit("message_read", {
      messageId
    });
  });

  // Disconnect
  socket.on("disconnect", () => {

    const userId = socket.userId;

    if (!userId) return;

    const user = users.get(userId);

    if (user && user.socketId === socket.id) {

      user.online = false;
      user.lastSeen = new Date().toISOString();
      user.socketId = null;

      users.set(userId, user);

      io.emit("user_status", {
        userId,
        online: false,
        lastSeen: user.lastSeen
      });
    }

    console.log("User disconnected:", socket.id);
  });
});

// Render uses PORT
const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ShakibYS server running on port ${PORT}`);
});
