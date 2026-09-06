import { auth, db, storage, RecaptchaVerifier, signInWithPhoneNumber, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, getDocs, onSnapshot, orderBy, serverTimestamp, ref, uploadBytes, getDownloadURL } from './firebase-config.js';

let currentUser = null;
let currentUserData = null;
let confirmationResult = null;
let currentPostForChat = null;
let pendingPostData = null;
let currentActiveChatId = null;

// DOM Elements
const splashScreen = document.getElementById('splash-screen');
const authSection = document.getElementById('auth-section');
const profileSetupSection = document.getElementById('profile-setup-section');
const homeSection = document.getElementById('home-section');
const postDetailSection = document.getElementById('post-detail-section');
const chatViewSection = document.getElementById('chat-view-section');
const chatListSection = document.getElementById('chat-list-section');
const addPostSection = document.getElementById('add-post-section');
const myAdsSection = document.getElementById('my-ads-section');
const accountSection = document.getElementById('account-section');

// Navigation Function
function hideAllSections() {
  [authSection, profileSetupSection, homeSection, postDetailSection, chatViewSection, chatListSection, addPostSection, myAdsSection, accountSection].forEach(s => s.classList.add('hidden'));
}

// 1. SPLASH SCREEN & AUTH STATE
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    splashScreen.classList.add('hidden');
  }, 2500);

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        currentUserData = userDoc.data();
        showSection('home');
        loadPosts();
      } else {
        hideAllSections();
        profileSetupSection.classList.remove('hidden');
      }
    } else {
      hideAllSections();
      setupRecaptcha();
      authSection.classList.remove('hidden');
    }
  });
});

// 2. PHONE OTP AUTHENTICATION
function setupRecaptcha() {
  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
}

document.getElementById('send-otp-btn').addEventListener('click', async () => {
  const phone = document.getElementById('phone-number').value;
  try {
    confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    document.getElementById('phone-input-group').classList.add('hidden');
    document.getElementById('otp-input-group').classList.remove('hidden');
  } catch (error) {
    alert("Error sending OTP: " + error.message);
  }
});

document.getElementById('verify-otp-btn').addEventListener('click', async () => {
  const code = document.getElementById('otp-code').value;
  try {
    await confirmationResult.confirm(code);
  } catch (error) {
    alert("Invalid OTP");
  }
});

// 3. MANDATORY PROFILE SETUP
document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('prof-name').value;
  const location = document.getElementById('prof-location').value;
  const age = document.getElementById('prof-age').value;
  const file = document.getElementById('prof-pic').files[0];

  const storageRef = ref(storage, `profiles/${currentUser.uid}`);
  await uploadBytes(storageRef, file);
  const photoURL = await getDownloadURL(storageRef);

  const userData = {
    uid: currentUser.uid,
    phone: currentUser.phoneNumber,
    name,
    location,
    age,
    photoURL,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, "users", currentUser.uid), userData);
  currentUserData = userData;
  showSection('home');
  loadPosts();
});

// 4. POST FEED & EXPIRY TIMER (BUY/SELL)
async function loadPosts(locationFilter = "", maxPriceFilter = null) {
  const container = document.getElementById('posts-container');
  container.innerHTML = "<p class='text-sm text-gray-500'>Loading listings...</p>";

  const q = query(collection(db, "posts"), where("status", "==", "active"));
  const querySnapshot = await getDocs(q);
  container.innerHTML = "";

  const now = new Date();

  querySnapshot.forEach(async (docSnap) => {
    const post = docSnap.data();
    const postId = docSnap.id;

    // Check 2-month Expiry Logic
    const expiresAt = post.expiresAt.toDate();
    if (now > expiresAt) {
      await updateDoc(doc(db, "posts", postId), { status: "expired" });
      return;
    }

    // Filters
    if (locationFilter && !post.location.toLowerCase().includes(locationFilter.toLowerCase())) return;
    if (maxPriceFilter && Number(post.price) > Number(maxPriceFilter)) return;

    // Calculate Days Remaining
    const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-lg shadow space-y-2 cursor-pointer";
    card.innerHTML = `
      <img src="${post.images[0]}" class="w-full h-48 object-cover rounded" />
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-lg text-emerald-800">${post.subject}</h3>
        <span class="text-sm font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">₹${post.price}</span>
      </div>
      <p class="text-xs text-gray-500"><i class="fa-solid fa-location-dot"></i> ${post.location}</p>
      <div class="text-[11px] text-red-500 font-medium">Expires in: ${daysLeft} days</div>
    `;

    card.addEventListener('click', () => showPostDetail(postId, post, daysLeft));
    container.appendChild(card);
  });
}

