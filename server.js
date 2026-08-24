const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   DEMO DATABASE
========================= */

const users = [];
const posts = [];
const messages = [];
const notifications = [];
const friendRequests = [];
const follows = [];

let userId = 1;
let postId = 1;

/* =========================
   HELPERS
========================= */

function findUser(id) {
  return users.find(u => String(u.id) === String(id));
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    phone: user.phone,
    bio: user.bio,
    avatar: user.avatar,
    cover: user.cover,
    online: user.online,
    friends: user.friends.length,
    followers: follows.filter(x => x.followingId === user.id).length,
    following: follows.filter(x => x.followerId === user.id).length,
    createdAt: user.createdAt
  };
}

/* =========================
   AUTH
========================= */

app.post("/api/auth/register", (req, res) => {
  const { name, phone, password } = req.body;

  if (!name || !phone) {
    return res.json({
      success: false,
      message: "নাম ও মোবাইল নাম্বার দিন"
    });
  }

  if (users.some(u => u.phone === phone)) {
    return res.json({
      success: false,
      message: "এই নাম্বার আগে ব্যবহার করা হয়েছে"
    });
  }

  const user = {
    id: String(userId++),
    name,
    username: "user" + Date.now(),
    phone,
    password: password || "",
    bio: "",
    avatar: "",
    cover: "",
    online: true,
    friends: [],
    createdAt: new Date().toISOString()
  };

  users.push(user);

  res.json({
    success: true,
    user: publicUser(user)
  });
});

app.post("/api/auth/login", (req, res) => {
  const { phone, password } = req.body;

  const user = users.find(u => u.phone === phone);

  if (!user) {
    return res.json({
      success: false,
      message: "Account পাওয়া যায়নি"
    });
  }

  if (user.password && user.password !== password) {
    return res.json({
      success: false,
      message: "Password ভুল"
    });
  }

  user.online = true;

  res.json({
    success: true,
    user: publicUser(user)
  });
});

app.post("/api/auth/logout", (req, res) => {
  const user = findUser(req.body.userId);

  if (user) user.online = false;

  res.json({ success: true });
});

/* =========================
   USERS
========================= */

app.get("/api/users", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();

  const result = users
    .filter(u =>
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      u.username.toLowerCase().includes(q)
    )
    .map(publicUser);

  res.json({ success: true, users: result });
});

app.get("/api/users/:id", (req, res) => {
  const user = findUser(req.params.id);

  if (!user) {
    return res.json({
      success: false,
      message: "User পাওয়া যায়নি"
    });
  }

  res.json({
    success: true,
    user: publicUser(user)
  });
});

app.put("/api/users/:id", (req, res) => {
  const user = findUser(req.params.id);

  if (!user) {
    return res.json({
      success: false,
      message: "User পাওয়া যায়নি"
    });
  }

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.bio !== undefined) user.bio = req.body.bio;
  if (req.body.avatar !== undefined) user.avatar = req.body.avatar;
  if (req.body.cover !== undefined) user.cover = req.body.cover;

  res.json({
    success: true,
    user: publicUser(user)
  });
});

/* =========================
   POSTS
========================= */

app.get("/api/posts", (req, res) => {
  const result = [...posts].reverse();

  res.json({
    success: true,
    posts: result
  });
});

app.post("/api/posts", (req, res) => {
  const {
    authorId,
    content,
    media,
    type,
    title,
    hashtag,
    location,
    privacy
  } = req.body;

  const user = findUser(authorId);

  if (!user) {
    return res.json({
      success: false,
      message: "User পাওয়া যায়নি"
    });
  }

  if (!content && !media) {
    return res.json({
      success: false,
      message: "Post-এর content বা media দিন"
    });
  }

  const post = {
    id: String(postId++),
    authorId: user.id,
    author: user.name,
    authorAvatar: user.avatar || "",
    content: content || "",
    media: media || "",
    type: type || "text",
    title: title || "",
    hashtag: hashtag || "",
    location: location || "",
    privacy: privacy || "public",
    likes: [],
    comments: [],
    shares: 0,
    saves: [],
    views: 0,
    createdAt: new Date().toISOString()
  };

  posts.push(post);

  io.emit("post:new", post);

  res.json({
    success: true,
    post
  });
});

app.post("/api/posts/:id/react", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.json({
      success: false,
      message: "Post পাওয়া যায়নি"
    });
  }

  const userId = String(req.body.userId);

  if (post.likes.includes(userId)) {
    post.likes = post.likes.filter(id => id !== userId);
  } else {
    post.likes.push(userId);
  }

  io.emit("post:updated", post);

  res.json({
    success: true,
    likes: post.likes.length
  });
});

app.post("/api/posts/:id/comment", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.json({
      success: false,
      message: "Post পাওয়া যায়নি"
    });
  }

  const user = findUser(req.body.userId);

  if (!user || !req.body.text) {
    return res.json({
      success: false,
      message: "Comment লিখুন"
    });
  }

  const comment = {
    id: Date.now().toString(),
    userId: user.id,
    userName: user.name,
    text: req.body.text,
    createdAt: new Date().toISOString()
  };

  post.comments.push(comment);

  io.emit("comment:new", {
    postId: post.id,
    comment
  });

  res.json({
    success: true,
    comment
  });
});

app.post("/api/posts/:id/share", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.json({
      success: false
    });
  }

  post.shares++;

  res.json({
    success: true,
    shares: post.shares
  });
});

