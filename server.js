const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC WEBSITE
========================= */

app.use(express.static(path.join(__dirname)));

/* =========================
   MONGODB
========================= */

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI পাওয়া যায়নি");
  console.error("Render/Server Environment Variables-এ MONGO_URI যোগ করো");
  process.exit(1);
}

/* =========================
   POST MODEL
========================= */

const postSchema = new mongoose.Schema(
  {
    author: {
      type: String,
      required: true,
      trim: true,
      default: "Shakib"
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },

    privacy: {
      type: String,
      enum: ["public"],
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
  {
    timestamps: true
  }
);

const Post = mongoose.model("Post", postSchema);

/* =========================
   DATABASE CONNECTION
========================= */

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((error) => {
    console.error("❌ MongoDB Connection Error:", error.message);
  });

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ShakibYS Server is running 🚀",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected"
  });
});

/* =========================
   GET PUBLIC POSTS
========================= */

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find({
      privacy: "public"
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      posts
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Posts load করা যায়নি"
    });
  }
});

/* =========================
   CREATE POST API
========================= */

app.post("/api/posts", async (req, res) => {
  try {
    const author =
      String(req.body.author || "Shakib").trim();

    const content =
      String(req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Post content required"
      });
    }

    const post = await Post.create({
      author,
      content,
      privacy: "public"
    });

    const cleanPost = post.toObject();

    /* সবাইকে realtime post পাঠানো */
    io.emit("post:created", cleanPost);

    res.status(201).json({
      success: true,
      post: cleanPost
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Post create করা যায়নি"
    });
  }
});

/* =========================
   SOCKET.IO
========================= */

io.on("connection", async (socket) => {
  console.log("🟢 User connected:", socket.id);

  /* নতুন user ঢুকলে পুরোনো পোস্ট পাঠানো */
  try {
    const posts = await Post.find({
      privacy: "public"
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    socket.emit("posts:init", posts);
  } catch (error) {
    console.error("Initial posts error:", error.message);
  }

  /* =========================
     REALTIME CREATE POST
  ========================= */

  socket.on("post:create", async (data) => {
    try {
      const author =
        String(data?.author || "Shakib").trim();

      const content =
        String(data?.content || "").trim();

      if (!content) {
        socket.emit("post:error", {
          message: "Post লিখুন"
        });

        return;
      }

      const post = await Post.create({
        author,
        content,
        privacy: "public"
      });

      const cleanPost = post.toObject();

      /* সকল connected user */
      io.emit("post:created", cleanPost);

    } catch (error) {
      console.error("post:create error:", error);

      socket.emit("post:error", {
        message: "Post publish করা যায়নি"
      });
    }
  });

  /* =========================
     LIKE
  ========================= */

  socket.on("post:like", async (data) => {
    try {
      if (!data?.postId) return;

      const post = await Post.findByIdAndUpdate(
        data.postId,
        { $inc: { likes: 1 } },
        { new: true }
      ).lean();

      if (post) {
        io.emit("post:updated", post);
      }
    } catch (error) {
      console.error("Like error:", error.message);
    }
  });

  /* =========================
     DISCONNECT
  ========================= */

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

/* =========================
   FALLBACK INDEX
========================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(
    `🚀 ShakibYS Server running on port ${PORT}`
  );
});
