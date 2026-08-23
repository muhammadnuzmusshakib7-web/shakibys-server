<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ShakibYS Messenger</title>

<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>

<style>
*{
    box-sizing:border-box;
    margin:0;
    padding:0;
    font-family:Arial,sans-serif;
}

body{
    background:#f1f5f9;
    color:#111827;
}

button,input{
    font:inherit;
}

#login{
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
    padding:20px;
}

.login-box{
    width:100%;
    max-width:380px;
    background:white;
    padding:30px;
    border-radius:22px;
    box-shadow:0 10px 35px #0001;
    text-align:center;
}

.logo{
    color:#ff2a5f;
    font-size:32px;
    font-weight:900;
    margin-bottom:10px;
}

.login-box p{
    color:#64748b;
    margin-bottom:20px;
}

.login-box input{
    width:100%;
    padding:14px;
    border:1px solid #ddd;
    border-radius:12px;
    margin-bottom:12px;
    outline:none;
}

.btn{
    width:100%;
    padding:14px;
    border:0;
    border-radius:12px;
    background:#ff2a5f;
    color:white;
    font-weight:bold;
}

#app{
    display:none;
    height:100vh;
    max-width:900px;
    margin:auto;
    background:white;
}

.header{
    height:65px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 18px;
    border-bottom:1px solid #eee;
}

.header-logo{
    color:#ff2a5f;
    font-size:23px;
    font-weight:900;
}

.status{
    font-size:12px;
    color:#22c55e;
}

.main{
    display:flex;
    height:calc(100vh - 65px);
}

.users{
    width:280px;
    border-right:1px solid #eee;
    overflow-y:auto;
}

.users-title{
    padding:15px;
    font-weight:bold;
    border-bottom:1px solid #eee;
}

.user{
    padding:14px;
    display:flex;
    align-items:center;
    gap:10px;
    cursor:pointer;
    border-bottom:1px solid #f1f1f1;
}

.user:hover{
    background:#fff1f5;
}

.avatar{
    width:42px;
    height:42px;
    border-radius:50%;
    background:#ff2a5f;
    color:white;
    display:flex;
    justify-content:center;
    align-items:center;
    font-weight:bold;
}

.user-info{
    flex:1;
}

.user-name{
    font-weight:bold;
    font-size:14px;
}

.online{
    font-size:11px;
    color:#22c55e;
}

.chat{
    flex:1;
    display:flex;
    flex-direction:column;
    background:#f8fafc;
}

.chat-header{
    padding:15px;
    background:white;
    border-bottom:1px solid #eee;
    font-weight:bold;
}

.messages{
    flex:1;
    overflow-y:auto;
    padding:15px;
    display:flex;
    flex-direction:column;
    gap:8px;
}

.message{
    max-width:75%;
    padding:10px 13px;
    border-radius:15px;
    font-size:14px;
    word-break:break-word;
}

.me{
    align-self:flex-end;
    background:#ff2a5f;
    color:white;
    border-bottom-right-radius:4px;
}

.them{
    align-self:flex-start;
    background:white;
    border:1px solid #e5e7eb;
    border-bottom-left-radius:4px;
}

.message-time{
    display:block;
    font-size:9px;
    opacity:.7;
    margin-top:4px;
}

.typing{
    height:20px;
    padding-left:15px;
    font-size:11px;
    color:#64748b;
}

.send{
    display:flex;
    gap:8px;
    padding:10px;
    background:white;
    border-top:1px solid #eee;
}

.send input{
    flex:1;
    border:1px solid #ddd;
    border-radius:22px;
    padding:11px 15px;
    outline:none;
}

.send button{
    width:45px;
    height:45px;
    border:0;
    border-radius:50%;
    background:#ff2a5f;
    color:white;
}

.empty{
    height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
    color:#94a3b8;
    text-align:center;
    padding:20px;
}

.logout{
    border:0;
    background:#fff0f3;
    color:#ff2a5f;
    padding:8px 12px;
    border-radius:10px;
}

