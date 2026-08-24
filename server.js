const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

const db = new Database(
  process.env.DB_PATH || "shakibys.db"
);

app.use(express.json({limit:"10mb"}));
app.use(express.urlencoded({extended:true}));

app.use(express.static(path.join(__dirname)));

db.pragma("journal_mode = WAL");


/* ================= DATABASE ================= */

db.exec(`

CREATE TABLE IF NOT EXISTS users(

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  name TEXT NOT NULL,

  username TEXT NOT NULL UNIQUE,

  phone TEXT NOT NULL UNIQUE,

  password_hash TEXT NOT NULL,

  bio TEXT DEFAULT '',

  created_at TEXT DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS sessions(

  token TEXT PRIMARY KEY,

  user_id INTEGER NOT NULL,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS posts(

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id INTEGER NOT NULL,

  content TEXT DEFAULT '',

  image TEXT DEFAULT '',

  likes INTEGER DEFAULT 0,

  comments INTEGER DEFAULT 0,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS reactions(

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  post_id INTEGER NOT NULL,

  user_id INTEGER NOT NULL,

  UNIQUE(post_id,user_id)

);

CREATE TABLE IF NOT EXISTS post_comments(

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  post_id INTEGER NOT NULL,

  user_id INTEGER NOT NULL,

  text TEXT NOT NULL,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS friend_requests(

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  sender_id INTEGER NOT NULL,

  receiver_id INTEGER NOT NULL,

  status TEXT DEFAULT 'pending',

  UNIQUE(sender_id,receiver_id)

);

CREATE TABLE IF NOT EXISTS messages(

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  sender_id INTEGER NOT NULL,

  receiver_name TEXT NOT NULL,

  text TEXT NOT NULL,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP

);

`);


/* ================= HELPERS ================= */

function clean(value){

  return String(value || "").trim();
}


function createToken(){

  return crypto.randomBytes(48).toString("hex");
}


function getUserFromRequest(req){

  const token =
    req.headers.authorization?.replace("Bearer ","");

  if(!token) return null;

  const session =
    db.prepare(`
      SELECT *
      FROM sessions
      WHERE token = ?
    `).get(token);

  if(!session) return null;

  return db.prepare(`
    SELECT *
    FROM users
    WHERE id = ?
  `).get(session.user_id);
}


function requireAuth(req,res,next){

  const user =
    getUserFromRequest(req);

  if(!user){

    return res.status(401).json({
      error:"Authentication required"
    });
  }

  req.user = user;

  next();
}


/* ================= AUTH ================= */

app.post("/api/auth/register",async(req,res)=>{

  try{

    const name = clean(req.body.name);
    const username = clean(req.body.username).toLowerCase();
    const phone = clean(req.body.phone);
    const password = String(req.body.password || "");

    if(!name || !username || !phone || !password){

      return res.status(400).json({
        error:"সব তথ্য পূরণ করুন।"
      });
    }

    if(password.length < 6){

      return res.status(400).json({
        error:"Password কমপক্ষে 6 characters হতে হবে।"
      });
    }

    const existing =
      db.prepare(`
        SELECT id
        FROM users
        WHERE username = ?
           OR phone = ?
      `).get(username,phone);

    if(existing){

      return res.status(409).json({
        error:"Username অথবা Phone আগে থেকেই ব্যবহার হয়েছে।"
      });
    }

    const hash =
      await bcrypt.hash(password,12);

    const result =
      db.prepare(`
        INSERT INTO users
        (name,username,phone,password_hash)
        VALUES (?,?,?,?)
      `).run(
        name,
        username,
        phone,
        hash
      );

    res.json({
      success:true,
      userId:result.lastInsertRowid
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      error:"Registration failed"
    });
  }
});


