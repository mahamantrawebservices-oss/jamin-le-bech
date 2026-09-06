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
  account: document.getElementById('account-section')
};

function hideAllSections() {
  Object.values(sections).forEach(s => s?.classList.add('hidden'));
}

// Check Profile Complete Lock
function isProfileComplete() {
  return userProfileData && userProfileData.fullName && userProfileData.city;
}

function showSection(sectionKey) {
  // If user tries to open post detail or add post without profile
  if ((sectionKey === 'postDetail' || sectionKey === 'addPost') && !isProfileComplete()) {
    alert("તમારી પ્રોફાઇલની વિગતો (નામ અને શહેર) અધૂરી છે! કૃપા કરીને પહેલા પ્રોફાઇલ અપડેટ કરો.");
    document.getElementById('profile-warning-banner').classList.remove('hidden');
    showSection('account');
    return;
  }

  hideAllSections();
  if (sections[sectionKey]) {
    sections[sectionKey].classList.remove('hidden');
  }
}

// Fetch Profile Data
async function fetchUserProfile() {
  if (!currentUser) return;
  const userDocRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    userProfileData = snap.data();
    
    // Auto-fill form fields with old data
    document.getElementById('user-full-name').value = userProfileData.fullName || "";
    document.getElementById('user-city').value = userProfileData.city || "";
    document.getElementById('user-phone-display').value = currentUser.phoneNumber;

    // Sidebar & Profile updates
    document.getElementById('sidebar-user-name').innerText = userProfileData.fullName || "User";
    document.getElementById('sidebar-user-phone').innerText = currentUser.phoneNumber;

    if (userProfileData.photoBase64) {
      // Sidebar photo
      const sbImg = document.getElementById('sidebar-avatar');
      sbImg.src = userProfileData.photoBase64;
      sbImg.classList.remove('hidden');
      document.getElementById('sidebar-avatar-icon').classList.add('hidden');

      // Account page photo
      const accImg = document.getElementById('profile-preview-img');
      accImg.src = userProfileData.photoBase64;
      accImg.classList.remove('hidden');
      document.getElementById('profile-preview-icon').classList.add('hidden');
    }

    if (isProfileComplete()) {
      document.getElementById('profile-warning-banner').classList.add('hidden');
    } else {
      document.getElementById('profile-warning-banner').classList.remove('hidden');
    }
  } else {
    document.getElementById('user-phone-display').value = currentUser.phoneNumber;
    document.getElementById('profile-warning-banner').classList.remove('hidden');
  }
}

// Save Profile
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('user-full-name').value.trim();
  const city = document.getElementById('user-city').value.trim();
  const photoInput = document.getElementById('profile-photo-input');

  if (!name || !city) return alert("કૃપા કરીને બધી વિગતો ભરો!");

  let photoBase64 = userProfileData?.photoBase64 || "";

  if (photoInput.files && photoInput.files[0]) {
    const file = photoInput.files[0];
    photoBase64 = await convertBase64(file);
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
    alert("પ્રોફાઇલ સફળતાપૂર્વક અપડેટ થઈ ગઈ!");
    await fetchUserProfile();
    showSection('home');
    loadPosts();
  } catch (err) {
    alert("પ્રોફાઇલ સેવ કરવામાં ભૂલ થઈ: " + err.message);
  }
});

// Photo Base64 Helper
function convertBase64(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.onerror = (error) => reject(error);
  });
}

// Side Menu Buttons Binding
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

document.getElementById('menu-home')?.addEventListener('click', () => { closeSidebar(); showSection('home'); loadPosts(); });
document.getElementById('menu-profile')?.addEventListener('click', () => { closeSidebar(); showSection('account'); });
document.getElementById('menu-terms')?.addEventListener('click', () => { closeSidebar(); alert("Terms & Conditions placeholder"); });
document.getElementById('menu-privacy')?.addEventListener('click', () => { closeSidebar(); alert("Privacy Policy placeholder"); });
document.getElementById('menu-share')?.addEventListener('click', () => { 
  closeSidebar();
  if (navigator.share) {
    navigator.share({ title: 'Jamin Le Bech App', url: window.location.href });
  } else {
    alert("App link copied!");
  }
});

// Bottom Navigation Clicks
document.getElementById('nav-home')?.addEventListener('click', () => { showSection('home'); loadPosts(); });
document.getElementById('nav-chat')?.addEventListener('click', () => showSection('chat'));
document.getElementById('nav-add')?.addEventListener('click', () => showSection('addPost'));
document.getElementById('nav-terms')?.addEventListener('click', () => alert("Terms & Conditions"));
document.getElementById('nav-account')?.addEventListener('click', () => showSection('account'));

// Phone Auth & Init
function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
  }
}

document.getElementById('send-otp-btn')?.addEventListener('click', async () => {
  let phone = document.getElementById('phone-number').value.trim();
  if (phone.length !== 10) return alert("૧૦ અંકનો યોગ્ય મોબાઈલ નંબર દાખલ કરો!");
  try {
    initRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, "+91" + phone, window.recaptchaVerifier);
    document.getElementById('phone-input-group').classList.add('hidden');
    document.getElementById('otp-input-group').classList.remove('hidden');
  } catch (err) {
    alert("OTP મોકલવામાં ભૂલ: " + err.message);
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

async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;
  container.innerHTML = "<p class='text-center py-6 text-gray-500'>પોસ્ટ અપલોડ થઈ રહી છે...</p>";

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    container.innerHTML = "";
    snapshot.forEach(docSnap => {
      const post = docSnap.data();
      const card = document.createElement('div');
      card.className = "bg-white p-3 rounded-xl shadow cursor-pointer space-y-1";
      card.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="text-lg font-bold text-emerald-700">₹${Number(post.price).toLocaleString('en-IN')}</span>
          <span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">${post.size}</span>
        </div>
        <h3 class="font-semibold text-gray-800 text-sm">${post.subject}</h3>
        <p class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-emerald-600"></i> ${post.location}</p>
      `;

      card.addEventListener('click', () => {
        showSection('postDetail');
        if (isProfileComplete()) {
          document.getElementById('post-detail-content').innerHTML = `
            <h2 class="text-xl font-bold">${post.subject}</h2>
            <p class="text-2xl font-extrabold text-emerald-600">₹${Number(post.price).toLocaleString('en-IN')}</p>
            <p class="text-sm text-gray-600 my-2">${post.location} (${post.size})</p>
            <p class="text-xs text-gray-700 bg-gray-50 p-3 rounded">${post.description}</p>
          `;
        }
      });

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = "<p class='text-center py-6 text-red-400'>ડેટા લોડ કરવામાં મુશ્કેલી.</p>";
  }
}

function onLoginSuccess() {
  document.getElementById('bottom-nav').classList.remove('hidden');
  if (!isProfileComplete()) {
    showSection('account');
  } else {
    showSection('home');
    loadPosts();
  }
}

document.getElementById('logout-btn')?.addEventListener('click', () => {
  signOut(auth).then(() => {
    document.getElementById('bottom-nav').classList.add('hidden');
    showSection('auth');
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
      showSection('auth');
    }
  });
});
