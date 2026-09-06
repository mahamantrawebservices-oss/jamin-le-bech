import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, getDocs, orderBy, serverTimestamp 
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
let confirmationResult = null;
let activeUserGeoLocation = null;
let leafletMap = null;
let mapMarker = null;
let mapSelectedCoords = null;
let postCoords = null;

const sections = {
  auth: document.getElementById('auth-section'),
  home: document.getElementById('home-section'),
  postDetail: document.getElementById('post-detail-section'),
  addPost: document.getElementById('add-post-section'),
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

// 50 KM Distance Formula (Haversine)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1*(Math.PI/180)) * Math.cos(lat2*(Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Recaptcha setup for Phone Login
function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible'
    });
  }
}

// Phone Send OTP (Fix for Test Numbers)
document.getElementById('send-otp-btn')?.addEventListener('click', async () => {
  let phone = document.getElementById('phone-number').value.trim();
  if (phone.length !== 10) return alert("10 અંકનો નંબર લખો!");

  const fullPhoneNumber = "+91" + phone;

  try {
    initRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, window.recaptchaVerifier);
    document.getElementById('phone-input-group').classList.add('hidden');
    document.getElementById('otp-input-group').classList.remove('hidden');
    alert("OTP મોકલવામાં આવ્યો છે! (ટેસ્ટ નંબર માટે સેટ કરેલ OTP દાખલ કરો)");
  } catch (err) {
    alert("OTP સેન્ડ કરવામાં ભૂલ: " + err.message);
    if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
  }
});

// Verify OTP
document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
  const code = document.getElementById('otp-code').value.trim();
  if (!code) return alert("OTP દાખલ કરો!");

  try {
    const res = await confirmationResult.confirm(code);
    currentUser = res.user;
    onLoginSuccess();
  } catch (err) {
    alert("ખોટો OTP! ફરી પ્રયાસ કરો.");
  }
});

// Sidebar Controls
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

// Bottom Navigation
document.getElementById('nav-home')?.addEventListener('click', () => { showSection('home'); loadPosts(); });
document.getElementById('nav-add')?.addEventListener('click', () => showSection('addPost'));
document.getElementById('nav-account')?.addEventListener('click', () => showSection('account'));

// Search & Filter Events
document.getElementById('search-location')?.addEventListener('input', loadPosts);
document.getElementById('apply-filter-btn')?.addEventListener('click', loadPosts);
document.getElementById('toggle-filter-btn')?.addEventListener('click', () => {
  document.getElementById('filter-drawer').classList.toggle('hidden');
});

document.getElementById('clear-filter-btn')?.addEventListener('click', () => {
  document.getElementById('search-location').value = "";
  document.getElementById('filter-max-price').value = "";
  loadPosts();
});

// Map Location Filter Fix
document.getElementById('open-map-picker-btn')?.addEventListener('click', () => {
  document.getElementById('map-modal').classList.remove('hidden');
  setTimeout(() => {
    if (!leafletMap) {
      leafletMap = L.map('leaflet-map').setView([22.3072, 73.1812], 7); // Gujarat center
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap);

      leafletMap.on('click', (e) => {
        mapSelectedCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (mapMarker) leafletMap.removeLayer(mapMarker);
        mapMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(leafletMap);
        document.getElementById('selected-map-coords').innerText = `Lat: ${e.latlng.lat.toFixed(3)}, Lng: ${e.latlng.lng.toFixed(3)}`;
      });
    } else {
      leafletMap.invalidateSize();
    }
  }, 200);
});

document.getElementById('close-map-btn')?.addEventListener('click', () => document.getElementById('map-modal').classList.add('hidden'));

document.getElementById('confirm-map-loc-btn')?.addEventListener('click', () => {
  if (!mapSelectedCoords) return alert("નકશા પર લોકેશન સિલેક્ટ કરો!");
  activeUserGeoLocation = mapSelectedCoords;
  document.getElementById('map-modal').classList.add('hidden');
  document.getElementById('active-geo-status').classList.remove('hidden');
  loadPosts();
});

document.getElementById('clear-geo-btn')?.addEventListener('click', () => {
  activeUserGeoLocation = null;
  document.getElementById('active-geo-status').classList.add('hidden');
  loadPosts();
});

// Load Posts Function
async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;
  container.innerHTML = "<p class='text-center py-6 text-gray-500'>Listings ડાઉનલોડ થઈ રહી છે...</p>";

  const searchText = document.getElementById('search-location')?.value.toLowerCase().trim() || "";
  const maxPrice = Number(document.getElementById('filter-max-price')?.value) || 0;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    container.innerHTML = "";
    let count = 0;

    snapshot.forEach(docSnap => {
      const post = docSnap.data();

      // Search matching logic
      if (searchText) {
        const loc = (post.location || "").toLowerCase();
        const sub = (post.subject || "").toLowerCase();
        if (!loc.includes(searchText) && !sub.includes(searchText)) return;
      }

      if (maxPrice && Number(post.price) > maxPrice) return;

      // 50 KM Distance check
      if (activeUserGeoLocation && post.coords) {
        const dist = getDistanceFromLatLonInKm(activeUserGeoLocation.lat, activeUserGeoLocation.lng, post.coords.lat, post.coords.lng);
        if (dist > 50) return;
      }

      count++;
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
        document.getElementById('post-detail-content').innerHTML = `
          <h2 class="text-xl font-bold">${post.subject}</h2>
          <p class="text-2xl font-extrabold text-emerald-600">₹${Number(post.price).toLocaleString('en-IN')}</p>
          <p class="text-sm text-gray-600 my-2">${post.location} (${post.size})</p>
          <p class="text-xs text-gray-700 bg-gray-50 p-3 rounded">${post.description}</p>
        `;
      });

      container.appendChild(card);
    });

    if (count === 0) container.innerHTML = "<p class='text-center py-6 text-gray-400'>કોઈ જમીન મળી નથી.</p>";
  } catch (err) {
    container.innerHTML = "<p class='text-center py-6 text-red-400'>Error loading data.</p>";
  }
}

// Success State
function onLoginSuccess() {
  document.getElementById('bottom-nav').classList.remove('hidden');
  document.getElementById('acc-phone').innerText = currentUser.phoneNumber;
  document.getElementById('sidebar-user-phone').innerText = currentUser.phoneNumber;
  showSection('home');
  loadPosts();
}

// Logout Action
document.getElementById('logout-btn')?.addEventListener('click', () => {
  signOut(auth).then(() => {
    document.getElementById('bottom-nav').classList.add('hidden');
    showSection('auth');
  });
});

// App Startup Check (Auth Guard)
window.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    document.getElementById('splash-screen').style.display = 'none';
    if (user) {
      currentUser = user;
      onLoginSuccess();
    } else {
      showSection('auth');
    }
  });
});
