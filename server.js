const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/* =========================
   MEMORY DATABASE
========================= */

const users = [];
const posts = [];
const messages = [];

const socketsByUser = new Map();
const userBySocket = new Map();

/* =========================
   HELPERS
========================= */

function clean(v, fallback = "") {
  return String(v ?? fallback).trim();
}

function conversationId(a, b) {
  return [String(a), String(b)].sort().join("_");
}

function sendUser(userId, event, data) {
  const socketId = socketsByUser.get(String(userId));

  if (!socketId) return false;

  io.to(socketId).emit(event, data);
  return true;
}

function publicUser(user) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    avatar: user.avatar || "",
    online: !!user.online,
    lastSeen: user.lastSeen
  };
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    app: "ShakibYS",
    server: "online",
    messenger: "enabled",
    voiceCall: "enabled",
    videoCall: "enabled",
    newsFeed: "enabled",
    ai: process.env.OPENAI_API_KEY ? "enabled" : "not configured",
    users: users.length,
    posts: posts.length
  });
});

/* =========================
   REGISTER / LOGIN
========================= */

app.post("/api/auth", (req, res) => {
  const phone = clean(req.body.phone);
  const name = clean(req.body.name, "Shakib");

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "মোবাইল নম্বর দিন"
    });
  }

  if (phone.length < 5) {
    return res.status(400).json({
      success: false,
      message: "সঠিক মোবাইল নম্বর দিন"
    });
  }

  let user = users.find(u => u.phone === phone);

  if (!user) {
    user = {
      id: "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      phone,
      name,
      avatar: "",
      online: false,
      lastSeen: new Date().toISOString()
    };

    users.push(user);
  } else if (name) {
    user.name = name;
  }

  res.json({
    success: true,
    user: publicUser(user)
  });
});

/* =========================
   USER SEARCH
========================= */

app.get("/api/users", (req, res) => {
  const q = clean(req.query.q).toLowerCase();
  const current = clean(req.query.current);

  let result = users.filter(u => u.phone !== current);

  if (q) {
    result = result.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q)
    );
  }

  res.json({
    success: true,
    users: result.slice(0, 50).map(publicUser)
  });
});

/* =========================
   GET POSTS
========================= */

app.get("/api/posts", (req, res) => {
  res.json({
    success: true,
    posts: posts.slice(-50).reverse()
  });
});

/* =========================
   CREATE POST
========================= */

app.post("/api/posts", (req, res) => {
  const author = clean(req.body.author, "Shakib");
  const authorId = clean(req.body.authorId);
  const content = clean(req.body.content);

  if (!content) {
    return res.status(400).json({
      success: false,
      message: "Post লিখুন"
    });
  }

  const post = {
    id: "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    author,
    authorId,
    content,
    likes: 0,
    comments: 0,
    shares: 0,
    createdAt: new Date().toISOString()
  };

  posts.push(post);

  io.emit("post:created", post);

  res.status(201).json({
    success: true,
    post
  });
});

/* =========================
   CHAT HISTORY
========================= */

app.get("/api/messages/:a/:b", (req, res) => {
  const cid = conversationId(
    req.params.a,
    req.params.b
  );

  const result = messages.filter(
    m => m.conversationId === cid
  );

  res.json({
    success: true,
    messages: result
  });
});

/* =========================
   AI
========================= */

app.post("/api/ai", async (req, res) => {
  const question = clean(req.body.message);

  if (!question) {
    return res.status(400).json({
      success: false,
      message: "প্রশ্ন লিখুন"
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      success: true,
      answer:
        "AI চালু করতে Render Environment Variables-এ OPENAI_API_KEY যোগ করতে হবে।"
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":
            "Bearer " + process.env.OPENAI_API_KEY
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are ShakibYS AI. Reply naturally. If user writes Bengali, reply in Bengali."
            },
            {
              role: "user",
              content: question
            }
          ],
          max_tokens: 700
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        message: data?.error?.message || "AI error"
      });
    }

    res.json({
      success: true,
      answer:
        data?.choices?.[0]?.message?.content ||
        "AI উত্তর দিতে পারেনি।"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "AI server error"
    });
  }
});

/* =========================
   SOCKET.IO
========================= */