app.post("/api/posts/:id/save", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.json({
      success: false
    });
  }

  const userId = String(req.body.userId);

  if (post.saves.includes(userId)) {
    post.saves = post.saves.filter(id => id !== userId);
  } else {
    post.saves.push(userId);
  }

  res.json({
    success: true,
    saved: post.saves.includes(userId)
  });
});

/* =========================
   FRIEND
========================= */

app.post("/api/friends/request", (req, res) => {
  const { fromId, toId } = req.body;

  const from = findUser(fromId);
  const to = findUser(toId);

  if (!from || !to) {
    return res.json({
      success: false,
      message: "User পাওয়া যায়নি"
    });
  }

  if (from.friends.includes(to.id)) {
    return res.json({
      success: false,
      message: "Already friends"
    });
  }

  friendRequests.push({
    id: Date.now().toString(),
    fromId: from.id,
    toId: to.id,
    status: "pending",
    createdAt: new Date().toISOString()
  });

  notifications.push({
    id: Date.now().toString(),
    userId: to.id,
    fromUserName: from.name,
    type: "friend_request",
    createdAt: new Date().toISOString()
  });

  io.to("user_" + to.id).emit("notification:new");

  res.json({
    success: true,
    message: "Friend request sent"
  });
});

app.post("/api/friends/accept", (req, res) => {
  const request = friendRequests.find(
    r =>
      r.id === req.body.requestId &&
      r.status === "pending"
  );

  if (!request) {
    return res.json({
      success: false,
      message: "Request পাওয়া যায়নি"
    });
  }

  const a = findUser(request.fromId);
  const b = findUser(request.toId);

  if (!a || !b) {
    return res.json({ success: false });
  }

  if (!a.friends.includes(b.id)) {
    a.friends.push(b.id);
  }

  if (!b.friends.includes(a.id)) {
    b.friends.push(a.id);
  }

  request.status = "accepted";

  res.json({
    success: true
  });
});

/* =========================
   FOLLOW
========================= */

app.post("/api/follow", (req, res) => {
  const { followerId, followingId } = req.body;

  if (
    !findUser(followerId) ||
    !findUser(followingId)
  ) {
    return res.json({
      success: false
    });
  }

  const exists = follows.some(
    f =>
      f.followerId === String(followerId) &&
      f.followingId === String(followingId)
  );

  if (exists) {
    return res.json({
      success: true,
      following: false
    });
  }

  follows.push({
    followerId: String(followerId),
    followingId: String(followingId)
  });

  res.json({
    success: true,
    following: true
  });
});

/* =========================
   MESSAGES
========================= */

app.get("/api/messages/:a/:b", (req, res) => {
  const a = String(req.params.a);
  const b = String(req.params.b);

  const result = messages.filter(
    m =>
      (m.senderId === a && m.receiverId === b) ||
      (m.senderId === b && m.receiverId === a)
  );

  res.json({
    success: true,
    messages: result
  });
});

app.post("/api/messages", (req, res) => {
  const message = {
    id: Date.now().toString(),
    senderId: String(req.body.senderId),
    receiverId: String(req.body.receiverId),
    text: req.body.text || "",
    type: req.body.type || "text",
    seen: false,
    createdAt: new Date().toISOString()
  };

  messages.push(message);

  io.to("user_" + message.receiverId)
    .emit("message:new", message);

  io.to("user_" + message.senderId)
    .emit("message:new", message);

  res.json({
    success: true,
    message
  });
});

/* =========================
   NOTIFICATIONS
========================= */

app.get("/api/notifications/:id", (req, res) => {
  res.json({
    success: true,
    notifications: notifications.filter(
      n => String(n.userId) === String(req.params.id)
    )
  });
});

/* =========================
   SOCKET.IO
========================= */

io.on("connection", socket => {

  socket.on("user:online", data => {
    socket.join("user_" + data.userId);

    const user = findUser(data.userId);

    if (user) {
      user.online = true;

      io.emit("user:status", {
        userId: user.id,
        online: true
      });
    }
  });

  socket.on("disconnect", () => {
    // Production version will maintain
    // multi-device presence here.
  });

  socket.on("message:send", data => {
    const message = {
      id: Date.now().toString(),
      senderId: String(data.senderId),
      receiverId: String(data.receiverId),
      text: data.text || "",
      type: data.type || "text",
      seen: false,
      createdAt: new Date().toISOString()
    };

    messages.push(message);

    io.to("user_" + message.receiverId)
      .emit("message:new", message);

    io.to("user_" + message.senderId)
      .emit("message:new", message);
  });

  socket.on("typing:start", data => {
    io.to("user_" + data.receiverId)
      .emit("typing:start", {
        senderName: data.senderName
      });
  });

  socket.on("typing:stop", data => {
    io.to("user_" + data.receiverId)
      .emit("typing:stop");
  });

  socket.on("call:offer", data => {
    io.to("user_" + data.receiverId)
      .emit("call:offer", data);
  });

  socket.on("call:answer", data => {
    io.to("user_" + data.callerId)
      .emit("call:answer", data);
  });

  socket.on("call:ice", data => {
    io.to("user_" + data.targetUserId)
      .emit("call:ice", data);
  });

  socket.on("call:end", data => {
    io.to("user_" + data.targetUserId)
      .emit("call:ended");
  });

  socket.on("call:reject", data => {
    io.to("user_" + data.callerId)
      .emit("call:rejected");
  });
});

/* =========================
   FRONTEND FALLBACK
========================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

server.listen(PORT, () => {
  console.log(`ShakibYS running on port ${PORT}`);
});
