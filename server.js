require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* =========================================================
   ENVIRONMENT
========================================================= */

const MONGO_URI = process.env.MONGO_URI;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI পাওয়া যায়নি");
  console.error("Render → Environment → MONGO_URI যোগ করো");
  process.exit(1);
}

/* =========================================================
   MONGODB
========================================================= */

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      default: "",
      trim: true
    },
    avatar: {
      type: String,
      default: ""
    },
    online: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    author: {
      type: String,
      required: true,
      trim: true
    },
    authorId: {
      type: String,
      default: ""
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    privacy: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public"
    },
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true
    },
    senderId: {
      type: String,
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    receiverId: {
      type: String,
      default: ""
    },
    text: {
      type: String,
      default: ""
    },
    type: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text"
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);
const Message = mongoose.model("Message", messageSchema);

/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/*
  socket.id -> userId
*/
const onlineUsers = new Map();

/*
  userId -> socket.id
*/
const userSockets = new Map();

/* =========================================================
   HELPERS
========================================================= */

function clean(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function conversationId(a, b) {
  return [String(a), String(b)].sort().join("_");
}

function sendToUser(userId, event, data) {
  const socketId = userSockets.get(String(userId));

  if (socketId) {
    io.to(socketId).emit(event, data);
    return true;
  }

  return false;
}

/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on("connection", async (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  /* =======================================================
     USER ONLINE
  ======================================================= */

  socket.on("user:online", async (data) => {
    try {
      const userId = clean(data?.userId);
      const name = clean(data?.name, "Shakib");
      const phone = clean(data?.phone);

      if (!userId && !phone) {
        return;
      }

      const id = userId || phone;

      onlineUsers.set(socket.id, id);
      userSockets.set(id, socket.id);

      await User.findOneAndUpdate(
        { $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { phone: id }] },
        {
          name,
          phone,
          online: true,
          lastSeen: new Date()
        },
        {
          upsert: false,
          new: true
        }
      ).catch(() => {});

      io.emit("user:status", {
        userId: id,
        online: true
      });

      console.log("🟢 User online:", id);

    } catch (error) {
      console.error("user:online error:", error.message);
    }
  });

  /* =======================================================
     NEWS FEED INITIAL
  ======================================================= */

  try {
    const posts = await Post.find({
      privacy: "public"
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    socket.emit("posts:init", posts);
  } catch (error) {
    console.error("posts:init error:", error.message);
  }

  /* =======================================================
     CREATE POST
  ======================================================= */

  socket.on("post:create", async (data) => {
    try {
      const author = clean(data?.author, "Shakib");
      const authorId = clean(data?.authorId);
      const content = clean(data?.content);
      const privacy = clean(data?.privacy, "public");

      if (!content) {
        socket.emit("post:error", {
          message: "Post লিখুন"
        });
        return;
      }

      const post = await Post.create({
        author,
        authorId,
        content,
        privacy
      });

      const result = post.toObject();

      if (privacy === "public") {
        io.emit("post:created", result);
      } else {
        socket.emit("post:created", result);
      }

      console.log("📝 Post created:", author);

    } catch (error) {
      console.error("post:create error:", error.message);

      socket.emit("post:error", {
        message: "Post তৈরি করা যায়নি"
      });
    }
  });

  /* =======================================================
     LIKE POST
  ======================================================= */

  socket.on("post:like", async (postId) => {
    try {
      if (!mongoose.isValidObjectId(postId)) return;

      const post = await Post.findByIdAndUpdate(
        postId,
        { $inc: { likes: 1 } },
        { new: true }
      ).lean();

      if (post) {
        io.emit("post:updated", post);
      }

    } catch (error) {
      console.error("post:like error:", error.message);
    }
  });

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  socket.on("message:send", async (data) => {
    try {
      const senderId = clean(data?.senderId);
      const senderName = clean(data?.senderName, "Shakib");
      const receiverId = clean(data?.receiverId);
      const text = clean(data?.text);
      const type = clean(data?.type, "text");

      if (!senderId || !receiverId || !text) {
        socket.emit("message:error", {
          message: "Message data অসম্পূর্ণ"
        });
        return;
      }

      const cid = conversationId(senderId, receiverId);

      const message = await Message.create({
        conversationId: cid,
        senderId,
        senderName,
        receiverId,
        text,
        type
      });

      const result = message.toObject();

      /*
        Sender
      */
      socket.emit("message:new", result);

      /*
        Receiver
      */
      sendToUser(receiverId, "message:new", result);

      console.log(
        `💬 ${senderName} → ${receiverId}: ${text}`
      );

    } catch (error) {
      console.error("message:send error:", error.message);

      socket.emit("message:error", {
        message: "Message পাঠানো যায়নি"
      });
    }
  });

  /* =======================================================
     LOAD CHAT
  ======================================================= */

  socket.on("message:history", async (data) => {
    try {
      const userA = clean(data?.userA);
      const userB = clean(data?.userB);

      if (!userA || !userB) return;

      const cid = conversationId(userA, userB);

      const messages = await Message.find({
        conversationId: cid
      })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();

      socket.emit("message:history", messages);

    } catch (error) {
      console.error("message:history error:", error.message);
    }
  });

  /* =======================================================
     TYPING
  ======================================================= */

  socket.on("typing:start", (data) => {
    const receiverId = clean(data?.receiverId);
    const senderName = clean(data?.senderName, "Someone");

    sendToUser(receiverId, "typing:start", {
      senderName
    });
  });

  socket.on("typing:stop", (data) => {
    const receiverId = clean(data?.receiverId);

    sendToUser(receiverId, "typing:stop", {});
  });

  /* =======================================================
     VOICE / VIDEO CALL
     WebRTC SIGNALING
  ======================================================= */

  /*
    Caller → Receiver
  */

  socket.on("call:offer", (data) => {
    const receiverId = clean(data?.receiverId);

    sendToUser(receiverId, "call:offer", {
      callerId: clean(data?.callerId),
      callerName: clean(data?.callerName, "Shakib"),
      callType: clean(data?.callType, "voice"),
      offer: data?.offer
    });

    console.log(
      `📞 Call offer → ${receiverId}`
    );
  });

  /*
    Receiver accepts
  */

  socket.on("call:answer", (data) => {
    const callerId = clean(data?.callerId);

    sendToUser(callerId, "call:answer", {
      receiverId: clean(data?.receiverId),
      answer: data?.answer
    });

    console.log(
      `📞 Call answer → ${callerId}`
    );
  });

  /*
    ICE candidate
  */

  socket.on("call:ice", (data) => {
    const targetUserId = clean(data?.targetUserId);

    sendToUser(targetUserId, "call:ice", {
      candidate: data?.candidate
    });
  });

  /*
    Reject call
  */

  socket.on("call:reject", (data) => {
    const callerId = clean(data?.callerId);

    sendToUser(callerId, "call:rejected", {
      receiverId: clean(data?.receiverId)
    });
  });

  /*
    End call
  */

  socket.on("call:end", (data) => {
    const targetUserId = clean(data?.targetUserId);

    sendToUser(targetUserId, "call:ended", {
      from: clean(data?.from)
    });
  });

  /* =======================================================
     DISCONNECT
  ======================================================= */

  socket.on("disconnect", async () => {
    const userId = onlineUsers.get(socket.id);

    onlineUsers.delete(socket.id);

    if (userId) {
      userSockets.delete(userId);

      io.emit("user:status", {
        userId,
        online: false
      });

      try {
        await User.findOneAndUpdate(
          {
            $or: [
              { phone: userId },
              ...(mongoose.isValidObjectId(userId)
                ? [{ _id: userId }]
                : [])
            ]
          },
          {
            online: false,
            lastSeen: new Date()
          }
        );
      } catch (error) {}

      console.log("🔴 User offline:", userId);
    }

    console.log("🔴 Socket disconnected:", socket.id);
  });
});

/* =========================================================
   REST API — NEWS FEED
========================================================= */

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find({
      privacy: "public"
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      posts
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "News Feed পাওয়া যায়নি"
    });
  }
});

