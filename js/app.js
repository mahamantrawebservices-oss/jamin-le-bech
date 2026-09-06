import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3g9nTWJ7Gsc5K8dpa06_Gs-8qxuKBC4g",
  authDomain: "jamin-le-bech.firebaseapp.com",
  projectId: "jamin-le-bech",
  storageBucket: "jamin-le-bech.firebasestorage.app",
  messagingSenderId: "167990473306",
  appId: "1:167990473306:web:c8ac82925d5f5bbf2a5e63"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userProfileData = null;
let confirmationResult = null;

const sections = {
  auth: document.getElementById('auth-section'),
  home: document.getElementById('home-section'),
  postDetail: document.getElementById('post-detail-section'),
  addPost: document.getElementById('add-post-section'),
  chat: document.getElementById('chat-section'),
  account: document.getElementById('account-section'),
  termsPage: document.getElementById('terms-page-section'),
  privacyPage: document.getElementById('privacy-page-section'),
  aboutPage: document.getElementById('about-page-section')
};

function hideAllSections() {
  Object.values(sections).forEach(s => s?.classList.add('hidden'));
}

window.showSection = function(sectionKey) {
  hideAllSections();
  if (sections[sectionKey]) {
    sections[sectionKey].classList.remove('hidden');
  }
};

// Base64 Convertor Function
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// PROFILE PHOTO PREVIEW
document.getElementById('profile-photo-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const base64 = await fileToBase64(file);
    const img = document.getElementById('profile-preview-img');
    img.src = base64;
    img.classList.remove('hidden');
    document.getElementById('profile-preview-icon').classList.add('hidden');
  }
});

// POST PHOTO PREVIEW
document.getElementById('post-image-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const base64 = await fileToBase64(file);
    const img = document.getElementById('post-image-preview');
    img.src = base64;
    img.classList.remove('hidden');
  }
});

// FETCH USER PROFILE
async function fetchUserProfile() {
  if (!currentUser) return;
  const userDocRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    userProfileData = snap.data();
    
    document.getElementById('user-full-name').value = userProfileData.fullName || "";
    document.getElementById('user-city').value = userProfileData.city || "";
    document.getElementById('user-phone-display').value = currentUser.phoneNumber;

    document.getElementById('sidebar-user-name').innerText = userProfileData.fullName || "User";
    document.getElementById('sidebar-user-phone').innerText = currentUser.phoneNumber;

    if (userProfileData.photoBase64) {
      const sbImg = document.getElementById('sidebar-avatar');
      sbImg.src = userProfileData.photoBase64;
      sbImg.classList.remove('hidden');
      document.getElementById('sidebar-avatar-icon').classList.add('hidden');

      const accImg = document.getElementById('profile-preview-img');
      accImg.src = userProfileData.photoBase64;
      accImg.classList.remove('hidden');
      document.getElementById('profile-preview-icon').classList.add('hidden');
    }
  } else {
    document.getElementById('user-phone-display').value = currentUser.phoneNumber;
  }
}

// SAVE USER PROFILE
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('user-full-name').value.trim();
  const city = document.getElementById('user-city').value.trim();
  const photoInput = document.getElementById('profile-photo-input');

  let photoBase64 = userProfileData?.photoBase64 || "";

  if (photoInput.files && photoInput.files[0]) {
    photoBase64 = await fileToBase64(photoInput.files[0]);
  }

  const profilePayload = {
    fullName: name,
    city: city,
    photoBase64: photoBase64,
    phone: currentUser.phoneNumber,
    updatedAt: new Date()
  };

  try {
    await setDoc(doc(db, "users", currentUser.uid), profilePayload);
    alert("પ્રોફાઇલ સેવ થઈ ગઈ!");
    await fetchUserProfile();
    window.showSection('home');
  } catch (err) {
    alert("ભૂલ: " + err.message);
  }
});

// SUBMIT NEW POST (WITH IMAGE BASE64)
document.getElementById('add-post-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const subject = document.getElementById('post-subject').value.trim();
  const price = document.getElementById('post-price').value.trim();
  const size = document.getElementById('post-size').value.trim();
  const location = document.getElementById('post-location').value.trim();
  const description = document.getElementById('post-description').value.trim();
  const postImgInput = document.getElementById('post-image-input');

  let postImgBase64 = "";
  if (postImgInput.files && postImgInput.files[0]) {
    postImgBase64 = await fileToBase64(postImgInput.files[0]);
  }

  try {
    await addDoc(collection(db, "posts"), {
      subject,
      price: Number(price),
      size,
      location,
      description,
      imageBase64: postImgBase64,
      userId: currentUser.uid,
      userPhone: currentUser.phoneNumber,
      createdAt: new Date()
    });

    alert("પોસ્ટ સફળતાપૂર્વક અપલોડ થઈ ગઈ!");
    document.getElementById('add-post-form').reset();
    document.getElementById('post-image-preview').classList.add('hidden');
    window.showSection('home');
    loadPosts();
  } catch (err) {
    alert("પોસ્ટ સેવ કરવામાં ભૂલ: " + err.message);
  }
});

