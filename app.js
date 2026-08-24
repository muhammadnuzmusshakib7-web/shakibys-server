const API = "/api";

let currentPage = "home";
let previousPage = "home";
let currentUser = null;
let currentChat = null;
let products = [];


/* ---------------- AUTH ---------------- */

function showAuth(type){

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("registerBox").classList.add("hidden");
  document.getElementById("forgotBox").classList.add("hidden");

  if(type === "login")
    document.getElementById("loginBox").classList.remove("hidden");

  if(type === "register")
    document.getElementById("registerBox").classList.remove("hidden");

  if(type === "forgot")
    document.getElementById("forgotBox").classList.remove("hidden");
}


async function register(){

  const name = document.getElementById("regName").value.trim();
  const username = document.getElementById("regUsername").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirm").value;

  if(!name || !username || !phone || !password){
    return alert("সব তথ্য পূরণ করুন।");
  }

  if(password !== confirm){
    return alert("Password এবং Confirm Password মিলছে না।");
  }

  try{

    const res = await fetch(`${API}/auth/register`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        name,
        username,
        phone,
        password
      })
    });

    const data = await res.json();

    if(!res.ok){
      return alert(data.error || "Registration failed");
    }

    alert("Account তৈরি হয়েছে। এখন Login করুন।");

    document.getElementById("loginPhone").value = phone;

    showAuth("login");

  }catch(error){
    alert("Server-এর সাথে যোগাযোগ করা যাচ্ছে না।");
  }
}


async function login(){

  const phone = document.getElementById("loginPhone").value.trim();
  const password = document.getElementById("loginPassword").value;

  if(!phone || !password){
    return alert("Phone এবং Password দিন।");
  }

  try{

    const res = await fetch(`${API}/auth/login`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        phone,
        password
      })
    });

    const data = await res.json();

    if(!res.ok){
      return alert(data.error || "Login failed");
    }

    currentUser = data.user;

    localStorage.setItem("shakibys_user",JSON.stringify(currentUser));

    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("mainApp").classList.remove("hidden");

    updateUserUI();
    openPage("home");
    loadFeed();

  }catch(error){
    alert("Server unavailable.");
  }
}


async function logout(){

  try{
    await fetch(`${API}/auth/logout`,{
      method:"POST"
    });
  }catch(e){}

  currentUser = null;
  localStorage.removeItem("shakibys_user");

  document.getElementById("mainApp").classList.add("hidden");
  document.getElementById("authScreen").classList.remove("hidden");

  showAuth("login");
}


function forgotPassword(){

  const phone = document.getElementById("forgotPhone").value.trim();

  if(!phone){
    return alert("Phone Number দিন।");
  }

  alert(
    "Password reset system-এর backend endpoint প্রস্তুত আছে। " +
    "Real SMS reset-এর জন্য SMS provider/API সংযুক্ত করতে হবে।"
  );
}


/* ---------------- USER ---------------- */

function updateUserUI(){

  if(!currentUser) return;

  const name = currentUser.name || "Shakib";
  const username = currentUser.username || "shakib";

  document.getElementById("homeName").textContent = name;

  document.getElementById("topAvatar").textContent =
    name.charAt(0).toUpperCase();

  document.getElementById("homeAvatar").textContent =
    name.charAt(0).toUpperCase();

  document.getElementById("profileAvatar").textContent =
    name.charAt(0).toUpperCase();

  document.getElementById("profileName").textContent = name;

  document.getElementById("profileUsername").textContent =
    "@" + username;
}


/* ---------------- NAVIGATION ---------------- */

function openPage(page){

  previousPage = currentPage;
  currentPage = page;

  document.querySelectorAll(".page").forEach(p=>{
    p.classList.add("hidden");
  });

  const target = document.getElementById("page-" + page);

  if(target){
    target.classList.remove("hidden");
  }

  if(page === "marketplace"){
    loadProducts();
  }

  if(page === "friends"){
    loadFriends();
  }

  if(page === "profile"){
    loadProfile();
  }

  if(page === "home"){
    loadFeed();
  }
}


function goBack(){

  openPage(previousPage || "home");
}


/* ---------------- CREATE POST ---------------- */

function openCreate(type){

  openPage("create");

  const title = document.getElementById("createTitle");

  if(type === "post"){
    title.textContent = "📝 Create Post";
  }

  if(type === "photo"){
    title.textContent = "📷 Create Photo Post";
  }

  if(type === "reel"){
    title.textContent = "🎬 Create Reel";
  }

  if(type === "story"){
    title.textContent = "⭕ Create Story";
  }
}


