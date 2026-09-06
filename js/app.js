import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, onSnapshot, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "jamin-le-bech.firebaseapp.com",
  projectId: "jamin-le-bech",
  storageBucket: "jamin-le-bech.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State Variables
let currentUser = null;
let currentUserData = null;
let confirmationResult = null;
let selectedPostForDetail = null;
let activeChatId = null;
let pendingPostData = null;

// UI Elements
const sections = {
  auth: document.getElementById('auth-section'),
  profileSetup: document.getElementById('profile-setup-section'),
  home: document.getElementById('home-section'),
  postDetail: document.getElementById('post-detail-section'),
  chatView: document.getElementById('chat-view-section'),
  chatList: document.getElementById('chat-list-section'),
  addPost: document.getElementById('add-post-section'),
  myAds: document.getElementById('my-ads-section'),
  account: document.getElementById('account-section')
};

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
function hideAllSections() {
  Object.values(sections).forEach(s => s?.classList.add('hidden'));
}

function showSection(sectionKey) {
  hideAllSections();
  sections[sectionKey]?.classList.remove('hidden');
}

// Convert File to Base64 (Storage vagar image save karva mate)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 3. SPLASH SCREEN (2-SECOND PROGRESS BAR)
// ==========================================
function startSplashScreenAnimation(callback) {
  const progressBar = document.getElementById('splash-progress');
  const splashScreen = document.getElementById('splash-screen');
  
  let progress = 0;
  const interval = setInterval(() => {
    progress += 2;
    if (progressBar) progressBar.style.width = `${progress}%`;

    if (progress >= 100) {
      clearInterval(interval);
      if (splashScreen) {
        splashScreen.classList.add('opacity-0');
        setTimeout(() => {
          splashScreen.classList.add('hidden');
          callback();
        }, 300);
      } else {
        callback();
      }
    }
  }, 40); // 40ms * 50 steps = 2000ms (2 seconds)
}

// ==========================================
// 4. AUTH & RECAPTCHA
// ==========================================
function setupRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': () => {}
    });
  }
}

document.getElementById('send-otp-btn')?.addEventListener('click', async () => {
  let phone = document.getElementById('phone-number').value.trim();
  phone = phone.replace(/[\s\-\(\)]/g, "");

  if (!phone.startsWith("+")) phone = "+91" + phone;

  if (phone.length !== 13) {
    return alert("Please enter a valid 10-digit mobile number");
  }

  try {
    setupRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    document.getElementById('phone-input-group')?.classList.add('hidden');
    document.getElementById('otp-input-group')?.classList.remove('hidden');
    alert("OTP sent successfully!");
  } catch (error) {
    console.error("OTP Error:", error);
    alert("Error sending OTP: " + error.message);
  }
});

document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
  const code = document.getElementById('otp-code').value.trim();
  if (code.length !== 6) return alert("Enter 6-digit OTP");

  try {
    const result = await confirmationResult.confirm(code);
    currentUser = result.user;
    checkUserProfile(currentUser);
  } catch (error) {
    alert("Invalid OTP! Try again.");
  }
});

async function checkUserProfile(user) {
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (userDoc.exists()) {
    currentUserData = userDoc.data();
    showSection('home');
    loadPosts();
  } else {
    showSection('profileSetup');
  }
}

// Profile Save
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('prof-name').value;
  const location = document.getElementById('prof-location').value;
  const age = document.getElementById('prof-age').value;
  const picFile = document.getElementById('prof-pic').files[0];

  let picBase64 = "";
  if (picFile) picBase64 = await fileToBase64(picFile);

  const userData = {
    uid: currentUser.uid,
    phone: currentUser.phoneNumber,
    name,
    location,
    age,
    photoURL: picBase64,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, "users", currentUser.uid), userData);
  currentUserData = userData;
  showSection('home');
  loadPosts();
});

// ==========================================
// 5. POSTS & FILTERS
// ==========================================
async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;
  container.innerHTML = "<p class='text-center py-4 text-gray-500'>Loading ads...</p>";

  const locationFilter = document.getElementById('filter-location').value.toLowerCase().trim();
  const maxPriceFilter = Number(document.getElementById('filter-max-price').value);

  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  container.innerHTML = "";
  if (snapshot.empty) {
    container.innerHTML = "<p class='text-center py-4 text-gray-500'>No land listings available.</p>";
    return;
  }

  snapshot.forEach(docSnap => {
    const post = { id: docSnap.id, ...docSnap.data() };

    // Filter Logic
    if (locationFilter && !post.location.toLowerCase().includes(locationFilter)) return;
    if (maxPriceFilter && Number(post.price) > maxPriceFilter) return;

    const firstImg = post.images && post.images.length > 0 ? post.images[0] : 'https://via.placeholder.com/300x180';

    const card = document.createElement('div');
    card.className = "bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-md transition";
    card.innerHTML = `
      <img src="${firstImg}" class="w-full h-40 object-cover" />
      <div class="p-3">
        <div class="flex justify-between items-center">
          <span class="text-lg font-bold text-emerald-700">₹${Number(post.price).toLocaleString('en-IN')}</span>
          <span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">${post.size}</span>
        </div>
        <h3 class="font-semibold text-gray-800 text-sm mt-1">${post.subject}</h3>
        <p class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-location-dot"></i> ${post.location}</p>
      </div>
    `;

    card.addEventListener('click', () => openPostDetail(post));
    container.appendChild(card);
  });
}

