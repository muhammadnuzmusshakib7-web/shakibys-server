require("dotenv").config();

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

/* =========================================================
   FRONTEND STATIC FILES
========================================================= */

app.use(express.static(__dirname));

/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/* =========================================================
   IN-MEMORY DATA
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

function makeId(prefix) {
  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );
}

function conversationId(a, b) {
  return [String(a), String(b)]
    .sort()
    .join("_");
}

function sendToUser(userId, event, data) {
  const socketId =
    userSockets.get(String(userId));

  if (!socketId) {
    return false;
  }

  io.to(socketId).emit(
    event,
    data
  );

  return true;
}

/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on("connection", (socket) => {
  console.log(
    "🟢 Socket connected:",
    socket.id
  );

  /* =======================================================
     USER ONLINE
  ======================================================= */

  socket.on(
    "user:online",
    (data) => {
      try {
        const userId = clean(
          data?.userId ||
          data?.phone ||
          socket.id
        );

        const name = clean(
          data?.name,
          "Shakib"
        );

        onlineUsers.set(
          socket.id,
          {
            userId,
            name
          }
        );

        userSockets.set(
          userId,
          socket.id
        );

        io.emit(
          "user:status",
          {
            userId,
            name,
            online: true
          }
        );

        console.log(
          "🟢 User online:",
          name
        );

      } catch (error) {
        console.error(
          "user:online:",
          error.message
        );
      }
    }
  );

  /* =======================================================
     NEWS FEED INITIAL
  ======================================================= */

  socket.emit(
    "posts:init",
    posts
      .filter(
        (post) =>
          post.privacy ===
          "public"
      )
      .slice(0, 50)
  );

  /* =======================================================
     CREATE POST
  ======================================================= */

  socket.on(
    "post:create",
    (data) => {
      try {
        const author = clean(
          data?.author,
          "Shakib"
        );

        const authorId = clean(
          data?.authorId
        );

        const content = clean(
          data?.content
        );

        const privacy = clean(
          data?.privacy,
          "public"
        );

        if (!content) {
          socket.emit(
            "post:error",
            {
              message:
                "Post লিখুন"
            }
          );

          return;
        }

        const post = {
          id: makeId("post"),

          author,

          authorId,

          content,

          privacy:
            privacy ===
            "public"
              ? "public"
              : privacy,

          likes: 0,

          comments: 0,

          shares: 0,

          createdAt:
            new Date().toISOString()
        };

        posts.unshift(post);

        if (posts.length > 200) {
          posts.pop();
        }

        if (
          post.privacy ===
          "public"
        ) {
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
          "post:create:",
          error.message
        );

        socket.emit(
          "post:error",
          {
            message:
              "Post তৈরি করা যায়নি"
          }
        );
      }
    }
  );

  /* =======================================================
     LIKE
  ======================================================= */

  socket.on(
    "post:like",
    (postId) => {
      try {
        const post =
          posts.find(
            (item) =>
              item.id ===
              postId
          );

        if (!post) {
          return;
        }

        post.likes++;

        io.emit(
          "post:updated",
          post
        );

      } catch (error) {
        console.error(
          "post:like:",
          error.message
        );
      }
    }
  );

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  socket.on(
    "message:send",
    (data) => {
      try {
        const senderId =
          clean(
            data?.senderId
          );

        const senderName =
          clean(
            data?.senderName,
            "Shakib"
          );

        const receiverId =
          clean(
            data?.receiverId
          );

        const text =
          clean(
            data?.text
          );

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
          id:
            makeId("msg"),

          conversationId:
            conversationId(
              senderId,
              receiverId
            ),

          senderId,

          senderName,

          receiverId,

          text,

          type:
            [
              "text",
              "image",
              "file"
            ].includes(type)
              ? type
              : "text",

          createdAt:
            new Date().toISOString()
        };

        messages.push(message);

        if (
          messages.length >
          2000
        ) {
          messages.shift();
        }

        /* Sender */

        socket.emit(
          "message:new",
          message
        );

        /* Receiver */

        sendToUser(
          receiverId,
          "message:new",
          message
        );

        console.log(
          "💬 Message:",
          senderName,
          "→",
          receiverId
        );

      } catch (error) {
        console.error(
          "message:send:",
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
    }
  );

  /* =======================================================
     MESSAGE HISTORY
  ======================================================= */

  socket.on(
    "message:history",
    (data) => {
      try {
        const userA =
          clean(
            data?.userA
          );

        const userB =
          clean(
            data?.userB
          );

        if (
          !userA ||
          !userB
        ) {
          return;
        }

        const cid =
          conversationId(
            userA,
            userB
          );

        const history =
          messages.filter(
            (message) =>
              message.conversationId ===
              cid
          );

        socket.emit(
          "message:history",
          history.slice(-200)
        );

      } catch (error) {
        console.error(
          "message:history:",
          error.message
        );
      }
    }
  );

  /* =======================================================
     TYPING START
  ======================================================= */

  socket.on(
    "typing:start",
    (data) => {
      const receiverId =
        clean(
          data?.receiverId
        );

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

  /* =======================================================
     TYPING STOP
  ======================================================= */

  socket.on(
    "typing:stop",
    (data) => {
      const receiverId =
        clean(
          data?.receiverId
        );

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

  /* CALL OFFER */

  socket.on(
    "call:offer",
    (data) => {
      const receiverId =
        clean(
          data?.receiverId
        );

      if (!receiverId) {
        return;
      }

      sendToUser(
        receiverId,
        "call:offer",
        {
          callerId:
            clean(
              data?.callerId
            ),

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

  /* CALL ANSWER */

  socket.on(
    "call:answer",
    (data) => {
      const callerId =
        clean(
          data?.callerId
        );

      if (!callerId) {
        return;
      }

      sendToUser(
        callerId,
        "call:answer",
        {
          receiverId:
            clean(
              data?.receiverId
            ),

          answer:
            data?.answer
        }
      );
    }
  );

  /* ICE */

  socket.on(
    "call:ice",
    (data) => {
      const targetUserId =
        clean(
          data?.targetUserId
        );

      if (!targetUserId) {
        return;
      }

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

  /* REJECT */

  socket.on(
    "call:reject",
    (data) => {
      const callerId =
        clean(
          data?.callerId
        );

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

  /* END */

  socket.on(
    "call:end",
    (data) => {
      const targetUserId =
        clean(
          data?.targetUserId
        );

      sendToUser(
        targetUserId,
        "call:ended",
        {
          from:
            clean(
              data?.from
            )
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
      const info =
        onlineUsers.get(
          socket.id
        );

      onlineUsers.delete(
        socket.id
      );

      if (!info) {
        return;
      }

      const currentSocket =
        userSockets.get(
          info.userId
        );

      if (
        currentSocket ===
        socket.id
      ) {
        userSockets.delete(
          info.userId
        );

        io.emit(
          "user:status",
          {
            userId:
              info.userId,

            name:
              info.name,

            online:
              false
          }
        );
      }

      console.log(
        "🔴 User offline:",
        info.name
      );
    }
  );
});

/* =========================================================
   HEALTH API
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,

      app:
        "ShakibYS",

      server:
        "online",

      database:
        "in-memory",

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

      time:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   GET POSTS
========================================================= */

app.get(
  "/api/posts",
  (req, res) => {
    res.json({
      success: true,

      posts:
        posts
          .filter(
            (post) =>
              post.privacy ===
              "public"
          )
          .slice(0, 50)
    });
  }
);

/* =========================================================
   CREATE POST API
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

      io.emit(
        "post:created",
        post
      );

      res.status(201).json({
        success: true,

        post
      });

    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          "Post তৈরি করা যায়নি"
      });
    }
  }
);

/* =========================================================
   CHAT HISTORY API
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
        messages.filter(
          (message) =>
            message.conversationId ===
            cid
        );

      res.json({
        success: true,

        messages:
          result.slice(-200)
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
            method:
              "POST",

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
        data?.choices?.[0]
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
   FRONTEND FALLBACK
   IMPORTANT:
   Express 5 এ app.get("*") ব্যবহার করা হয়নি।
========================================================= */

app.use(
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
);

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
      "📰 News Feed : ON"
    );

    console.log(
      "💬 Messenger : ON"
    );

    console.log(
      "📞 Voice Call : ON"
    );

    console.log(
      "🎥 Video Call: ON"
    );

    console.log(
      "🔌 Socket.IO : ON"
    );

    console.log(
      "🤖 AI API    :",
      OPENAI_API_KEY
        ? "ON"
        : "OFF"
    );

    console.log(
      "💾 Database  : IN-MEMORY"
    );

    console.log(
      "🌐 PORT      :",
      PORT
    );

    console.log(
      "================================="
    );

    console.log("");
  }
);
