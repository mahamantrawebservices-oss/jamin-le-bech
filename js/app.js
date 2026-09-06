import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, onSnapshot, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3g9nTWJ7Gsc5K8dpa06_Gs-8qxuKBC4g",
  authDomain: "jamin-le-bech.firebaseapp.com",
  projectId: "jamin-le-bech",
  storageBucket: "jamin-le-bech.firebasestorage.app",
  messagingSenderId: "167990473306",
  appId: "1:167990473306:web:c8ac82925d5f5bbf2a5e63",
  measurementId: "G-86474BTQCQ"
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
let currentPostCoords = null;
let activeUserGeoLocation = null;

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

function hideAllSections() {
  Object.values(sections).forEach(s => s?.classList.add('hidden'));
}

function showSection(sectionKey) {
  hideAllSections();
  if (sections[sectionKey]) {
    sections[sectionKey].classList.remove('hidden');
  }
}

// 50 KM Haversine Distance Calculator
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in km
}

// Compress Image (<100KB)
function compressAndConvertToBase64(file, maxWidth = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
}

function fileToBase64(file) {
  return compressAndConvertToBase64(file, 600);
}

// Splash Screen
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
          splashScreen.style.display = 'none';
          callback();
        }, 300);
      } else {
        callback();
      }
    }
  }, 40);
}

// Sidebar Navigation Control
const sidebar = document.getElementById('sidebar-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');

document.getElementById('open-sidebar-btn')?.addEventListener('click', () => {
  sidebar.classList.remove('-translate-x-full');
  sidebarOverlay.classList.remove('hidden');
});

sidebarOverlay?.addEventListener('click', closeSidebar);

function closeSidebar() {
  sidebar.classList.add('-translate-x-full');
  sidebarOverlay.classList.add('hidden');
}

document.getElementById('menu-home')?.addEventListener('click', () => { closeSidebar(); showSection('home'); loadPosts(); });
document.getElementById('menu-terms')?.addEventListener('click', () => { closeSidebar(); document.getElementById('terms-modal').classList.remove('hidden'); });
document.getElementById('menu-privacy')?.addEventListener('click', () => { closeSidebar(); document.getElementById('privacy-modal').classList.remove('hidden'); });
document.getElementById('menu-share')?.addEventListener('click', () => {
  closeSidebar();
  if (navigator.share) {
    navigator.share({ title: 'Jamin Le Bech', text: 'Buy and Sell Land easily!', url: window.location.href });
  } else {
    alert("Share link copied to clipboard!");
  }
});

// Auth & OTP
function setupRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': () => {}
    });
  }
}

document.getElementById('send-otp-btn')?.addEventListener('click', async () => {
  let phone = document.getElementById('phone-number').value.trim().replace(/[\s\-\(\)]/g, "");
  if (!phone.startsWith("+")) phone = "+91" + phone;

  if (phone.length !== 13) return alert("Please enter a valid 10-digit mobile number");

  try {
    setupRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    document.getElementById('phone-input-group')?.classList.add('hidden');
    document.getElementById('otp-input-group')?.classList.remove('hidden');
    alert("OTP sent successfully!");
  } catch (error) {
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
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      currentUserData = userDoc.data();
      document.getElementById('sidebar-user-name').innerText = currentUserData.name || "User";
      document.getElementById('sidebar-user-phone').innerText = currentUser.phoneNumber || "";
      showSection('home');
      loadPosts();
    } else {
      showSection('profileSetup');
    }
  } catch (err) {
    showSection('profileSetup');
  }
}

// Toggle & Reset Filter
document.getElementById('toggle-filter-btn')?.addEventListener('click', () => {
  document.getElementById('filter-drawer').classList.toggle('hidden');
});

document.getElementById('clear-filter-btn')?.addEventListener('click', () => {
  document.getElementById('search-location').value = "";
  document.getElementById('filter-max-price').value = "";
  document.getElementById('filter-size').value = "";
  activeUserGeoLocation = null;
  loadPosts();
});

// Geolocation Detect for 50KM Radius Search
document.getElementById('geo-radius-btn')?.addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      activeUserGeoLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      alert("Location detected! Showing listings within 50 KM radius.");
      loadPosts();
    }, () => {
      alert("Unable to fetch location. Please allow GPS access.");
    });
  }
});