/* =========================================================
   REST API — CREATE POST
========================================================= */

app.post("/api/posts", async (req, res) => {
  try {
    const author = clean(req.body?.author, "Shakib");
    const content = clean(req.body?.content);

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Post লিখুন"
      });
    }

    const post = await Post.create({
      author,
      content,
      privacy: "public"
    });

    const result = post.toObject();

    io.emit("post:created", result);

    res.status(201).json({
      success: true,
      post: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Post তৈরি করা যায়নি"
    });
  }
});

/* =========================================================
   REST API — CHAT HISTORY
========================================================= */

app.get("/api/messages/:userA/:userB", async (req, res) => {
  try {
    const cid = conversationId(
      req.params.userA,
      req.params.userB
    );

    const messages = await Message.find({
      conversationId: cid
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    res.json({
      success: true,
      messages
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Messages পাওয়া যায়নি"
    });
  }
});

/* =========================================================
   AI API
========================================================= */

app.post("/api/ai", async (req, res) => {
  try {
    const question = clean(req.body?.message);

    if (!question) {
      return res.status(400).json({
        success: false,
        message: "প্রশ্ন লিখুন"
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "OPENAI_API_KEY সেট করা হয়নি"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: process.env.AI_MODEL || "gpt-4o-mini",

          messages: [
            {
              role: "system",
              content:
                "You are ShakibYS AI. Answer naturally and helpfully. If the user writes Bengali, respond in Bengali."
            },
            {
              role: "user",
              content: question
            }
          ],

          temperature: 0.7,
          max_tokens: 700
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("AI API error:", data);

      return res.status(response.status).json({
        success: false,
        message:
          data?.error?.message ||
          "AI response পাওয়া যায়নি"
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      "AI কোনো উত্তর দেয়নি।";

    res.json({
      success: true,
      answer
    });

  } catch (error) {
    console.error("AI error:", error.message);

    res.status(500).json({
      success: false,
      message: "AI server error"
    });
  }
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    app: "ShakibYS",
    server: "online",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    socket: "enabled",
    messenger: "enabled",
    voiceCall: "enabled",
    videoCall: "enabled",
    newsFeed: "enabled",
    ai: OPENAI_API_KEY ? "enabled" : "not configured",
    time: new Date().toISOString()
  });
});

/* =========================================================
   FRONTEND
========================================================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================================================
   START
========================================================= */

async function start() {
  try {
    console.log("🔄 Connecting MongoDB...");

    await mongoose.connect(MONGO_URI);

    console.log("✅ MongoDB connected");

    server.listen(PORT, "0.0.0.0", () => {
      console.log("");
      console.log("=================================");
      console.log("🚀 ShakibYS SERVER ONLINE");
      console.log("=================================");
      console.log("💾 MongoDB       : ON");
      console.log("📰 News Feed     : ON");
      console.log("💬 Messenger     : ON");
      console.log("📞 Voice Call    : ON");
      console.log("🎥 Video Call    : ON");
      console.log("🤖 AI API        :", OPENAI_API_KEY ? "ON" : "OFF");
      console.log("🔌 Socket.IO     : ON");
      console.log("🌐 PORT          :", PORT);
      console.log("=================================");
      console.log("");
    });

  } catch (error) {
    console.error("");
    console.error("❌ MongoDB connection failed");
    console.error(error.message);
    console.error("");
    process.exit(1);
  }
}

start();