@media(max-width:650px){

    .users{
        width:90px;
    }

    .users-title{
        text-align:center;
        font-size:11px;
    }

    .user{
        flex-direction:column;
        padding:10px 4px;
        text-align:center;
    }

    .user-info{
        width:100%;
    }

    .user-name{
        font-size:10px;
        display:block;
        overflow:hidden;
        text-overflow:ellipsis;
    }

    .online{
        font-size:8px;
    }

    .message{
        max-width:85%;
    }
}
</style>
</head>

<body>

<!-- LOGIN -->

<div id="login">

    <div class="login-box">

        <div class="logo">ShakibYS</div>

        <p>Real-time Messenger</p>

        <input
            id="nameInput"
            type="text"
            placeholder="আপনার নাম লিখুন"
            maxlength="30"
        >

        <button class="btn" onclick="login()">
            Messenger-এ প্রবেশ করুন 🚀
        </button>

    </div>

</div>


<!-- APP -->

<div id="app">

    <div class="header">

        <div class="header-logo">
            ShakibYS
        </div>

        <div>
            <span class="status" id="connectionStatus">
                Connecting...
            </span>

            <button class="logout" onclick="logout()">
                বের হন
            </button>
        </div>

    </div>


    <div class="main">

        <!-- USERS -->

        <div class="users">

            <div class="users-title">
                👥 Online Users
            </div>

            <div id="userList"></div>

        </div>


        <!-- CHAT -->

        <div class="chat">

            <div class="chat-header" id="chatHeader">
                একজন ইউজার নির্বাচন করুন
            </div>

            <div class="messages" id="messages">

                <div class="empty">
                    বাম পাশ থেকে একজন Online ইউজার নির্বাচন করুন 💬
                </div>

            </div>

            <div class="typing" id="typing"></div>

            <div class="send">

                <input
                    id="messageInput"
                    type="text"
                    placeholder="মেসেজ লিখুন..."
                    onkeydown="messageKey(event)"
                >

                <button onclick="sendMessage()">
                    ➤
                </button>

            </div>

        </div>

    </div>

</div>


<script>

const SERVER_URL =
    "https://shakibys-server.onrender.com";

let socket = null;

let myName = "";

let selectedUser = null;

let selectedUserName = "";


// ===============================
// LOGIN
// ===============================

function login(){

    const input =
        document.getElementById("nameInput");

    const name =
        input.value.trim();

    if(!name){

        alert("আপনার নাম লিখুন");

        return;
    }

    myName = name;

    localStorage.setItem(
        "shakibys_name",
        name
    );

    document.getElementById("login").style.display =
        "none";

    document.getElementById("app").style.display =
        "block";

    connectSocket();
}


// ===============================
// SOCKET CONNECTION
// ===============================

function connectSocket(){

    socket = io(SERVER_URL, {
        transports:["websocket","polling"]
    });


    socket.on("connect",()=>{

        document.getElementById(
            "connectionStatus"
        ).innerText = "🟢 Online";

        socket.emit("user:join",{
            name:myName
        });

    });


    socket.on("disconnect",()=>{

        document.getElementById(
            "connectionStatus"
        ).innerText = "🔴 Offline";

    });


    // USERS UPDATE

    socket.on("users:update",(users)=>{

        renderUsers(users);

    });


    // PRIVATE MESSAGE

    socket.on("private:message",(message)=>{

        showMessage(message);

        playSound();

    });


    // TYPING

    socket.on("typing",(data)=>{

        if(
            selectedUser === data.senderId
        ){

            document.getElementById(
                "typing"
            ).innerText =
                data.senderName +
                " typing...";

        }

    });


    socket.on("stop:typing",(data)=>{

        document.getElementById(
            "typing"
        ).innerText = "";

    });


    socket.on("message:seen",(data)=>{

        console.log(
            "Message seen:",
            data.messageId
        );

    });


    socket.on("system:message",(data)=>{

        console.log(data.message);

    });

}


// ===============================
// RENDER USERS
// ===============================