// 5. POST DETAILS & DISCLAIMER
function showPostDetail(id, post, daysLeft) {
  currentPostForChat = { id, ...post };
  hideAllSections();
  postDetailSection.classList.remove('hidden');

  const detailContent = document.getElementById('post-detail-content');
  detailContent.innerHTML = `
    <div class="flex gap-2 overflow-x-auto pb-2">
      ${post.images.map(img => `<img src="${img}" class="w-64 h-48 object-cover rounded" />`).join('')}
    </div>
    <h2 class="text-xl font-bold text-gray-800">${post.subject}</h2>
    <p class="text-lg font-bold text-emerald-600">₹${post.price}</p>
    <p class="text-sm text-gray-600"><strong>Area:</strong> ${post.areaSize}</p>
    <p class="text-sm text-gray-600"><strong>Location:</strong> ${post.location}</p>
    <p class="text-xs text-red-500"><strong>Listing Active Timer:</strong> ${daysLeft} days remaining</p>
    <div class="border-t pt-2 mt-2">
      <p class="text-sm text-gray-700">${post.description}</p>
    </div>
  `;
}

document.getElementById('start-chat-btn').addEventListener('click', () => {
  document.getElementById('disclaimer-modal').classList.remove('hidden');
});

document.getElementById('decline-disclaimer-btn').addEventListener('click', () => {
  document.getElementById('disclaimer-modal').classList.add('hidden');
});

document.getElementById('accept-disclaimer-btn').addEventListener('click', () => {
  document.getElementById('disclaimer-modal').classList.add('hidden');
  initiateChat(currentPostForChat);
});

// 6. REALTIME CHAT SYSTEM
async function initiateChat(post) {
  const chatId = `${post.id}_${currentUser.uid}`;
  currentActiveChatId = chatId;

  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    await setDoc(chatRef, {
      postId: post.id,
      buyerId: currentUser.uid,
      sellerId: post.userId,
      postTitle: post.subject,
      createdAt: serverTimestamp()
    });
  }

  openChatView(chatId, post.subject);
}

function openChatView(chatId, title) {
  hideAllSections();
  chatViewSection.classList.remove('hidden');
  document.getElementById('chat-header').innerText = title;

  const msgQuery = query(collection(db, `chats/${chatId}/messages`), orderBy("timestamp", "asc"));
  
  onSnapshot(msgQuery, (snapshot) => {
    const msgContainer = document.getElementById('chat-messages');
    msgContainer.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const isMe = msg.senderId === currentUser.uid;
      const bubble = document.createElement('div');
      bubble.className = `p-2 rounded text-sm max-w-[80%] ${isMe ? 'bg-emerald-600 text-white self-end ml-auto' : 'bg-gray-200 text-gray-800 self-start'}`;
      bubble.innerText = msg.text;
      msgContainer.appendChild(bubble);
    });
    msgContainer.scrollTop = msgContainer.scrollHeight;
  });
}

document.getElementById('send-msg-btn').addEventListener('click', async () => {
  const input = document.getElementById('chat-input');
  if (!input.value.trim() || !currentActiveChatId) return;

  await addDoc(collection(db, `chats/${currentActiveChatId}/messages`), {
    senderId: currentUser.uid,
    text: input.value.trim(),
    timestamp: serverTimestamp()
  });

  input.value = "";
});

// 7. CREATE POST & ₹100 UPI PAYMENT FLOW
document.getElementById('add-post-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const files = Array.from(document.getElementById('post-images').files);
  if (files.length > 5) {
    alert("Maximum 5 images allowed");
    return;
  }

  pendingPostData = {
    subject: document.getElementById('post-subject').value,
    price: document.getElementById('post-price').value,
    areaSize: document.getElementById('post-size').value,
    location: document.getElementById('post-location').value,
    description: document.getElementById('post-description').value,
    files: files
  };

  document.getElementById('payment-modal').classList.remove('hidden');
});

