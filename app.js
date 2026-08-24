const socket = io();

let currentUser =
  JSON.parse(localStorage.getItem("shakibys_user") || "null");

let selectedUser = null;


/* =========================
   HELPERS
========================= */

const $ = id => document.getElementById(id);

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function saveUser(){
  localStorage.setItem(
    "shakibys_user",
    JSON.stringify(currentUser)
  );
}

function toast(text){
  $("toast").textContent = text;
  $("toast").style.display = "block";

  setTimeout(() => {
    $("toast").style.display = "none";
  },2200);
}

function avatar(user,size=45){
  if(user?.avatar){
    return `
      <img
        class="avatar"
        style="width:${size}px;height:${size}px"
        src="${escapeHTML(user.avatar)}"
      >
    `;
  }

  return `
    <div
      class="avatar"
      style="width:${size}px;height:${size}px"
    >
      ${escapeHTML((user?.name || "?")[0])}
    </div>
  `;
}


/* =========================
   AUTH
========================= */

function toggleRegister(){

  $("registerArea")
    .classList.toggle("hidden");

  $("registerButton")
    .classList.toggle("hidden");

  $("authTitle").textContent =
    $("registerButton").classList.contains("hidden")
      ? "Login"
      : "Create Account";
}

async function register(){

  const name =
    $("registerName").value.trim();

  const phone =
    $("phone").value.trim();

  const password =
    $("password").value;

  if(!name || !phone){

    toast("নাম ও নাম্বার দিন");

    return;
  }

  const response =
    await fetch("/api/auth/register",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        name,
        phone,
        password
      })
    });

  const data =
    await response.json();

  if(!data.success){

    toast(data.message);

    return;
  }

  currentUser = data.user;

  saveUser();

  startApp();
}

async function login(){

  const phone =
    $("phone").value.trim();

  const password =
    $("password").value;

  if(!phone){

    toast("মোবাইল নাম্বার দিন");

    return;
  }

  const response =
    await fetch("/api/auth/login",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        phone,
        password
      })
    });

  const data =
    await response.json();

  if(!data.success){

    toast(data.message);

    return;
  }

  currentUser = data.user;

  saveUser();

  startApp();
}


/* =========================
   START
========================= */

function startApp(){

  $("authPage")
    .classList.add("hidden");

  $("app")
    .classList.remove("hidden");

  socket.emit(
    "user:online",
    currentUser
  );

  home();
}

if(currentUser){

  startApp();
}


/* =========================
   HOME
========================= */

async function home(){

  const response =
    await fetch("/api/posts");

  const data =
    await response.json();

  let html = `

    <div class="createCard">

      <div
        class="createInput"
        onclick="openCreate()"
      >
        What's on your mind,
        ${escapeHTML(currentUser.name)}?
      </div>

      <div class="createButtons">

        <button onclick="openCreate('photo')">
          📷 Photo
        </button>

        <button onclick="openCreate('video')">
          🎥 Video
        </button>

        <button onclick="openCreate('text')">
          ✍ Post
        </button>

      </div>

    </div>

  `;

  html +=
    (data.posts || [])
      .map(renderPost)
      .join("");

  $("page").innerHTML = html;
}


/* =========================
   POST
========================= */