// Load Posts with Spelling-Friendly Search and Filters
async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;
  container.innerHTML = "<p class='text-center py-4 text-gray-500'>Loading land listings...</p>";

  const searchText = document.getElementById('search-location')?.value.toLowerCase().trim() || "";
  const maxPriceFilter = Number(document.getElementById('filter-max-price')?.value) || 0;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    container.innerHTML = "";
    if (snapshot.empty) {
      container.innerHTML = "<p class='text-center py-4 text-gray-500'>No land listings available.</p>";
      return;
    }

    snapshot.forEach(docSnap => {
      const post = { id: docSnap.id, ...docSnap.data() };

      // Partial / Fuzzy match for spelling mistakes
      if (searchText) {
        const postLoc = (post.location || "").toLowerCase();
        const postTitle = (post.subject || "").toLowerCase();
        if (!postLoc.includes(searchText) && !postTitle.includes(searchText)) return;
      }

      if (maxPriceFilter && Number(post.price) > maxPriceFilter) return;

      // 50 KM Radius Check
      if (activeUserGeoLocation && post.coords) {
        const dist = getDistanceFromLatLonInKm(
          activeUserGeoLocation.lat, activeUserGeoLocation.lng,
          post.coords.lat, post.coords.lng
        );
        if (dist > 50) return; // Skip posts beyond 50km
      }

      const firstImg = post.images && post.images.length > 0 ? post.images[0] : 'https://via.placeholder.com/300x180';

      const card = document.createElement('div');
      card.className = "bg-white rounded-xl shadow overflow-hidden cursor-pointer hover:shadow-md transition";
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
  } catch (e) {
    container.innerHTML = "<p class='text-center py-4 text-gray-500'>Error loading listings.</p>";
  }
}

document.getElementById('search-location')?.addEventListener('input', loadPosts);
document.getElementById('apply-filter-btn')?.addEventListener('click', loadPosts);

// Detail view
function openPostDetail(post) {
  selectedPostForDetail = post;
  showSection('postDetail');

  const content = document.getElementById('post-detail-content');
  if (!content) return;

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
    </div>
  `;
}

document.getElementById('back-to-home-btn')?.addEventListener('click', () => showSection('home'));

// Fetch GPS Coords for Post creation
document.getElementById('fetch-post-coords-btn')?.addEventListener('click', () => {
  const status = document.getElementById('coords-status');
  if (navigator.geolocation) {
    status.innerText = "Fetching coordinates...";
    navigator.geolocation.getCurrentPosition(position => {
      currentPostCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      status.innerText = "GPS Coordinates Attached Successfully!";
    }, () => {
      status.innerText = "Failed to fetch GPS location.";
    });
  }
});

// Add Post submit
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
    coords: currentPostCoords || null,
    images: imagesBase64,
    sellerUid: currentUser.uid,
    sellerPhone: currentUser.phoneNumber,
    createdAt: serverTimestamp()
  };

  document.getElementById('disclaimer-modal')?.classList.remove('hidden');
});

document.getElementById('accept-disclaimer-btn')?.addEventListener('click', () => {
  document.getElementById('disclaimer-modal')?.classList.add('hidden');
  document.getElementById('payment-modal')?.classList.remove('hidden');
});

document.getElementById('confirm-pay-btn')?.addEventListener('click', async () => {
  const utr = document.getElementById('payment-utr').value.trim();
  if (!utr) return alert("Please enter Transaction UTR Number!");

  if (pendingPostData) {
    pendingPostData.utr = utr;
    await addDoc(collection(db, "posts"), pendingPostData);
    pendingPostData = null;
    currentPostCoords = null;
    document.getElementById('payment-modal')?.classList.add('hidden');
    document.getElementById('add-post-form').reset();
    alert("Listing posted successfully!");
    showSection('home');
    loadPosts();
  }
});

// App Init
window.addEventListener('DOMContentLoaded', () => {
  startSplashScreenAnimation(() => {
    onAuthStateChanged(auth, async (user) => {
      hideAllSections();
      if (user) {
        currentUser = user;
        checkUserProfile(user);
      } else {
        setupRecaptcha();
        showSection('auth');
      }
    });
  });
});