function renderUsers(users){

    const list =
        document.getElementById("userList");

    list.innerHTML = "";

    users.forEach(user=>{

        if(user.socketId === socket.id)
            return;


        const div =
            document.createElement("div");

        div.className = "user";

        const firstLetter =
            user.name
            .charAt(0)
            .toUpperCase();


        div.innerHTML = `

            <div class="avatar">
                ${firstLetter}
            </div>

            <div class="user-info">

                <span class="user-name">
                    ${escapeHTML(user.name)}
                </span>

                <span class="online">
                    🟢 Online
                </span>

            </div>

        `;


        div.onclick = ()=>{

            selectUser(
                user.socketId,
                user.name
            );

        };


        list.appendChild(div);

    });

}


// ===============================
// SELECT USER
// ===============================

function selectUser(id,name){

    selectedUser = id;

    selectedUserName = name;

    document.getElementById(
        "chatHeader"
    ).innerText =
        "💬 " + name;

    document.getElementById(
        "messages"
    ).innerHTML = "";

    document.getElementById(
        "messageInput"
    ).focus();

}


// ===============================
// SEND MESSAGE
// ===============================

function sendMessage(){

    const input =
        document.getElementById(
            "messageInput"
        );

    const text =
        input.value.trim();

    if(!selectedUser){

        alert(
            "প্রথমে একজন ইউজার নির্বাচন করুন"
        );

        return;
    }

    if(!text)
        return;


    socket.emit(
        "private:message",
        {
            receiverId:selectedUser,
            text:text
        }
    );


    input.value = "";

}


// ===============================
// SHOW MESSAGE
// ===============================

function showMessage(message){

    if(
        message.senderId !== socket.id &&
        message.senderId !== selectedUser
    ){

        return;
    }


    const box =
        document.getElementById(
            "messages"
        );


    const div =
        document.createElement("div");


    div.className =
        "message " +
        (
            message.senderId === socket.id
            ? "me"
            : "them"
        );


    const time =
        new Date(
            message.time
        ).toLocaleTimeString(
            "bn-BD",
            {
                hour:"2-digit",
                minute:"2-digit"
            }
        );


    div.innerHTML = `

        ${escapeHTML(message.text)}

        <span class="message-time">
            ${time}
        </span>

    `;


    box.appendChild(div);

    box.scrollTop =
        box.scrollHeight;

}


// ===============================
// ENTER SEND
// ===============================

function messageKey(e){

    if(e.key === "Enter"){

        e.preventDefault();

        sendMessage();

    }

}


// ===============================
// TYPING
// ===============================

document
.getElementById("messageInput")
.addEventListener(
    "input",
    ()=>{

        if(!selectedUser)
            return;

        socket.emit(
            "typing",
            {
                receiverId:selectedUser
            }
        );

        clearTimeout(
            window.typingTimer
        );

        window.typingTimer =
            setTimeout(()=>{

                socket.emit(
                    "stop:typing",
                    {
                        receiverId:selectedUser
                    }
                );

            },700);

    }
);


// ===============================
// MESSAGE SOUND
// ===============================

function playSound(){

    try{

        const audio =
            new Audio(
                "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
            );

        audio.play()
        .catch(()=>{});

    }catch(e){}

}


// ===============================
// SAFE HTML
// ===============================

function escapeHTML(text){

    return String(text)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");

}


// ===============================
// LOGOUT
// ===============================

function logout(){

    if(socket)
        socket.disconnect();

    localStorage.removeItem(
        "shakibys_name"
    );

    location.reload();

}


// ===============================
// AUTO LOGIN
// ===============================

window.addEventListener(
    "load",
    ()=>{

        const saved =
            localStorage.getItem(
                "shakibys_name"
            );

        if(saved){

            myName = saved;

            document.getElementById(
                "login"
            ).style.display =
                "none";

            document.getElementById(
                "app"
            ).style.display =
                "block";

            connectSocket();

        }

    }
);

</script>

</body>
</html>
