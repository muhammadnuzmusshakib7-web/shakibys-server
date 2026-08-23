আচ্ছা require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* =========================================================
   MEMORY STORAGE
   ========================================================= */

const posts = [];
const messages = [];

const onlineUsers = new Map();
const userSockets = new Map();

/* =========================================================
   HELPERS
   ========================================================= */

function clean(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function makeId(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 9)
  );
}

function conversationId(a, b) {
  return [String(a), String(b)].sort().join("_");
}

function sendToUser(userId, event, data) {
  const socketId = userSockets.get(String(userId));

  if (!socketId) return false;

  io.to(socketId).emit(event, data);
  return true;
}

/* =========================================================
   SOCKET.IO
   ========================================================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {

  console.log("🟢 Socket connected:", socket.id);

  /* =======================================================
     USER ONLINE
     ======================================================= */

  socket.on("user:online", (data) => {

    try {

      const userId =
        clean(data?.userId) ||
        clean(data?.phone);

      const name =
        clean(data?.name, "Shakib");

      if (!userId) return;

      onlineUsers.set(socket.id, {
        userId,
        name
      });

      userSockets.set(userId, socket.id);

      io.emit("user:status", {
        userId,
        name,
        online: true
      });

      console.log("🟢 User online:", name, userId);

    } catch (error) {

      console.error(
        "user:online error:",
        error.message
      );

    }

  });

  /* =======================================================
     INITIAL NEWS FEED
     ======================================================= */

  socket.emit(
    "posts:init",
    posts.slice(0, 50)
  );

  /* =======================================================
     CREATE POST
     ======================================================= */

  socket.on("post:create", (data) => {

    try {

      const author =
        clean(data?.author, "Shakib");

      const authorId =
        clean(data?.authorId);

      const content =
        clean(data?.content);

      const privacy =
        clean(data?.privacy, "public");

      if (!content) {

        socket.emit("post:error", {
          message: "Post লিখুন"
        });

        return;
      }

      if (
        !["public", "friends", "private"]
          .includes(privacy)
      ) {

        socket.emit("post:error", {
          message: "Privacy ভুল"
        });

        return;
      }

      const post = {

        id: makeId("post"),

        author,

        authorId,

        content,

        privacy,

        likes: 0,

        comments: 0,

        shares: 0,

        createdAt: new Date().toISOString()

      };

      posts.unshift(post);

      /*
        Memory limit
      */

      if (posts.length > 500) {
        posts.length = 500;
      }

      if (privacy === "public") {

        io.emit(
          "post:created",
          post
        );

      } else {

        socket.emit(
          "post:created",
          post
        );

      }

      console.log(
        "📝 Post created:",
        author
      );

    } catch (error) {

      console.error(
        "post:create error:",
        error.message
      );

      socket.emit("post:error", {
        message: "Post তৈরি করা যায়নি"
      });

    }

  });

  /* =======================================================
     LIKE POST
     ======================================================= */

  socket.on("post:like", (postId) => {

    const post =
      posts.find(
        p => p.id === postId
      );

    if (!post) return;

    post.likes++;

    io.emit(
      "post:updated",
      post
    );

  });

  /* =======================================================
     SEND MESSAGE
     ======================================================= */

  socket.on("message:send", (data) => {

    try {

      const senderId =
        clean(data?.senderId);

      const senderName =
        clean(
          data?.senderName,
          "Shakib"
        );

      const receiverId =
        clean(data?.receiverId);

      const text =
        clean(data?.text);

      const type =
        clean(
          data?.type,
          "text"
        );

      if (
        !senderId ||
        !receiverId ||
        !text
      ) {

        socket.emit(
          "message:error",
          {
            message:
              "Message data অসম্পূর্ণ"
          }
        );

        return;
      }

      const message = {

        id: makeId("msg"),

        conversationId:
          conversationId(
            senderId,
            receiverId
          ),

        senderId,

        senderName,

        receiverId,

        text,

        type,

        createdAt:
          new Date().toISOString()

      };

      messages.push(message);

      if (messages.length > 2000) {
        messages.splice(
          0,
          messages.length - 2000
        );
      }

      /*
        Sender
      */

      socket.emit(
        "message:new",
        message
      );

      /*
        Receiver
      */

      sendToUser(
        receiverId,
        "message:new",
        message
      );

      console.log(
        `💬 ${senderName} → ${receiverId}: ${text}`
      );

    } catch (error) {

      console.error(
        "message:send error:",
        error.message
      );

      socket.emit(
        "message:error",
        {
          message:
            "Message পাঠানো যায়নি"
        }
      );

    }

  });

  /* =======================================================
     MESSAGE HISTORY
     ======================================================= */

  socket.on(
    "message:history",
    (data) => {

      const userA =
        clean(data?.userA);

      const userB =
        clean(data?.userB);

      if (!userA || !userB) return;

      const cid =
        conversationId(
          userA,
          userB
        );

      const history =
        messages
          .filter(
            m =>
              m.conversationId === cid
          )
          .slice(-200);

      socket.emit(
        "message:history",
        history
      );

    }
  );

  /* =======================================================
     TYPING
     ======================================================= */

  socket.on(
    "typing:start",
    (data) => {

      const receiverId =
        clean(data?.receiverId);

      const senderName =
        clean(
          data?.senderName,
          "Someone"
        );

      sendToUser(
        receiverId,
        "typing:start",
        {
          senderName
        }
      );

    }
  );

  socket.on(
    "typing:stop",
    (data) => {

      const receiverId =
        clean(data?.receiverId);

      sendToUser(
        receiverId,
        "typing:stop",
        {}
      );

    }
  );

  /* =======================================================
     AUDIO / VIDEO CALL
     WEBRTC SIGNALING
     ======================================================= */

  /*
     CALL OFFER
  */

  socket.on(
    "call:offer",
    (data) => {

      const receiverId =
        clean(data?.receiverId);

      if (!receiverId) return;

      sendToUser(
        receiverId,
        "call:offer",
        {

          callerId:
            clean(data?.callerId),

          callerName:
            clean(
              data?.callerName,
              "Shakib"
            ),

          callType:
            clean(
              data?.callType,
              "voice"
            ),

          offer:
            data?.offer

        }
      );

      console.log(
        "📞 Call offer →",
        receiverId
      );

    }
  );

  /*
     CALL ANSWER
  */

  socket.on(
    "call:answer",
    (data) => {

      const callerId =
        clean(data?.callerId);

      if (!callerId) return;

      sendToUser(
        callerId,
        "call:answer",
        {

          receiverId:
            clean(data?.receiverId),

          answer:
            data?.answer

        }
      );

      console.log(
        "📞 Call answer →",
        callerId
      );

    }
  );

  /*
     ICE CANDIDATE
  */

  socket.on(
    "call:ice",
    (data) => {

      const targetUserId =
        clean(
          data?.targetUserId
        );

      if (!targetUserId) return;

      sendToUser(
        targetUserId,
        "call:ice",
        {

          candidate:
            data?.candidate

        }
      );

    }
  );

  /*
     REJECT CALL
  */

  socket.on(
    "call:reject",
    (data) => {

      const callerId =
        clean(data?.callerId);

      if (!callerId) return;

      sendToUser(
        callerId,
        "call:rejected",
        {

          receiverId:
            clean(
              data?.receiverId
            )

        }
      );

    }
  );

  /*
     END CALL
  */

  socket.on(
    "call:end",
    (data) => {

      const targetUserId =
        clean(
          data?.targetUserId
        );

      if (!targetUserId) return;

      sendToUser(
        targetUserId,
        "call:ended",
        {

          from:
            clean(data?.from)

        }
      );

    }
  );

  /* =======================================================
     DISCONNECT
     ======================================================= */

  socket.on(
    "disconnect",
    () => {

      const user =
        onlineUsers.get(
          socket.id
        );

      onlineUsers.delete(
        socket.id
      );

      if (user) {

        /*
          Only delete if this socket
          is still the current socket
        */

        if (
          userSockets.get(
            user.userId
          ) === socket.id
        ) {

          userSockets.delete(
            user.userId
          );

        }

        io.emit(
          "user:status",
          {

            userId:
              user.userId,

            name:
              user.name,

            online:
              false

          }
        );

        console.log(
          "🔴 User offline:",
          user.name
        );

      }

      console.log(
        "🔴 Socket disconnected:",
        socket.id
      );

    }
  );

});