async function publishPost(){

  const content =
    document.getElementById("postContent").value.trim();

  const image =
    document.getElementById("postImage").value.trim();

  if(!content && !image){
    return alert("কিছু লিখুন অথবা Image URL দিন।");
  }

  try{

    const res = await fetch(`${API}/posts`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        content,
        image
      })
    });

    const data = await res.json();

    if(!res.ok){
      return alert(data.error || "Post failed");
    }

    document.getElementById("postContent").value = "";
    document.getElementById("postImage").value = "";

    alert("Post published.");

    openPage("home");
    loadFeed();

  }catch(e){
    alert("Server unavailable.");
  }
}


/* ---------------- FEED ---------------- */

async function loadFeed(){

  try{

    const res = await fetch(`${API}/feed`);

    const data = await res.json();

    const feed = document.getElementById("feed");

    feed.innerHTML = "";

    if(!data.posts || data.posts.length === 0){

      feed.innerHTML = `
        <div class="empty-state">
          <div>📝</div>
          <h2>No Posts Yet</h2>
          <p>প্রথম Post তৈরি করুন।</p>
          <button class="pink-btn"
                  onclick="openCreate('post')">
            Create Post
          </button>
        </div>
      `;

      return;
    }

    data.posts.forEach(post=>{
      feed.appendChild(createPostElement(post));
    });

  }catch(error){

    document.getElementById("feed").innerHTML = `
      <div class="empty-state">
        <div>⚠️</div>
        <h2>Server Error</h2>
        <p>Feed load করা যাচ্ছে না।</p>
      </div>
    `;
  }
}


function createPostElement(post){

  const article = document.createElement("article");

  article.className = "post";

  const initial =
    (post.name || "U").charAt(0).toUpperCase();

  article.innerHTML = `

    <div class="post-head">

      <div class="post-avatar">
        ${initial}
      </div>

      <div>
        <b>${escapeHTML(post.name || "User")}</b>
        <small>
          @${escapeHTML(post.username || "user")}
        </small>
      </div>

    </div>

    <div class="post-body">

      <p>${escapeHTML(post.content || "")}</p>

    </div>

    ${
      post.image
      ?
      `<img class="post-image"
            src="${escapeAttribute(post.image)}"
            alt="Post image">`
      :
      ""
    }

    <div class="post-actions">

      <button onclick="reactPost(${post.id})">
        ❤️ ${post.likes || 0}
      </button>

      <button onclick="commentPost(${post.id})">
        💬 ${post.comments || 0}
      </button>

      <button onclick="sharePost(${post.id})">
        ↗ Share
      </button>

    </div>
  `;

  return article;
}


async function reactPost(id){

  try{

    const res = await fetch(`${API}/posts/${id}/react`,{
      method:"POST"
    });

    const data = await res.json();

    if(!res.ok){
      return alert(data.error || "Reaction failed");
    }

    loadFeed();

  }catch(e){
    alert("Server unavailable.");
  }
}


async function commentPost(id){

  const text = prompt("Comment লিখুন:");

  if(!text) return;

  try{

    const res = await fetch(`${API}/posts/${id}/comment`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        text
      })
    });

    const data = await res.json();

    if(!res.ok){
      return alert(data.error || "Comment failed");
    }

    loadFeed();

  }catch(e){
    alert("Server unavailable.");
  }
}


function sharePost(id){

  const url =
    location.origin + "/?post=" + id;

  if(navigator.share){

    navigator.share({
      title:"ShakibYS",
      text:"Check this post on ShakibYS",
      url
    });

  }else{

    navigator.clipboard.writeText(url);

    alert("Post link copied.");
  }
}


/* ---------------- MARKETPLACE ---------------- */

async function loadProducts(){

  try{

    const res = await fetch(`${API}/marketplace`);

    const data = await res.json();

    products = data.products || [];

    renderProducts(products);

  }catch(e){

    document.getElementById("products").innerHTML =
      `<div class="empty-state">Marketplace unavailable.</div>`;
  }
}


function renderProducts(list){

  const container =
    document.getElementById("products");

  container.innerHTML = "";

  list.forEach(product=>{

    const item = document.createElement("div");

    item.className = "product";

    item.innerHTML = `

      <img src="${escapeAttribute(product.image)}"
           alt="${escapeAttribute(product.title)}">

      <div class="product-info">

        <b>${escapeHTML(product.title)}</b>

        <div class="product-price">
          ৳${Number(product.price).toLocaleString("en-BD")}
        </div>

        <button onclick="viewProduct(${product.id})">
          View Product
        </button>

      </div>
    `;

    container.appendChild(item);

  });
}


function filterProducts(){

  const q =
    document.getElementById("productSearch")
      .value
      .toLowerCase();

  const result =
    products.filter(p=>
      p.title.toLowerCase().includes(q)
    );

  renderProducts(result);
}