app.post("/api/auth/login",async(req,res)=>{

  try{

    const phone = clean(req.body.phone);
    const password = String(req.body.password || "");

    const user =
      db.prepare(`
        SELECT *
        FROM users
        WHERE phone = ?
      `).get(phone);

    if(!user){

      return res.status(401).json({
        error:"Invalid phone or password"
      });
    }

    const valid =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if(!valid){

      return res.status(401).json({
        error:"Invalid phone or password"
      });
    }

    const token = createToken();

    db.prepare(`
      INSERT INTO sessions(token,user_id)
      VALUES (?,?)
    `).run(token,user.id);

    res.json({

      success:true,

      token,

      user:{
        id:user.id,
        name:user.name,
        username:user.username,
        phone:user.phone,
        bio:user.bio
      }

    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      error:"Login failed"
    });
  }
});


app.post("/api/auth/logout",requireAuth,(req,res)=>{

  const token =
    req.headers.authorization?.replace("Bearer ","");

  if(token){

    db.prepare(`
      DELETE FROM sessions
      WHERE token = ?
    `).run(token);

  }

  res.json({
    success:true
  });
});


/* ================= USERS ================= */

app.get("/api/users",requireAuth,(req,res)=>{

  const users =
    db.prepare(`
      SELECT id,name,username,bio
      FROM users
      ORDER BY id DESC
    `).all();

  res.json({users});
});


app.get("/api/users/:id",requireAuth,(req,res)=>{

  const user =
    db.prepare(`
      SELECT
        u.id,
        u.name,
        u.username,
        u.phone,
        u.bio,
        u.created_at,
        COUNT(p.id) AS post_count
      FROM users u
      LEFT JOIN posts p
        ON p.user_id = u.id
      WHERE u.id = ?
      GROUP BY u.id
    `).get(req.params.id);

  if(!user){

    return res.status(404).json({
      error:"User not found"
    });
  }

  res.json({user});
});


/* ================= FEED ================= */

app.get("/api/feed",requireAuth,(req,res)=>{

  const posts =
    db.prepare(`
      SELECT
        p.*,
        u.name,
        u.username
      FROM posts p
      JOIN users u
        ON u.id = p.user_id
      ORDER BY p.id DESC
      LIMIT 100
    `).all();

  res.json({posts});
});


/* ================= POSTS ================= */

app.post("/api/posts",requireAuth,(req,res)=>{

  const content =
    clean(req.body.content);

  const image =
    clean(req.body.image);

  if(!content && !image){

    return res.status(400).json({
      error:"Post cannot be empty"
    });
  }

  const result =
    db.prepare(`
      INSERT INTO posts
      (user_id,content,image)
      VALUES (?,?,?)
    `).run(
      req.user.id,
      content,
      image
    );

  res.json({
    success:true,
    postId:result.lastInsertRowid
  });
});


app.post("/api/posts/:id/react",requireAuth,(req,res)=>{

  const postId =
    Number(req.params.id);

  const exists =
    db.prepare(`
      SELECT id
      FROM reactions
      WHERE post_id = ?
      AND user_id = ?
    `).get(
      postId,
      req.user.id
    );

  if(exists){

    db.prepare(`
      DELETE FROM reactions
      WHERE post_id = ?
      AND user_id = ?
    `).run(
      postId,
      req.user.id
    );

    db.prepare(`
      UPDATE posts
      SET likes = MAX(likes - 1,0)
      WHERE id = ?
    `).run(postId);

  }else{

    db.prepare(`
      INSERT INTO reactions
      (post_id,user_id)
      VALUES (?,?)
    `).run(
      postId,
      req.user.id
    );

    db.prepare(`
      UPDATE posts
      SET likes = likes + 1
      WHERE id = ?
    `).run(postId);
  }

  res.json({
    success:true
  });
});