document.getElementById('apply-filter-btn')?.addEventListener('click', loadPosts);

// ==========================================
// 6. POST DETAIL & CHAT INITIATION
// ==========================================
function openPostDetail(post) {
  selectedPostForDetail = post;
  showSection('postDetail');

  const content = document.getElementById('post-detail-content');
  const imagesHTML = (post.images || []).map(img => `<img src="${img}" class="w-full h-48 object-cover rounded shadow-sm mb-2" />`).join('');

  content.innerHTML = `
    <div class="space-y-2">
      <h2 class="text-xl font-bold text-gray-800">${post.subject}</h2>
      <p class="text-2xl font-extrabold text-emerald-600">₹${Number(post.price).toLocaleString('en-IN')}</p>
      <div class="flex gap-4 text-sm text-gray-600">
        <span><i class="fa-solid fa-ruler-combined text-emerald-600"></i> ${post.size}</span>
        <span><i class="fa-solid fa-location-dot text-emerald-600"></i> ${post.location}</span>
      </div>
      <div class="py-2">${imagesHTML}</div>
      <div class="bg-gray-50 p-3 rounded text-sm text-gray-700 space-y-1">
        <p class="font-semibold">Description:</p>
        <p>${post.description}</p>
      </div>
      <p class="text-xs text-gray-400">Seller Phone: ${post.sellerPhone}</p>
    </div>
  `;
}

document.getElementById('back-to-home-btn')?.addEventListener('click', () => showSection('home'));

document.getElementById('start-chat-btn')?.addEventListener('click', async () => {
  if (!selectedPostForDetail) return;
  if (selectedPostForDetail.sellerUid === currentUser.uid) {
    return alert("This is your own advertisement!");
  }

  const chatId = [currentUser.uid, selectedPostForDetail.sellerUid].sort().join('_') + '_' + selectedPostForDetail.id;
  activeChatId = chatId;

  await setDoc(doc(db, "chats", chatId), {
    chatId,
    postId: selectedPostForDetail.id,
    postTitle: selectedPostForDetail.subject,
    participants: [currentUser.uid, selectedPostForDetail.sellerUid],
    lastUpdated: serverTimestamp()
  }, { merge: true });

  openChatView(chatId, selectedPostForDetail.subject);
});

// ==========================================
// 7. REAL-TIME CHAT
// ==========================================
function openChatView(chatId, title) {
  activeChatId = chatId;
  showSection('chatView');
  document.getElementById('chat-header').innerText = title;

  const msgContainer = document.getElementById('chat-messages');

  const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
  onSnapshot(q, (snapshot) => {
    msgContainer.innerHTML = "";
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const isMe = msg.senderUid === currentUser.uid;

      const msgDiv = document.createElement('div');
      msgDiv.className = `max-w-[75%] p-2.5 rounded-lg text-sm ${isMe ? 'bg-emerald-600 text-white self-end rounded-br-none' : 'bg-gray-200 text-gray-800 self-start rounded-bl-none'}`;
      msgDiv.innerText = msg.text;
      msgContainer.appendChild(msgDiv);
    });
    msgContainer.scrollTop = msgContainer.scrollHeight;
  });
}

document.getElementById('send-msg-btn')?.addEventListener('click', async () => {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !activeChatId) return;

  input.value = "";
  await addDoc(collection(db, "chats", activeChatId, "messages"), {
    text,
    senderUid: currentUser.uid,
    timestamp: serverTimestamp()
  });

  await setDoc(doc(db, "chats", activeChatId), {
    lastUpdated: serverTimestamp()
  }, { merge: true });
});

async function loadUserChats() {
  showSection('chatList');
  const container = document.getElementById('user-chats-container');
  container.innerHTML = "<p class='text-center py-4 text-gray-500'>Loading chats...</p>";

  const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
  const snapshot = await getDocs(q);

  container.innerHTML = "";
  if (snapshot.empty) {
    container.innerHTML = "<p class='text-center py-4 text-gray-500'>No conversations found.</p>";
    return;
  }

  snapshot.forEach(docSnap => {
    const chat = docSnap.data();
    const item = document.createElement('div');
    item.className = "p-3 bg-gray-50 rounded border hover:bg-gray-100 cursor-pointer flex justify-between items-center";
    item.innerHTML = `
      <div>
        <h4 class="font-bold text-sm text-gray-800">${chat.postTitle}</h4>
        <p class="text-xs text-gray-500">Tap to open chat</p>
      </div>
      <i class="fa-solid fa-chevron-right text-gray-400 text-xs"></i>
    `;
    item.addEventListener('click', () => openChatView(chat.chatId, chat.postTitle));
    container.appendChild(item);
  });
}

