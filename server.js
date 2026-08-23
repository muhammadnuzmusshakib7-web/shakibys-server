const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* =========================================================
   IN-MEMORY DATABASE
========================================================= */

const users = [];
const posts = [];
const messages = [];
const friendRequests = [];
const follows = [];
const notifications = [];

let nextUserId = 1;
let nextPostId = 1;
let nextMessageId = 1;
let nextRequestId = 1;
let nextNotificationId = 1;

/* =========================================================
   ONLINE USERS
========================================================= */

const socketUsers = new Map(); // socket.id -> userId
const userSockets = new Map(); // userId -> socket.id

/* =========================================================
   HELPERS
========================================================= */

function clean(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function now() {
  return new Date().toISOString();
}

function makeId(prefix, number) {
  return `${prefix}_${number}`;
}

function getUser(id) {
  return users.find(u => String(u.id) === String(id));
}

function getUserByPhone(phone) {
  return users.find(u => u.phone === clean(phone));
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar || "",
    bio: user.bio || "",
    online: !!user.online,
    lastSeen: user.lastSeen || null,
    followers: user.followers || 0,
    following: user.following || 0,
    friends: user.friends || 0,
    createdAt: user.createdAt
  };
}

function sendToUser(userId, event, data) {
  const socketId = userSockets.get(String(userId));

  if (!socketId) return false;

  io.to(socketId).emit(event, data);
  return true;
}

function conversationId(a, b) {
  return [String(a), String(b)].sort().join("_");
}

function addNotification(userId, type, fromUser, extra = {}) {
  const notification = {
    id: makeId("notification", nextNotificationId++),
    userId: String(userId),
    type,
    fromUserId: String(fromUser.id),
    fromUserName: fromUser.name,
    ...extra,
    read: false,
    createdAt: now()
  };

  notifications.push(notification);

  sendToUser(
    userId,
    "notification:new",
    notification
  );

  return notification;
}

/* =========================================================
   DEMO USER
   ========================================================= */

if (users.length === 0) {
  users.push({
    id: String(nextUserId++),
    name: "Shakib",
    phone: "01339828709",
    avatar: "",
    bio: "Welcome to ShakibYS",
    online: false,
    lastSeen: now(),
    followers: 0,
    following: 0,
    friends: 0,
    createdAt: now()
  });
}

/* =========================================================
   AUTH — REGISTER
========================================================= */

app.post("/api/auth/register", (req, res) => {
  const name = clean(req.body?.name);
  const phone = clean(req.body?.phone);

  if (!name || !phone) {
    return res.status(400).json({
      success: false,
      message: "নাম ও মোবাইল নাম্বার দিন"
    });
  }

  if (!/^\d{5,15}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "সঠিক মোবাইল নাম্বার দিন"
    });
  }

  const existing = getUserByPhone(phone);

  if (existing) {
    return res.json({
      success: true,
      user: publicUser(existing),
      message: "এই নাম্বারে আগে থেকেই অ্যাকাউন্ট আছে"
    });
  }

  const user = {
    id: String(nextUserId++),
    name,
    phone,
    avatar: "",
    bio: "",
    online: false,
    lastSeen: now(),
    followers: 0,
    following: 0,
    friends: 0,
    createdAt: now()
  };

  users.push(user);

  res.status(201).json({
    success: true,
    user: publicUser(user)
  });
});

/* =========================================================
   AUTH — LOGIN
========================================================= */

app.post("/api/auth/login", (req, res) => {
  const phone = clean(req.body?.phone);

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "মোবাইল নাম্বার দিন"
    });
  }

  const user = getUserByPhone(phone);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "এই নাম্বারে কোনো অ্যাকাউন্ট পাওয়া যায়নি"
    });
  }

  res.json({
    success: true,
    user: publicUser(user)
  });
});

/* =========================================================
   USERS — SEARCH
========================================================= */

app.get("/api/users", (req, res) => {
  const q = clean(req.query.q).toLowerCase();

  if (!q) {
    return res.json({
      success: true,
      users: users.slice(0, 50).map(publicUser)
    });
  }

  const result = users
    .filter(user => {
      return (
        user.name.toLowerCase().includes(q) ||
        user.phone.includes(q)
      );
    })
    .slice(0, 50)
    .map(publicUser);

  res.json({
    success: true,
    users: result
  });
});

/* =========================================================
   USER PROFILE
========================================================= */

app.get("/api/users/:id", (req, res) => {
  const user = getUser(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User পাওয়া যায়নি"
    });
  }

  res.json({
    success: true,
    user: publicUser(user)
  });
});

/* =========================================================
   POSTS — GET
========================================================= */

app.get("/api/posts", (req, res) => {
  const result = posts
    .filter(post => post.privacy === "public")
    .sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    )
    .slice(0, 100);

  res.json({
    success: true,
    posts: result
  });
});

/* =========================================================
   POSTS — CREATE
========================================================= */