app.post("/api/posts/:id/comment",requireAuth,(req,res)=>{

  const text =
    clean(req.body.text);

  if(!text){

    return res.status(400).json({
      error:"Comment empty"
    });
  }

  const postId =
    Number(req.params.id);

  db.prepare(`
    INSERT INTO post_comments
    (post_id,user_id,text)
    VALUES (?,?,?)
  `).run(
    postId,
    req.user.id,
    text
  );

  db.prepare(`
    UPDATE posts
    SET comments = comments + 1
    WHERE id = ?
  `).run(postId);

  res.json({
    success:true
  });
});


/* ================= FRIENDS ================= */

app.post("/api/friends/request",requireAuth,(req,res)=>{

  const receiver =
    Number(req.body.userId);

  if(!receiver){

    return res.status(400).json({
      error:"Invalid user"
    });
  }

  if(receiver === req.user.id){

    return res.status(400).json({
      error:"নিজেকে friend request পাঠানো যাবে না।"
    });
  }

  try{

    db.prepare(`
      INSERT INTO friend_requests
      (sender_id,receiver_id)
      VALUES (?,?)
    `).run(
      req.user.id,
      receiver
    );

    res.json({
      success:true,
      message:"Friend request sent."
    });

  }catch(e){

    res.status(409).json({
      error:"Request already exists."
    });
  }
});


/* ================= MESSAGES ================= */

app.get("/api/messages",requireAuth,(req,res)=>{

  const withName =
    clean(req.query.with);

  const messages =
    db.prepare(`
      SELECT
        m.id,
        m.text,
        m.created_at,
        u.username AS sender
      FROM messages m
      JOIN users u
        ON u.id = m.sender_id
      WHERE
        (
          m.sender_id = ?
          AND m.receiver_name = ?
        )
        OR
        (
          m.sender_id IN (
            SELECT id
            FROM users
            WHERE username = ?
          )
          AND m.receiver_name = ?
        )
      ORDER BY m.id ASC
    `).all(
      req.user.id,
      withName,
      withName,
      req.user.username
    );

  res.json({messages});
});


app.post("/api/messages",requireAuth,(req,res)=>{

  const receiver =
    clean(req.body.receiver);

  const text =
    clean(req.body.text);

  if(!receiver || !text){

    return res.status(400).json({
      error:"Receiver এবং message required"
    });
  }

  const result =
    db.prepare(`
      INSERT INTO messages
      (sender_id,receiver_name,text)
      VALUES (?,?,?)
    `).run(
      req.user.id,
      receiver,
      text
    );

  res.json({
    success:true,
    messageId:result.lastInsertRowid
  });
});


/* ================= MARKETPLACE ================= */

app.get("/api/marketplace",requireAuth,(req,res)=>{

  /*
   * Product database পরে আলাদা products table-এ যাবে।
   * Step-1-এ marketplace endpoint structure রাখা হলো।
   */

  res.json({
    products:[
      {
        id:1,
        title:"Smart Phone",
        price:15000,
        image:"https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=700",
        description:"Smart phone marketplace listing."
      },
      {
        id:2,
        title:"Premium Watch",
        price:1000,
        image:"https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=700",
        description:"Premium watch listing."
      }
    ]
  });
});


/* ================= SEARCH ================= */

app.get("/api/search",requireAuth,(req,res)=>{

  const q =
    `%${clean(req.query.q)}%`;

  const users =
    db.prepare(`
      SELECT id,name,username,bio
      FROM users
      WHERE name LIKE ?
         OR username LIKE ?
      LIMIT 50
    `).all(q,q);

  res.json({users});
});


/* ================= HEALTH ================= */

app.get("/api/health",(req,res)=>{

  res.json({
    status:"online",
    app:"ShakibYS",
    database:"connected",
    time:new Date().toISOString()
  });
});


/* ================= FRONTEND ================= */

app.get("*",(req,res)=>{

  res.sendFile(
    path.join(__dirname,"index.html")
  );
});


app.listen(PORT,()=>{

  console.log(
    `ShakibYS running on port ${PORT}`
  );

});