function renderPost(post){

  return `

    <article class="post">

      <div class="postHeader">

        <div
          onclick="showProfile('${escapeHTML(post.authorId)}')"
        >
          ${avatar({
            name:post.author,
            avatar:post.authorAvatar
          })}
        </div>

        <div
          class="author"
          onclick="showProfile('${escapeHTML(post.authorId)}')"
        >

          <b>
            ${escapeHTML(post.author)}
          </b>

          <span class="time">
            ${new Date(post.createdAt)
              .toLocaleString()}
          </span>

        </div>

      </div>


      ${
        post.title
          ? `
            <div class="postText">
              <b>${escapeHTML(post.title)}</b>
            </div>
          `
          : ""
      }


      ${
        post.content
          ? `
            <div class="postText">
              ${escapeHTML(post.content)}
            </div>
          `
          : ""
      }


      ${
        post.media
          ? post.type === "video"

            ? `
              <video
                class="postMedia"
                controls
                src="${escapeHTML(post.media)}"
              ></video>
            `

            : `
              <img
                class="postMedia"
                src="${escapeHTML(post.media)}"
              >
            `

          : ""
      }


      <div class="postStats">

        ❤️ ${post.likes?.length || 0}

        &nbsp;&nbsp;

        💬 ${post.comments?.length || 0}

        &nbsp;&nbsp;

        ↗ ${post.shares || 0}

      </div>


      <div class="postActions">

        <button
          onclick="reactPost('${post.id}')"
        >
          ❤️ Like
        </button>

        <button
          onclick="commentPost('${post.id}')"
        >
          💬 Comment
        </button>

        <button
          onclick="sharePost('${post.id}')"
        >
          ↗ Share
        </button>

        <button
          onclick="savePost('${post.id}')"
        >
          🔖 Save
        </button>

      </div>

    </article>

  `;
}


/* =========================
   CREATE
========================= */

function openCreate(){

  $("modal")
    .classList.remove("hidden");

  $("modalContent").innerHTML = `

    <h2>Create Post</h2>

    <textarea
      id="postText"
      rows="5"
      placeholder="What's on your mind?"
    ></textarea>

    <input
      id="postTitle"
      placeholder="Title / Thumbnail Title"
    >

    <input
      id="postHashtag"
      placeholder="#Hashtag"
    >

    <input
      id="postLocation"
      placeholder="Location"
    >

    <select id="postPrivacy">

      <option value="public">
        🌎 Public
      </option>

      <option value="friends">
        👥 Friends
      </option>

      <option value="only">
        🔒 Only Me
      </option>

    </select>

    <input
      id="mediaFile"
      type="file"
      accept="image/*,video/*"
    >

    <button
      class="pinkButton"
      onclick="publishPost()"
    >
      Publish
    </button>

    <button
      class="outlineButton"
      onclick="closeModal()"
    >
      Cancel
    </button>

  `;
}

async function publishPost(){

  const text =
    $("postText").value.trim();

  const title =
    $("postTitle").value.trim();

  const hashtag =
    $("postHashtag").value.trim();

  const location =
    $("postLocation").value.trim();

  const privacy =
    $("postPrivacy").value;

  const file =
    $("mediaFile").files[0];

  let media = "";

  let type = "text";

  if(file){

    media =
      await fileToDataURL(file);

    type =
      file.type.startsWith("video/")
        ? "video"
        : "photo";
  }

  if(!text && !media){

    toast("Post লিখুন বা ছবি/video দিন");

    return;
  }

  const response =
    await fetch("/api/posts",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({

        authorId:currentUser.id,

        content:text,

        title,

        hashtag,

        location,

        privacy,

        media,

        type

      })
    });

  const data =
    await response.json();

  if(!data.success){

    toast(data.message);

    return;
  }

  closeModal();

  home();

  toast("Post published");
}

function fileToDataURL(file){

  return new Promise((resolve,reject)=>{

    const reader =
      new FileReader();

    reader.onload =
      () => resolve(reader.result);

    reader.onerror =
      reject;

    reader.readAsDataURL(file);
  });
}


/* =========================
   POST ACTIONS
========================= */

async function reactPost(id){

  await fetch(
    `/api/posts/${id}/react`,
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        userId:currentUser.id
      })
    }
  );

  home();
}

function commentPost(id){

  $("modal")
    .classList.remove("hidden");

  $("modalContent").innerHTML = `

    <h2>Comments</h2>

    <input
      id="commentText"
      placeholder="Write a comment..."
    >

    <button
      class="pinkButton"
      onclick="sendComment('${id}')"
    >
      Comment
    </button>

  `;
}

async function sendComment(id){

  const text =
    $("commentText").value.trim();

  if(!text)return;

  await fetch(
    `/api/posts/${id}/comment`,
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        userId:currentUser.id,
        text
      })
    }
  );

  closeModal();

  home();
}

async function sharePost(id){

  await fetch(
    `/api/posts/${id}/share`,
    {
      method:"POST"
    }
  );

  toast("Post shared");

  home();
}