app.post("/api/posts", (req, res) => {
  const authorId = clean(req.body?.authorId);
  const author = clean(req.body?.author, "Shakib");
  const content = clean(req.body?.content);
  const type = clean(req.body?.type, "text");
  const media = clean(req.body?.media);
  const privacy = clean(req.body?.privacy, "public");

  if (!content && !media) {
    return res.status(400).json({
      success: false,
      message: "Post লিখুন বা ছবি/ভিডিও দিন"
    });
  }

  const post = {
    id: String(nextPostId++),
    authorId,
    author,
    type,
    content,
    media,
    privacy,
    likes: [],
    comments: [],
    shares: 0,
    createdAt: now()
  };

  posts.unshift(post);

  io.emit("post:created", post);

  res.status(201).json({
    success: true,
    post
  });
});

/* =========================================================
   POSTS — DELETE
========================================================= */

app.delete("/api/posts/:id", (req, res) => {
  const index = posts.findIndex(
    p => String(p.id) === String(req.params.id)
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Post পাওয়া যায়নি"
    });
  }

  const removed = posts.splice(index, 1)[0];

  io.emit("post:deleted", {
    id: removed.id
  });

  res.json({
    success: true
  });
});

/* =========================================================
   FRIEND REQUEST
========================================================= */

app.post("/api/friends/request", (req, res) => {
  const fromId = clean(req.body?.fromId);
  const toId = clean(req.body?.toId);

  const from = getUser(fromId);
  const to = getUser(toId);

  if (!from || !to) {
    return res.status(404).json({
      success: false,
      message: "User পাওয়া যায়নি"
    });
  }

  if (from.id === to.id) {
    return res.status(400).json({
      success: false,
      message: "নিজেকে friend request দেওয়া যাবে না"
    });
  }

  const existing = friendRequests.find(r =>
    r.fromId === fromId &&
    r.toId === toId &&
    r.status === "pending"
  );

  if (existing) {
    return res.json({
      success: true,
      request: existing
    });
  }

  const request = {
    id: String(nextRequestId++),
    fromId,
    toId,
    status: "pending",
    createdAt: now()
  };

  friendRequests.push(request);

  addNotification(
    toId,
    "friend_request",
    from,
    {
      requestId: request.id
    }
  );

  sendToUser(
    toId,
    "friend:request",
    request
  );

  res.json({
    success: true,
    request
  });
});

/* =========================================================
   FRIEND REQUEST — ACCEPT
========================================================= */

app.post("/api/friends/accept", (req, res) => {
  const requestId = clean(req.body?.requestId);

  const request = friendRequests.find(
    r => String(r.id) === requestId
  );

  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Request পাওয়া যায়নি"
    });
  }

  request.status = "accepted";

  const a = getUser(request.fromId);
  const b = getUser(request.toId);

  if (a && b) {
    a.friends = (a.friends || 0) + 1;
    b.friends = (b.friends || 0) + 1;

    addNotification(
      a.id,
      "friend_accepted",
      b
    );
  }

  sendToUser(
    request.fromId,
    "friend:accepted",
    request
  );

  sendToUser(
    request.toId,
    "friend:accepted",
    request
  );

  res.json({
    success: true,
    request
  });
});

/* =========================================================
   FOLLOW
========================================================= */

app.post("/api/follow", (req, res) => {
  const followerId = clean(req.body?.followerId);
  const followingId = clean(req.body?.followingId);

  const follower = getUser(followerId);
  const following = getUser(followingId);

  if (!follower || !following) {
    return res.status(404).json({
      success: false,
      message: "User পাওয়া যায়নি"
    });
  }

  if (followerId === followingId) {
    return res.status(400).json({
      success: false,
      message: "নিজেকে follow করা যাবে না"
    });
  }

  const exists = follows.some(
    f =>
      f.followerId === followerId &&
      f.followingId === followingId
  );

  if (!exists) {
    follows.push({
      followerId,
      followingId,
      createdAt: now()
    });

    follower.following =
      (follower.following || 0) + 1;

    following.followers =
      (following.followers || 0) + 1;

    addNotification(
      followingId,
      "follow",
      follower
    );
  }

  res.json({
    success: true
  });
});

/* =========================================================
   MESSAGES — HISTORY
========================================================= */

app.get("/api/messages/:userA/:userB", (req, res) => {
  const cid = conversationId(
    req.params.userA,
    req.params.userB
  );

  const result = messages.filter(
    m => m.conversationId === cid
  );

  res.json({
    success: true,
    messages: result
  });
});

/* =========================================================
   NOTIFICATIONS
========================================================= */