document.getElementById('cancel-pay-btn').addEventListener('click', () => {
  document.getElementById('payment-modal').classList.add('hidden');
});

document.getElementById('confirm-pay-btn').addEventListener('click', async () => {
  const utr = document.getElementById('payment-utr').value;
  if (!utr) {
    alert("Please enter Transaction UTR/Ref Number");
    return;
  }

  document.getElementById('confirm-pay-btn').innerText = "Publishing...";

  // Upload Images
  const imageUrls = [];
  for (const file of pendingPostData.files) {
    const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    imageUrls.push(url);
  }

  // 2 Months Expiry Date Calculation
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 2);

  await addDoc(collection(db, "posts"), {
    userId: currentUser.uid,
    subject: pendingPostData.subject,
    price: pendingPostData.price,
    areaSize: pendingPostData.areaSize,
    location: pendingPostData.location,
    description: pendingPostData.description,
    images: imageUrls,
    status: "active",
    paymentUtr: utr,
    createdAt: serverTimestamp(),
    expiresAt: expiryDate
  });

  document.getElementById('payment-modal').classList.add('hidden');
  alert("Post published successfully!");
  showSection('home');
  loadPosts();
});

// 8. NAVIGATION HANDLERS
function showSection(name) {
  hideAllSections();
  if (name === 'home') homeSection.classList.remove('hidden');
  if (name === 'chat') {
    chatListSection.classList.remove('hidden');
    loadUserChats();
  }
  if (name === 'add') addPostSection.classList.remove('hidden');
  if (name === 'myads') {
    myAdsSection.classList.remove('hidden');
    loadMyAds();
  }
  if (name === 'account') {
    accountSection.classList.remove('hidden');
    loadAccountDetails();
  }
}

document.getElementById('nav-home').addEventListener('click', () => showSection('home'));
document.getElementById('nav-chat').addEventListener('click', () => showSection('chat'));
document.getElementById('nav-add').addEventListener('click', () => showSection('add'));
document.getElementById('nav-myads').addEventListener('click', () => showSection('myads'));
document.getElementById('nav-account').addEventListener('click', () => showSection('account'));

document.getElementById('back-to-home-btn').addEventListener('click', () => {
  showSection('home');
});

// Load User Profile in Account Tab
function loadAccountDetails() {
  document.getElementById('acc-img').src = currentUserData.photoURL;
  document.getElementById('acc-name').innerText = currentUserData.name;
  document.getElementById('acc-phone').innerText = currentUserData.phone;
  document.getElementById('acc-location').innerText = "Location: " + currentUserData.location;
  document.getElementById('acc-age').innerText = "Age: " + currentUserData.age;
}

// Load User Conversations
async function loadUserChats() {
  const container = document.getElementById('user-chats-container');
  container.innerHTML = "";
  const q = query(collection(db, "chats"), where("buyerId", "==", currentUser.uid));
  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement('div');
    div.className = "p-3 bg-gray-50 border rounded cursor-pointer font-medium";
    div.innerText = data.postTitle;
    div.addEventListener('click', () => openChatView(docSnap.id, data.postTitle));
    container.appendChild(div);
  });
}

// Load My Ads with Reactivation Option
async function loadMyAds() {
  const container = document.getElementById('my-ads-container');
  container.innerHTML = "";
  const q = query(collection(db, "posts"), where("userId", "==", currentUser.uid));
  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    const post = docSnap.data();
    const div = document.createElement('div');
    div.className = "p-3 border rounded space-y-2";
    div.innerHTML = `
      <div class="flex justify-between">
        <span class="font-bold">${post.subject}</span>
        <span class="text-xs px-2 py-1 rounded ${post.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${post.status.toUpperCase()}</span>
      </div>
      <p class="text-xs text-gray-500">Price: ₹${post.price}</p>
    `;
    container.appendChild(div);
  });
}