async function savePost(id){

  const response =
    await fetch(
      `/api/posts/${id}/save`,
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          userId:currentUser.id
        })
      }
    );

  const data =
    await response.json();

  toast(
    data.saved
      ? "Saved"
      : "Removed from saved"
  );
}


/* =========================
   SEARCH
========================= */

function showSearch(){

  $("page").innerHTML = `

    <div class="box" style="padding:15px">

      <input
        id="searchInput"
        style="width:100%;padding:14px"
        placeholder="Search people..."
        oninput="searchUsers()"
      >

      <div id="searchResults"></div>

    </div>

  `;

  $("searchInput").focus();
}

async function searchUsers(){

  const q =
    $("searchInput").value.trim();

  if(!q){

    $("searchResults").innerHTML = "";

    return;
  }

  const response =
    await fetch(
      "/api/users?q=" +
      encodeURIComponent(q)
    );

  const data =
    await response.json();

  $("searchResults").innerHTML =
    data.users.map(user => `

      <div class="user">

        ${avatar(user)}

        <div
          class="userInfo"
          onclick="showProfile('${user.id}')"
        >

          <b>
            ${escapeHTML(user.name)}
          </b>

          <small>
            @${escapeHTML(user.username)}
          </small>

          <br>

          <small>
            ${user.online
              ? "🟢 Online"
              : "⚪ Offline"}
          </small>

        </div>

        <button
          onclick="openChat('${user.id}')"
        >
          💬
        </button>

      </div>

    `).join("");
}


/* =========================
   PROFILE
========================= */

async function showProfile(id){

  const response =
    await fetch(
      `/api/users/${id}`
    );

  const data =
    await response.json();

  if(!data.success){

    toast("Profile পাওয়া যায়নি");

    return;
  }

  const user = data.user;

  const own =
    String(user.id) ===
    String(currentUser.id);

  $("page").innerHTML = `

    <div class="profileCard">

      <div class="cover">

        ${
          user.cover
            ? `<img src="${escapeHTML(user.cover)}">`
            : ""
        }

      </div>

      <div class="profileInfo">

        ${
          user.avatar
            ? `
              <img
                class="profilePhoto"
                src="${escapeHTML(user.avatar)}"
              >
            `
            : `
              <div class="profilePhoto avatar">
                ${escapeHTML(user.name[0])}
              </div>
            `
        }


        <h2>
          ${escapeHTML(user.name)}
        </h2>

        <p>
          ${escapeHTML(user.bio || "No bio yet")}
        </p>


        <div class="profileStats">

          <div>
            <b>${user.friends}</b>
            Friends
          </div>

          <div>
            <b>${user.followers}</b>
            Followers
          </div>

          <div>
            <b>${user.following}</b>
            Following
          </div>

        </div>


        <div class="profileButtons">

          ${
            own

              ? `
                <button
                  onclick="editProfile()"
                >
                  ✏ Edit Profile
                </button>
              `

              : `

                <button
                  onclick="follow('${user.id}')"
                >
                  ＋ Follow
                </button>

                <button
                  onclick="friend('${user.id}')"
                >
                  👥 Friend
                </button>

                <button
                  onclick="openChat('${user.id}')"
                >
                  💬 Message
                </button>

              `
          }

        </div>

      </div>

    </div>

  `;
}


/* =========================
   FRIEND
========================= */

async function friend(id){

  const response =
    await fetch(
      "/api/friends/request",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          fromId:currentUser.id,
          toId:id
        })
      }
    );

  const data =
    await response.json();

  toast(data.message);
}

async function follow(id){

  const response =
    await fetch(
      "/api/follow",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          followerId:currentUser.id,
          followingId:id
        })
      }
    );

  const data =
    await response.json();

  toast(
    data.following
      ? "Followed"
      : "Already followed"
  );
}


/* =========================
   CHAT
========================= */

async function openChat(id){

  const response =
    await fetch(
      `/api/users/${id}`
    );

  const data =
    await response.json();

  if(!data.success)return;

  selectedUser = data.user;

  $("chatName").textContent =
    selectedUser.name;

  $("chat")
    .classList.remove("hidden");

  loadMessages();
}