app.get("/api/notifications/:userId", (req, res) => {
  const result = notifications
    .filter(
      n => n.userId === String(req.params.userId)
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .slice(0, 100);

  res.json({
    success: true,
    notifications: result
  });
});

/* =========================================================
   SOCKET.IO
========================================================= */

io.on("connection", socket => {
  console.log("🟢 Connected:", socket.id);

  /* USER ONLINE */

  socket.on("user:online", data => {
    const userId = clean(data?.userId);
    const name = clean(data?.name, "Shakib");
    const phone = clean(data?.phone);

    if (!userId) return;

    socketUsers.set(socket.id, userId);
    userSockets.set(userId, socket.id);

    const user = getUser(userId);

    if (user) {
      user.online = true;
      user.lastSeen = now();

      if (name) user.name = name;
      if (phone) user.phone = phone;
    }

    io.emit("user:status", {
      userId,
      online: true
    });
  });

  /* INITIAL FEED */

  socket.emit(
    "posts:init",
    posts
      .filter(p => p.privacy === "public")
      .slice(0, 100)
  );

  /* SEND MESSAGE */

  socket.on("message:send", data => {
    const senderId = clean(data?.senderId);
    const receiverId = clean(data?.receiverId);
    const senderName = clean(
      data?.senderName,
      "Shakib"
    );
    const text = clean(data?.text);
    const type = clean(data?.type, "text");

    if (
      !senderId ||
      !receiverId ||
      !text
    ) {
      socket.emit("message:error", {
        message: "Message data অসম্পূর্ণ"
      });
      return;
    }

    const message = {
      id: String(nextMessageId++),
      conversationId:
        conversationId(senderId, receiverId),
      senderId,
      senderName,
      receiverId,
      text,
      type,
      createdAt: now()
    };

    messages.push(message);

    socket.emit(
      "message:new",
      message
    );

    sendToUser(
      receiverId,
      "message:new",
      message
    );
  });

  /* CHAT HISTORY */

  socket.on("message:history", data => {
    const userA = clean(data?.userA);
    const userB = clean(data?.userB);

    if (!userA || !userB) return;

    const cid = conversationId(
      userA,
      userB
    );

    socket.emit(
      "message:history",
      messages.filter(
        m => m.conversationId === cid
      )
    );
  });

  /* TYPING */

  socket.on("typing:start", data => {
    sendToUser(
      clean(data?.receiverId),
      "typing:start",
      {
        senderName: clean(
          data?.senderName,
          "Someone"
        )
      }
    );
  });

  socket.on("typing:stop", data => {
    sendToUser(
      clean(data?.receiverId),
      "typing:stop",
      {}
    );
  });

  /* VOICE / VIDEO CALL */

  socket.on("call:offer", data => {
    sendToUser(
      clean(data?.receiverId),
      "call:offer",
      {
        callerId: clean(data?.callerId),
        callerName: clean(
          data?.callerName,
          "Shakib"
        ),
        callType: clean(
          data?.callType,
          "voice"
        ),
        offer: data?.offer
      }
    );
  });

  socket.on("call:answer", data => {
    sendToUser(
      clean(data?.callerId),
      "call:answer",
      {
        receiverId: clean(
          data?.receiverId
        ),
        answer: data?.answer
      }
    );
  });

  socket.on("call:ice", data => {
    sendToUser(
      clean(data?.targetUserId),
      "call:ice",
      {
        candidate: data?.candidate
      }
    );
  });

  socket.on("call:reject", data => {
    sendToUser(
      clean(data?.callerId),
      "call:rejected",
      {
        receiverId: clean(
          data?.receiverId
        )
      }
    );
  });

  socket.on("call:end", data => {
    sendToUser(
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
      socketUsers.get(socket.id);

    socketUsers.delete(socket.id);

    if (userId) {
      userSockets.delete(userId);

      const user = getUser(userId);

      if (user) {
        user.online = false;
        user.lastSeen = now();
      }

      io.emit("user:status", {
        userId,
        online: false
      });
    }

    console.log(
      "🔴 Disconnected:",
      socket.id
    );
  });
});

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    app: "ShakibYS",
    server: "online",
    newsFeed: true,
    messenger: true,
    voiceCall: true,
    videoCall: true,
    friendRequest: true,
    follow: true,
    notifications: true,
    users: users.length,
    posts: posts.length,
    messages: messages.length,
    time: now()
  });
});

/* =========================================================
   FRONTEND
   Express 5 এ app.get("*") ব্যবহার করা যাবে না।
========================================================= */

app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {
    return res.sendFile(
      path.join(__dirname, "index.html")
    );
  }

  next();
});

/* =========================================================
   START
========================================================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "================================="
    );
    console.log(
      "🚀 SHAKIBYS SERVER ONLINE"
    );
    console.log(
      "================================="
    );
    console.log(
      "👤 Login/Register : ON"
    );
    console.log(
      "🔎 User Search    : ON"
    );
    console.log(
      "📰 News Feed      : ON"
    );
    console.log(
      "💬 Messenger      : ON"
    );
    console.log(
      "📞 Voice Call     : ON"
    );
    console.log(
      "🎥 Video Call     : ON"
    );
    console.log(
      "👥 Friend Request : ON"
    );
    console.log(
      "➕ Follow         : ON"
    );
    console.log(
      "🔔 Notifications  : ON"
    );
    console.log(
      "🔌 Socket.IO      : ON"
    );
    console.log(
      "🌐 PORT           :",
      PORT
    );
    console.log(
      "================================="
    );
  }
);