/* =========================================================
   REST API — HEALTH
   ========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      app: "ShakibYS",

      server: "online",

      database:
        "not configured",

      socket:
        "enabled",

      messenger:
        "enabled",

      voiceCall:
        "enabled",

      videoCall:
        "enabled",

      newsFeed:
        "enabled",

      ai:
        OPENAI_API_KEY
          ? "enabled"
          : "not configured",

      onlineUsers:
        userSockets.size,

      posts:
        posts.length,

      messages:
        messages.length,

      time:
        new Date().toISOString()

    });

  }
);

/* =========================================================
   REST API — NEWS FEED
   ========================================================= */

app.get(
  "/api/posts",
  (req, res) => {

    res.json({

      success: true,

      posts:
        posts
          .filter(
            p =>
              p.privacy === "public"
          )
          .slice(0, 50)

    });

  }
);

/* =========================================================
   REST API — CREATE POST
   ========================================================= */

app.post(
  "/api/posts",
  (req, res) => {

    try {

      const author =
        clean(
          req.body?.author,
          "Shakib"
        );

      const content =
        clean(
          req.body?.content
        );

      if (!content) {

        return res.status(400).json({

          success: false,

          message:
            "Post লিখুন"

        });

      }

      const post = {

        id:
          makeId("post"),

        author,

        authorId:
          clean(
            req.body?.authorId
          ),

        content,

        privacy:
          "public",

        likes: 0,

        comments: 0,

        shares: 0,

        createdAt:
          new Date().toISOString()

      };

      posts.unshift(post);

      if (posts.length > 500) {
        posts.length = 500;
      }

      io.emit(
        "post:created",
        post
      );

      res.status(201).json({

        success: true,

        post

      });

    } catch (error) {

      console.error(
        "REST post error:",
        error.message
      );

      res.status(500).json({

        success: false,

        message:
          "Post তৈরি করা যায়নি"

      });

    }

  }
);