io.on("connection", socket => {

  console.log("Socket connected:", socket.id);

  /* USER ONLINE */

  socket.on("user:online", data => {
    const userId = clean(data?.userId);
    const phone = clean(data?.phone);
    const name = clean(data?.name, "Shakib");

    const id = userId || phone;

    if (!id) return;

    socketsByUser.set(String(id), socket.id);
    userBySocket.set(socket.id, String(id));

    const user = users.find(
      u => u.id === id || u.phone === phone || u.phone === id
    );

    if (user) {
      user.online = true;
      user.lastSeen = new Date().toISOString();
      if (name) user.name = name;
    }

    io.emit("user:status", {
      userId: id,
      online: true
    });

    socket.emit(
      "posts:init",
      posts.slice(-50).reverse()
    );
  });

  /* POST */

  socket.on("post:create", data => {
    const author = clean(data?.author, "Shakib");
    const authorId = clean(data?.authorId);
    const content = clean(data?.content);

    if (!content) {
      socket.emit("post:error", {
        message: "Post লিখুন"
      });
      return;
    }

    const post = {
      id: "p_" + Date.now(),
      author,
      authorId,
      content,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: new Date().toISOString()
    };

    posts.push(post);

    io.emit("post:created", post);
  });

  /* MESSAGE */

  socket.on("message:send", data => {
    const senderId = clean(data?.senderId);
    const senderName = clean(data?.senderName, "Shakib");
    const receiverId = clean(data?.receiverId);
    const text = clean(data?.text);

    if (!senderId || !receiverId || !text) return;

    const message = {
      id: "m_" + Date.now() + "_" +
        Math.random().toString(36).slice(2, 7),
      conversationId:
        conversationId(senderId, receiverId),
      senderId,
      senderName,
      receiverId,
      text,
      type: clean(data?.type, "text"),
      createdAt: new Date().toISOString()
    };

    messages.push(message);

    socket.emit("message:new", message);

    sendUser(
      receiverId,
      "message:new",
      message
    );
  });

  /* MESSAGE HISTORY */

  socket.on("message:history", data => {
    const a = clean(data?.userA);
    const b = clean(data?.userB);

    if (!a || !b) return;

    const cid = conversationId(a, b);

    socket.emit(
      "message:history",
      messages.filter(
        m => m.conversationId === cid
      )
    );
  });

  /* TYPING */

  socket.on("typing:start", data => {
    sendUser(
      clean(data?.receiverId),
      "typing:start",
      {
        senderName:
          clean(data?.senderName, "Someone")
      }
    );
  });

  socket.on("typing:stop", data => {
    sendUser(
      clean(data?.receiverId),
      "typing:stop",
      {}
    );
  });

  /* =========================
     WEBRTC AUDIO / VIDEO CALL
  ========================= */

  socket.on("call:offer", data => {
    sendUser(
      clean(data?.receiverId),
      "call:offer",
      {
        callerId: clean(data?.callerId),
        callerName:
          clean(data?.callerName, "Someone"),
        callType:
          clean(data?.callType, "voice"),
        offer: data?.offer
      }
    );
  });

  socket.on("call:answer", data => {
    sendUser(
      clean(data?.callerId),
      "call:answer",
      {
        receiverId:
          clean(data?.receiverId),
        answer: data?.answer
      }
    );
  });

  socket.on("call:ice", data => {
    sendUser(
      clean(data?.targetUserId),
      "call:ice",
      {
        candidate: data?.candidate
      }
    );
  });

  socket.on("call:reject", data => {
    sendUser(
      clean(data?.callerId),
      "call:rejected",
      {
        receiverId:
          clean(data?.receiverId)
      }
    );
  });

  socket.on("call:end", data => {
    sendUser(
      clean(data?.targetUserId),
      "call:ended",
      {
        from: clean(data?.from)
      }
    );
  });

  /* DISCONNECT */

  socket.on("disconnect", () => {
    const userId =
      userBySocket.get(socket.id);

    if (userId) {
      socketsByUser.delete(userId);
      userBySocket.delete(socket.id);

      const user = users.find(
        u => u.id === userId ||
             u.phone === userId
      );

      if (user) {
        user.online = false;
        user.lastSeen =
          new Date().toISOString();
      }

      io.emit("user:status", {
        userId,
        online: false
      });
    }

    console.log(
      "Socket disconnected:",
      socket.id
    );
  });
});

/* =========================
   FRONTEND
========================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* Express 5 compatible fallback */

app.use((req, res) => {
  if (req.method === "GET") {
    res.sendFile(
      path.join(__dirname, "index.html")
    );
  } else {
    res.status(404).json({
      success: false,
      message: "Not found"
    });
  }
});

/* =========================
   START
========================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "================================"
    );
    console.log(
      "🚀 ShakibYS SERVER ONLINE"
    );
    console.log(
      "💬 Messenger: ON"
    );
    console.log(
      "📞 Audio Call: ON"
    );
    console.log(
      "🎥 Video Call: ON"
    );
    console.log(
      "📰 News Feed: ON"
    );
    console.log(
      "🤖 AI: " +
      (process.env.OPENAI_API_KEY
        ? "ON"
        : "OFF")
    );
    console.log(
      "🌐 PORT: " + PORT
    );
    console.log(
      "================================"
    );
  }
);