// ==========================================
// 8. ADD POST & PAYMENT FLOW
// ==========================================
document.getElementById('add-post-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const files = Array.from(document.getElementById('post-images').files);
  if (files.length > 5) return alert("Select maximum 5 images");

  const imagesBase64 = await Promise.all(files.map(f => fileToBase64(f)));

  pendingPostData = {
    subject: document.getElementById('post-subject').value,
    price: Number(document.getElementById('post-price').value),
    size: document.getElementById('post-size').value,
    location: document.getElementById('post-location').value,
    description: document.getElementById('post-description').value,
    images: imagesBase64,
    sellerUid: currentUser.uid,
    sellerPhone: currentUser.phoneNumber,
    createdAt: serverTimestamp()
  };

  // Open Disclaimer Modal
  document.getElementById('disclaimer-modal')?.classList.remove('hidden');
});

document.getElementById('decline-disclaimer-btn')?.addEventListener('click', () => {
  document.getElementById('disclaimer-modal')?.classList.add('hidden');
});

document.getElementById('accept-disclaimer-btn')?.addEventListener('click', () => {
  document.getElementById('disclaimer-modal')?.classList.add('hidden');
  document.getElementById('payment-modal')?.classList.remove('hidden');
});

document.getElementById('cancel-pay-btn')?.addEventListener('click', () => {
  document.getElementById('payment-modal')?.classList.add('hidden');
});

document.getElementById('confirm-pay-btn')?.addEventListener('click', async () => {
  const utr = document.getElementById('payment-utr').value.trim();
  if (!utr) return alert("Please enter Transaction UTR / Ref Number!");

  if (pendingPostData) {
    pendingPostData.utr = utr;
    await addDoc(collection(db, "posts"), pendingPostData);
    pendingPostData = null;
    document.getElementById('payment-modal')?.classList.add('hidden');
    document.getElementById('add-post-form').reset();
    alert("Post submitted successfully for review!");
    showSection('home');
    loadPosts();
  }
});

// ==========================================
// 9. MY ADS & ACCOUNT
// ==========================================
async function loadMyAds() {
  showSection('myAds');
  const container = document.getElementById('my-ads-container');
  container.innerHTML = "<p class='text-center py-4 text-gray-500'>Loading your ads...</p>";

  const q = query(collection(db, "posts"), where("sellerUid", "==", currentUser.uid));
  const snapshot = await getDocs(q);

  container.innerHTML = "";
  if (snapshot.empty) {
    container.innerHTML = "<p class='text-center py-4 text-gray-500'>You haven't posted any ads yet.</p>";
    return;
  }

  snapshot.forEach(docSnap => {
    const post = docSnap.data();
    const item = document.createElement('div');
    item.className = "p-3 border rounded shadow-sm flex gap-3 items-center bg-white";
    item.innerHTML = `
      <img src="${post.images[0] || 'https://via.placeholder.com/80'}" class="w-16 h-16 object-cover rounded" />
      <div class="flex-1">
        <h4 class="font-bold text-sm">${post.subject}</h4>
        <p class="text-xs text-emerald-600 font-bold">₹${Number(post.price).toLocaleString('en-IN')}</p>
        <p class="text-xs text-gray-400">UTR: ${post.utr || 'N/A'}</p>
      </div>
    `;
    container.appendChild(item);
  });
}

function loadAccount() {
  showSection('account');
  document.getElementById('acc-img').src = currentUserData?.photoURL || 'https://via.placeholder.com/100';
  document.getElementById('acc-name').innerText = currentUserData?.name || 'User';
  document.getElementById('acc-phone').innerText = currentUser.phoneNumber;
  document.getElementById('acc-location').innerText = "Location: " + (currentUserData?.location || 'N/A');
  document.getElementById('acc-age').innerText = "Age: " + (currentUserData?.age || 'N/A');
}

document.getElementById('logout-btn')?.addEventListener('click', () => {
  signOut(auth).then(() => location.reload());
});

// Navigation Handlers
document.getElementById('nav-home')?.addEventListener('click', () => { showSection('home'); loadPosts(); });
document.getElementById('nav-chat')?.addEventListener('click', loadUserChats);
document.getElementById('nav-add')?.addEventListener('click', () => showSection('addPost'));
document.getElementById('nav-myads')?.addEventListener('click', loadMyAds);
document.getElementById('nav-account')?.addEventListener('click', loadAccount);

// ==========================================
// 10. APP INITIALIZATION (WITH SPLASH BAR)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  startSplashScreenAnimation(() => {
    onAuthStateChanged(auth, async (user) => {
      hideAllSections();
      if (user) {
        currentUser = user;
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            currentUserData = userDoc.data();
            showSection('home');
            loadPosts();
          } else {
            showSection('profileSetup');
          }
        } catch (e) {
          console.error("User doc error:", e);
          showSection('profileSetup');
        }
      } else {
        setupRecaptcha();
        showSection('auth');
      }
    });
  });
});