/* =========================================================
   REST API — MESSAGE HISTORY
   ========================================================= */

app.get(
  "/api/messages/:userA/:userB",
  (req, res) => {

    try {

      const cid =
        conversationId(
          req.params.userA,
          req.params.userB
        );

      const result =
        messages
          .filter(
            m =>
              m.conversationId === cid
          )
          .slice(-200);

      res.json({

        success: true,

        messages: result

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          "Messages পাওয়া যায়নি"

      });

    }

  }
);

/* =========================================================
   AI API
   ========================================================= */

app.post(
  "/api/ai",
  async (req, res) => {

    try {

      const question =
        clean(
          req.body?.message
        );

      if (!question) {

        return res.status(400).json({

          success: false,

          message:
            "প্রশ্ন লিখুন"

        });

      }

      if (!OPENAI_API_KEY) {

        return res.status(503).json({

          success: false,

          message:
            "OPENAI_API_KEY সেট করা হয়নি"

        });

      }

      const response =
        await fetch(
          "https://api.openai.com/v1/chat/completions",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${OPENAI_API_KEY}`

            },

            body:
              JSON.stringify({

                model:
                  process.env.AI_MODEL ||
                  "gpt-4o-mini",

                messages: [

                  {

                    role:
                      "system",

                    content:
                      "You are ShakibYS AI. Answer naturally and helpfully. If the user writes Bengali, respond in Bengali."

                  },

                  {

                    role:
                      "user",

                    content:
                      question

                  }

                ],

                temperature:
                  0.7,

                max_tokens:
                  700

              })

          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        console.error(
          "AI API error:",
          data
        );

        return res.status(
          response.status
        ).json({

          success: false,

          message:
            data?.error?.message ||
            "AI response পাওয়া যায়নি"

        });

      }

      const answer =
        data
          ?.choices?.[0]
          ?.message?.content ||
        "AI কোনো উত্তর দেয়নি।";

      res.json({

        success: true,

        answer

      });

    } catch (error) {

      console.error(
        "AI error:",
        error.message
      );

      res.status(500).json({

        success: false,

        message:
          "AI server error"

      });

    }

  }
);

/* =========================================================
   FRONTEND
   ========================================================= */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);

/*
   Any normal frontend route
*/

app.get(
  "/*",
  (req, res, next) => {

    if (
      req.path.startsWith("/api/")
    ) {

      return next();

    }

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);

/* =========================================================
   START SERVER
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
      "💾 Database     : MEMORY"
    );

    console.log(
      "📰 News Feed    : ON"
    );

    console.log(
      "💬 Messenger    : ON"
    );

    console.log(
      "📞 Voice Call   : ON"
    );

    console.log(
      "🎥 Video Call   : ON"
    );

    console.log(
      "🤖 AI API       :",
      OPENAI_API_KEY
        ? "ON"
        : "OFF"
    );

    console.log(
      "🔌 Socket.IO    : ON"
    );

    console.log(
      "🌐 PORT         :",
      PORT
    );

    console.log(
      "================================="
    );

    console.log("");

  }
);
