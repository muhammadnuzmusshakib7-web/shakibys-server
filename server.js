const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// JSON API
app.get("/api/status", (req, res) => {
  res.json({
    app: "ShakibYS",
    status: "online",
    message: "ShakibYS real-time server is running!"
  });
});

// index.html দেখাবে
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ShakibYS server running on port ${PORT}`);
});