function viewProduct(id){

  const product =
    products.find(p=>p.id === id);

  if(!product) return;

  alert(
    `${product.title}\n\n` +
    `Price: ৳${product.price}\n\n` +
    `${product.description || ""}`
  );
}


/* ---------------- FRIENDS ---------------- */

async function loadFriends(){

  try{

    const res = await fetch(`${API}/users`);

    const data = await res.json();

    const box =
      document.getElementById("friendsList");

    box.innerHTML = "";

    data.users.forEach(user=>{

      if(currentUser && user.id === currentUser.id)
        return;

      const item = document.createElement("div");

      item.className = "notification";

      item.innerHTML = `
        <b>${escapeHTML(user.name)}</b>
        <p>@${escapeHTML(user.username)}</p>

        <button class="pink-btn"
                onclick="sendFriendRequest(${user.id})">
          👤 Add Friend
        </button>
      `;

      box.appendChild(item);

    });

  }catch(e){
    alert("Users load করা যাচ্ছে না।");
  }
}


async function sendFriendRequest(id){

  const res =
    await fetch(`${API}/friends/request`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        userId:id
      })
    });

  const data = await res.json();

  alert(data.message || data.error);

}


/* ---------------- CHAT ---------------- */

function openChat(name){

  currentChat = name;

  document.getElementById("chatName")
    .textContent = name;

  document.getElementById("chatAvatar")
    .textContent = name.charAt(0);

  openPage("chat");

  loadMessages();
}


async function loadMessages(){

  const box =
    document.getElementById("messages");

  box.innerHTML = "";

  try{

    const res =
      await fetch(
        `${API}/messages?with=${encodeURIComponent(currentChat)}`
      );

    const data = await res.json();

    data.messages.forEach(message=>{

      const div =
        document.createElement("div");

      div.className =
        "message " +
        (message.sender === currentUser?.username
          ? "me"
          : "");

      div.textContent = message.text;

      box.appendChild(div);

    });

    box.scrollTop = box.scrollHeight;

  }catch(e){

    box.innerHTML =
      `<p>Messages load করা যাচ্ছে না।</p>`;
  }
}


async function sendMessage(){

  const input =
    document.getElementById("messageText");

  const text = input.value.trim();

  if(!text) return;

  try{

    const res =
      await fetch(`${API}/messages`,{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          receiver:currentChat,
          text
        })
      });

    const data = await res.json();

    if(!res.ok){
      return alert(data.error || "Message failed");
    }

    input.value = "";

    loadMessages();

  }catch(e){
    alert("Server unavailable.");
  }
}


/* ---------------- PROFILE ---------------- */

async function loadProfile(){

  if(!currentUser) return;

  try{

    const res =
      await fetch(`${API}/users/${currentUser.id}`);

    const data = await res.json();

    if(!res.ok) return;

    document.getElementById("profileName")
      .textContent = data.user.name;

    document.getElementById("profileUsername")
      .textContent = "@" + data.user.username;

    document.getElementById("profileBio")
      .textContent =
        data.user.bio || "Welcome to ShakibYS 💗";

    document.getElementById("postCount")
      .textContent = data.user.post_count || 0;

  }catch(e){}
}


/* ---------------- SEARCH ---------------- */

async function doSearch(){

  const q =
    document.getElementById("globalSearch")
      .value.trim();

  if(!q) return;

  const res =
    await fetch(
      `${API}/search?q=${encodeURIComponent(q)}`
    );

  const data = await res.json();

  const box =
    document.getElementById("searchResults");

  box.innerHTML = "";

  data.users.forEach(user=>{

    const div =
      document.createElement("div");

    div.className = "notification";

    div.innerHTML =
      `👤 <b>${escapeHTML(user.name)}</b>
       <p>@${escapeHTML(user.username)}</p>`;

    box.appendChild(div);
  });
}


/* ---------------- SETTINGS ---------------- */

function settingInfo(name){

  alert(
    `${name} Settings\n\n` +
    `এই section-এর real backend controls পরবর্তী module-এ যুক্ত হবে।`
  );
}


/* ---------------- UTIL ---------------- */

function escapeHTML(value){

  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


function escapeAttribute(value){

  return escapeHTML(value);
}


/* ---------------- AUTO LOGIN ---------------- */

window.addEventListener("DOMContentLoaded",()=>{

  const saved =
    localStorage.getItem("shakibys_user");

  if(saved){

    try{

      currentUser =
        JSON.parse(saved);

      document.getElementById("authScreen")
        .classList.add("hidden");

      document.getElementById("mainApp")
        .classList.remove("hidden");

      updateUserUI();
      openPage("home");

    }catch(e){

      localStorage.removeItem("shakibys_user");
    }
  }

});