async function loadMessages(){

  const response =
    await fetch(
      `/api/messages/${currentUser.id}/${selectedUser.id}`
    );

  const data =
    await response.json();

  $("messages").innerHTML = "";

  data.messages.forEach(
    renderMessage
  );

  scrollMessages();
}

function renderMessage(message){

  const me =
    String(message.senderId) ===
    String(currentUser.id);

  $("messages").insertAdjacentHTML(
    "beforeend",
    `

      <div class="message ${me ? "me" : ""}">

        <div class="bubble">

          ${escapeHTML(message.text)}

        </div>

      </div>

    `
  );
}

function sendMessage(){

  const input =
    $("messageInput");

  const text =
    input.value.trim();

  if(!text || !selectedUser)return;

  socket.emit(
    "message:send",
    {
      senderId:currentUser.id,
      receiverId:selectedUser.id,
      text,
      type:"text"
    }
  );

  input.value = "";
}

function messageKey(event){

  if(event.key === "Enter"){

    event.preventDefault();

    sendMessage();
  }
}

function closeChat(){

  $("chat")
    .classList.add("hidden");
}

function scrollMessages(){

  $("messages").scrollTop =
    $("messages").scrollHeight;
}


/* =========================
   REAL TIME CHAT
========================= */

socket.on(
  "message:new",
  message => {

    if(
      selectedUser &&
      (
        String(message.senderId) ===
        String(selectedUser.id) ||

        String(message.receiverId) ===
        String(selectedUser.id)
      )
    ){

      renderMessage(message);

      scrollMessages();
    }
  }
);

socket.on(
  "post:new",
  () => {

    if(!$("app").classList.contains("hidden")){
      home();
    }

  }
);


/* =========================
   NOTIFICATIONS
========================= */

async function showNotifications(){

  const response =
    await fetch(
      `/api/notifications/${currentUser.id}`
    );

  const data =
    await response.json();

  $("modal")
    .classList.remove("hidden");

  $("modalContent").innerHTML = `

    <h2>🔔 Notifications</h2>

    ${
      data.notifications.length

        ? data.notifications.map(n => `

          <div class="user">

            🔔

            <div>

              <b>
                ${escapeHTML(n.fromUserName)}
              </b>

              <br>

              ${escapeHTML(n.type)}

            </div>

          </div>

        `).join("")

        : `
          <p>
            No notifications
          </p>
        `
    }

  `;
}


/* =========================
   EDIT PROFILE
========================= */

function editProfile(){

  $("modal")
    .classList.remove("hidden");

  $("modalContent").innerHTML = `

    <h2>Edit Profile</h2>

    <input
      id="editName"
      value="${escapeHTML(currentUser.name)}"
      placeholder="Name"
    >

    <input
      id="editBio"
      value="${escapeHTML(currentUser.bio || "")}"
      placeholder="Bio"
    >

    <button
      class="pinkButton"
      onclick="saveProfile()"
    >
      Save
    </button>

  `;
}

async function saveProfile(){

  const name =
    $("editName").value.trim();

  const bio =
    $("editBio").value.trim();

  const response =
    await fetch(
      `/api/users/${currentUser.id}`,
      {
        method:"PUT",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          name,
          bio
        })
      }
    );

  const data =
    await response.json();

  if(data.success){

    currentUser =
      data.user;

    saveUser();

    closeModal();

    showProfile(
      currentUser.id
    );

    toast("Profile updated");
  }
}


/* =========================
   MODAL
========================= */

function closeModal(){

  $("modal")
    .classList.add("hidden");
}


/* =========================
   CALL PLACEHOLDER
========================= */

function callUser(type){

  toast(
    type === "video"
      ? "Video call system next module"
      : "Audio call system next module"
  );
}


/* =========================
   LOGOUT
========================= */

async function logout(){

  await fetch(
    "/api/auth/logout",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        userId:currentUser.id
      })
    }
  );

  localStorage.removeItem(
    "shakibys_user"
  );

  location.reload();
    }
