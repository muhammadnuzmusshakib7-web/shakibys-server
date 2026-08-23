const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    });

    res.end(JSON.stringify({
        app: "ShakibYS",
        status: "online",
        message: "ShakibYS server is running!"
    }));
});

const wss = new WebSocket.Server({ server });

const users = new Map();

wss.on("connection", (socket) => {

    console.log("User connected");

    socket.on("message", (data) => {

        try {
            const message = JSON.parse(data.toString());

            // ইউজার লগইন
            if (message.type === "login") {

                const userId = String(message.userId);

                users.set(userId, socket);
                socket.userId = userId;

                socket.send(JSON.stringify({
                    type: "system",
                    message: "ShakibYS server connected successfully!"
                }));

                return;
            }

            // মেসেজ পাঠানো
            if (message.type === "message") {

                const receiverId = String(message.receiverId);
                const receiver = users.get(receiverId);

                if (receiver && receiver.readyState === WebSocket.OPEN) {

                    receiver.send(JSON.stringify({
                        type: "message",
                        senderId: message.senderId,
                        text: message.text,
                        time: new Date().toISOString()
                    }));

                    socket.send(JSON.stringify({
                        type: "sent",
                        receiverId: receiverId,
                        text: message.text,
                        time: new Date().toISOString()
                    }));

                } else {

                    socket.send(JSON.stringify({
                        type: "error",
                        message: "এই ইউজার বর্তমানে অফলাইনে আছে।"
                    }));
                }
            }

        } catch (error) {

            console.error("Message error:", error);

            socket.send(JSON.stringify({
                type: "error",
                message: "মেসেজ প্রসেস করা যায়নি।"
            }));
        }
    });

    socket.on("close", () => {

        if (socket.userId) {
            users.delete(socket.userId);
        }

        console.log("User disconnected");
    });

});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`ShakibYS server running on port ${PORT}`);
});