// LOAD POSTS & SHOW IMAGES
async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;
  container.innerHTML = "<p class='text-center py-6 text-gray-500'>લોડ થઈ રહ્યું છે...</p>";

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    container.innerHTML = "";
    snapshot.forEach(docSnap => {
      const post = docSnap.data();
      const card = document.createElement('div');
      card.className = "bg-white p-3 rounded-xl shadow cursor-pointer space-y-2 border";
      
      let imgTag = post.imageBase64 
        ? `<img src="${post.imageBase64}" class="w-full h-44 object-cover rounded-lg">` 
        : ``;

      card.innerHTML = `
        ${imgTag}
        <div class="flex justify-between items-center">
          <span class="text-lg font-bold text-emerald-700">₹${Number(post.price).toLocaleString('en-IN')}</span>
          <span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">${post.size}</span>
        </div>
        <h3 class="font-semibold text-gray-800 text-sm">${post.subject}</h3>
        <p class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-emerald-600"></i> ${post.location}</p>
      `;

      card.addEventListener('click', () => {
        window.showSection('postDetail');
        document.getElementById('post-detail-content').innerHTML = `
          ${post.imageBase64 ? `<img src="${post.imageBase64}" class="w-full h-52 object-cover rounded-lg mb-3">` : ''}
          <h2 class="text-xl font-bold">${post.subject}</h2>
          <p class="text-2xl font-extrabold text-emerald-600">₹${Number(post.price).toLocaleString('en-IN')}</p>
          <p class="text-sm text-gray-600 my-1"><i class="fa-solid fa-location-dot"></i> ${post.location} (${post.size})</p>
          <p class="text-xs text-gray-700 bg-gray-50 p-3 rounded border my-2">${post.description}</p>
          <p class="text-xs text-gray-500 font-bold">Contact: ${post.userPhone}</p>
        `;
      });

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = "<p class='text-center py-6 text-red-400'>ડેટા મળ્યો નથી.</p>";
  }
}

// SIDEBAR TOGGLE & NAVIGATIONS
document.getElementById('open-sidebar-btn')?.addEventListener('click', () => {
  document.getElementById('sidebar-menu').classList.remove('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
});

const closeSidebar = () => {
  document.getElementById('sidebar-menu').classList.add('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.add('hidden');
};

document.getElementById('close-sidebar-btn')?.addEventListener('click', closeSidebar);
document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

// SIDEBAR PAGES NAVIGATION
document.getElementById('menu-home')?.addEventListener('click', () => { closeSidebar(); window.showSection('home'); loadPosts(); });
document.getElementById('menu-profile')?.addEventListener('click', () => { closeSidebar(); window.showSection('account'); });
document.getElementById('menu-terms')?.addEventListener('click', () => { closeSidebar(); window.showSection('termsPage'); });
document.getElementById('menu-privacy')?.addEventListener('click', () => { closeSidebar(); window.showSection('privacyPage'); });
document.getElementById('menu-about')?.addEventListener('click', () => { closeSidebar(); window.showSection('aboutPage'); });
document.getElementById('menu-share')?.addEventListener('click', () => { 
  closeSidebar();
  if (navigator.share) navigator.share({ title: 'Jamin Le Bech App', url: window.location.href });
});

// BOTTOM NAV BUTTONS
document.getElementById('nav-home')?.addEventListener('click', () => { window.showSection('home'); loadPosts(); });
document.getElementById('nav-chat')?.addEventListener('click', () => window.showSection('chat'));
document.getElementById('nav-add')?.addEventListener('click', () => window.showSection('addPost'));
document.getElementById('nav-terms')?.addEventListener('click', () => window.showSection('termsPage'));
document.getElementById('nav-account')?.addEventListener('click', () => window.showSection('account'));
document.getElementById('back-to-home-btn')?.addEventListener('click', () => window.showSection('home'));

// AUTHENTICATION
function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
  }
}

document.getElementById('send-otp-btn')?.addEventListener('click', async () => {
  let phone = document.getElementById('phone-number').value.trim();
  if (phone.length !== 10) return alert("૧૦ અંકનો મોબાઈલ નંબર લખો!");
  try {
    initRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, "+91" + phone, window.recaptchaVerifier);
    document.getElementById('phone-input-group').classList.add('hidden');
    document.getElementById('otp-input-group').classList.remove('hidden');
  } catch (err) {
    alert("OTP ભૂલ: " + err.message);
  }
});

document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
  const code = document.getElementById('otp-code').value.trim();
  try {
    const res = await confirmationResult.confirm(code);
    currentUser = res.user;
    await fetchUserProfile();
    onLoginSuccess();
  } catch (err) {
    alert("ખોટો OTP!");
  }
});

function onLoginSuccess() {
  document.getElementById('bottom-nav').classList.remove('hidden');
  window.showSection('home');
  loadPosts();
}

document.getElementById('logout-btn')?.addEventListener('click', () => {
  signOut(auth).then(() => {
    document.getElementById('bottom-nav').classList.add('hidden');
    window.showSection('auth');
  });
});

window.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    document.getElementById('splash-screen').style.display = 'none';
    if (user) {
      currentUser = user;
      await fetchUserProfile();
      onLoginSuccess();
    } else {
      window.showSection('auth');
    }
  });
});
