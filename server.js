
const express = require("express");
const http = require("http");
const path = require("path");
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===============================
// SHAKIBYS DATA
// ===============================

const users = new Map();
const messages = [];
const posts = [];
const stories = [];
const marketplace = [];
const friendRequests = [];
const notifications = [];

const accounts = new Map();

// ===============================
// HELPERS
// ===============================

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 10)}`;
}

function cleanText(value, max = 5000) {
  return String(value || "").trim().substring(0, max);
}

// ===============================
// WEBSITE
// ===============================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/status", (req, res) => {
  res.json({
    app: "ShakibYS",
    status: "online",
    message: "ShakibYS real-time server is running!"
  });
});

// ===============================
// ACCOUNT SYSTEM
// ===============================

// Register
app.post("/api/register", (req, res) => {
  const phone = cleanText(req.body.phone, 30);
  const password = cleanText(req.body.password, 100);
  const name = cleanText(req.body.name, 50);

  if (!phone || !password || !name) {
    return res.status(400).json({
      success: false,
      message: "সব তথ্য পূরণ করুন"
    });
  }

  if (accounts.has(phone)) {
    return res.status(409).json({
      success: false,
      message: "এই নাম্বারে ইতিমধ্যে অ্যাকাউন্ট আছে"
    });
  }

  accounts.set(phone, {
    phone,
    password,
    name,
    createdAt: Date.now()
  });

  res.json({
    success: true,
    message: "অ্যাকাউন্ট তৈরি হয়েছে"
  });
});

// Login
app.post("/api/login", (req, res) => {
  const phone = cleanText(req.body.phone, 30);
  const password = cleanText(req.body.password, 100);

  const account = accounts.get(phone);

  if (!account || account.password !== password) {
    return res.status(401).json({
      success: false,
      message: "নাম্বার অথবা পাসওয়ার্ড ভুল"
    });
  }

  res.json({
    success: true,
    user: {
      phone: account.phone,
      name: account.name
    }
  });
});

// ===============================
// FORGOT PASSWORD / OTP
// ===============================

const otpStore = new Map();

// Request OTP
app.post("/api/forgot-password", (req, res) => {
  const phone = cleanText(req.body.phone, 30);

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "ফোন নাম্বার দিন"
    });
  }

  if (!accounts.has(phone)) {
    return res.status(404).json({
      success: false,
      message: "এই নাম্বারে কোনো অ্যাকাউন্ট পাওয়া যায়নি"
    });
  }

  // Demo OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  console.log(`ShakibYS OTP for ${phone}: ${otp}`);

  res.json({
    success: true,
    message: "OTP তৈরি হয়েছে",
    demoOtp: otp
  });
});

// Verify OTP
app.post("/api/verify-otp", (req, res) => {
  const phone = cleanText(req.body.phone, 30);
  const otp = cleanText(req.body.otp, 10);

  const saved = otpStore.get(phone);

  if (!saved) {
    return res.status(400).json({
      success: false,
      message: "OTP পাওয়া যায়নি"
    });
  }

  if (Date.now() > saved.expiresAt) {
    otpStore.delete(phone);

    return res.status(400).json({
      success: false,
      message: "OTP-এর সময় শেষ হয়ে গেছে"
    });
  }

  if (saved.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "ভুল OTP"
    });
  }

  otpStore.set(phone, {
    ...saved,
    verified: true
  });

  res.json({
    success: true,
    message: "OTP সঠিক"
  });
});

// New Password
app.post("/api/reset-password", (req, res) => {
  const phone = cleanText(req.body.phone, 30);
  const newPassword = cleanText(req.body.newPassword, 100);

  const saved = otpStore.get(phone);

  if (!saved || !saved.verified) {
    return res.status(403).json({
      success: false,
      message: "আগে OTP verify করুন"
    });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"
    });
  }

  const account = accounts.get(phone);

  if (!account) {
    return res.status(404).json({
      success: false,
      message: "অ্যাকাউন্ট পাওয়া যায়নি"
    });
  }

  account.password = newPassword;

  accounts.set(phone, account);
  otpStore.delete(phone);

  res.json({
    success: true,
    message: "নতুন পাসওয়ার্ড সেট হয়েছে"
  });
});

// ===============================
// SOCKET.IO
// ===============================

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // User Join
  socket.on("user:join", (data) => {
    const username = cleanText(data?.username, 50);

    if (!username) return;

    const user = {
      id: socket.id,
      username,
      online: true,
      lastSeen: Date.now()
    };

    users.set(socket.id, user);
    socket.username = username;

    io.emit("users:update", Array.from(users.values()));

    socket.emit("app:init", {
      messages,
      posts,
      stories: getActiveStories(),
      marketplace
    });

    io.emit("notification:new", {
      id: makeId("notification"),
      type: "online",
      message: `${username} এখন অনলাইনে`,
      time: Date.now()
    });
  });

  // =============================
  // GLOBAL CHAT
  // =============================

  socket.on("chat:send", (data) => {
    const text = cleanText(data?.text);

    if (!text || !socket.username) return;

    const message = {
      id: makeId("message"),
      senderId: socket.id,
      sender: socket.username,
      text,
      seen: false,
      time: Date.now()
    };

    messages.push(message);

    if (messages.length > 500) {
      messages.shift();
    }

    io.emit("chat:new", message);
  });

  // Typing
  socket.on("chat:typing", (typing) => {
    if (!socket.username) return;

    socket.broadcast.emit("chat:typing", {
      username: socket.username,
      typing: Boolean(typing)
    });
  });

  // Seen
  socket.on("message:seen", (messageId) => {
    const message = messages.find((m) => m.id === messageId);

    if (message) {
      message.seen = true;
    }

    io.emit("message:seen", {
      messageId,
      username: socket.username,
      time: Date.now()
    });
  });

  // =============================
  // POSTS
  // =============================

  socket.on("post:create", (data) => {
    const content = cleanText(data?.content);

    if (!content || !socket.username) return;

    const post = {
      id: makeId("post"),
      authorId: socket.id,
      author: socket.username,
      content,
      likes: [],
      comments: [],
      shares: 0,
      time: Date.now()
    };

    posts.unshift(post);

    if (posts.length > 200) {
      posts.pop();
    }

    io.emit("post:new", post);
  });

  // Like
  socket.on("post:like", (postId) => {
    const post = posts.find((p) => p.id === postId);

    if (!post || !socket.username) return;

    if (!post.likes.includes(socket.username)) {
      post.likes.push(socket.username);
    } else {
      post.likes = post.likes.filter(
        (name) => name !== socket.username
      );
    }

    io.emit("post:updated", post);
  });

  // Comment
  socket.on("post:comment", (data) => {
    const post = posts.find((p) => p.id === data?.postId);
    const text = cleanText(data?.text);

    if (!post || !text || !socket.username) return;

    post.comments.push({
      id: makeId("comment"),
      username: socket.username,
      text,
      time: Date.now()
    });

    io.emit("post:updated", post);
  });

  // Share
  socket.on("post:share", (postId) => {
    const post = posts.find((p) => p.id === postId);

    if (!post) return;

    post.shares++;

    io.emit("post:updated", post);
  });

  // =============================
  // STORIES
  // =============================

  socket.on("story:create", (data) => {
    if (!socket.username) return;

    const story = {
      id: makeId("story"),
      userId: socket.id,
      username: socket.username,
      type: data?.type === "video" ? "video" : "image",
      media: cleanText(data?.media, 1000000),
      caption: cleanText(data?.caption, 300),
      views: [],
      createdAt: Date.now(),

      // 24 hours
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    };

    stories.push(story);

    io.emit("story:new", story);
  });

  socket.on("story:view", (storyId) => {
    const story = stories.find((s) => s.id === storyId);

    if (!story || !socket.username) return;

    if (!story.views.includes(socket.username)) {
      story.views.push(socket.username);
    }

    io.emit("story:updated", story);
  });

  // =============================
  // FRIEND REQUEST
  // =============================

  socket.on("friend:request", (targetId) => {
    const target = users.get(targetId);

    if (!target || !socket.username) return;

    const request = {
      id: makeId("friend"),
      fromId: socket.id,
      from: socket.username,
      toId: targetId,
      time: Date.now()
    };

    friendRequests.push(request);

    io.to(targetId).emit("friend:request", request);

    io.emit("notification:new", {
      id: makeId("notification"),
      type: "friend",
      message: `${socket.username} Friend Request পাঠিয়েছে`,
      time: Date.now()
    });
  });

  // =============================
  // MARKETPLACE
  // =============================

  socket.on("market:create", (data) => {
    if (!socket.username) return;

    const item = {
      id: makeId("market"),
      seller: socket.username,
      sellerId: socket.id,
      title: cleanText(data?.title, 100),
      price: cleanText(data?.price, 50),
      description: cleanText(data?.description, 1000),
      image: cleanText(data?.image, 1000000),
      time: Date.now()
    };

    marketplace.unshift(item);

    io.emit("market:new", item);
  });

  // =============================
  // NOTIFICATION
  // =============================

  socket.on("notification:read", (notificationId) => {
    const notification = notifications.find(
      (n) => n.id === notificationId
    );

    if (notification) {
      notification.read = true;
    }

    socket.emit("notification:read", notificationId);
  });

  // =============================
  // DISCONNECT
  // =============================

  socket.on("disconnect", () => {
    const user = users.get(socket.id);

    if (!user) return;

    users.delete(socket.id);

    io.emit("users:update", Array.from(users.values()));

    io.emit("notification:new", {
      id: makeId("notification"),
      type: "offline",
      message: `${user.username} অফলাইনে গেছে`,
      time: Date.now()
    });

    console.log(`${user.username} disconnected`);
  });
});

// ===============================
// STORY EXPIRATION
// ===============================

function getActiveStories() {
  const now = Date.now();

  return stories.filter(
    (story) => story.expiresAt > now
  );
}

setInterval(() => {
  const now = Date.now();

  for (let i = stories.length - 1; i >= 0; i--) {
    if (stories[i].expiresAt <= now) {
      stories.splice(i, 1);
    }
  }

  io.emit("stories:update", getActiveStories());
}, 60 * 1000);

// ===============================
// START
// ===============================

server.listen(PORT, "0.0.0.0", () => {
  console.log("================================");
  console.log("   ShakibYS Server ONLINE");
  console.log("================================");
  console.log(`Port: ${PORT}`);
});
