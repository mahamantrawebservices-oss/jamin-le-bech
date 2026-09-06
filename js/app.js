import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp 
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

// App State
let currentUser = null;
let activeUserGeoLocation = null;
let leafletMap = null;
let mapMarker = null;
let mapSelectedCoords = null;
let newPostCoords = null;

const sections = {
  auth: document.getElementById('auth-section'),
  profileSetup: document.getElementById('profile-setup-section'),
  home: document.getElementById('home-section'),
  postDetail: document.getElementById('post-detail-section'),
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

// Haversine 50 KM Formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

// Splash Screen
function startSplashScreenAnimation(callback) {
  const progressBar = document.getElementById('splash-progress');
  const splashScreen = document.getElementById('splash-screen');
  let progress = 0;
  const interval = setInterval(() => {
    progress += 5;
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
  }, 30);
}

// Sidebar Handling (FIXED)
const sidebar = document.getElementById('sidebar-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function openSidebar() {
  sidebar.classList.remove('-translate-x-full');
  sidebarOverlay.classList.remove('hidden');
}

function closeSidebar() {
  sidebar.classList.add('-translate-x-full');
  sidebarOverlay.classList.add('hidden');
}

document.getElementById('open-sidebar-btn')?.addEventListener('click', openSidebar);
document.getElementById('close-sidebar-btn')?.addEventListener('click', closeSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

document.getElementById('menu-home')?.addEventListener('click', () => { closeSidebar(); showSection('home'); loadPosts(); });
document.getElementById('menu-terms')?.addEventListener('click', () => { closeSidebar(); document.getElementById('terms-modal').classList.remove('hidden'); });
document.getElementById('menu-privacy')?.addEventListener('click', () => { closeSidebar(); document.getElementById('privacy-modal').classList.remove('hidden'); });
document.getElementById('menu-share')?.addEventListener('click', () => {
  closeSidebar();
  if (navigator.share) {
    navigator.share({ title: 'Jamin Le Bech', text: 'Buy & Sell Land', url: window.location.href });
  } else {
    alert("App link copied to clipboard!");
  }
});

// App Refresh Button (FIXED)
document.getElementById('app-refresh-btn')?.addEventListener('click', () => {
  document.getElementById('search-location').value = "";
  document.getElementById('filter-max-price').value = "";
  activeUserGeoLocation = null;
  document.getElementById('active-geo-status').classList.add('hidden');
  loadPosts();
});

// Bottom Navigation Fix
document.getElementById('nav-home')?.addEventListener('click', () => { showSection('home'); loadPosts(); });
document.getElementById('nav-add')?.addEventListener('click', () => showSection('addPost'));
document.getElementById('nav-myads')?.addEventListener('click', () => { showSection('myAds'); loadMyPosts(); });
document.getElementById('nav-account')?.addEventListener('click', () => showSection('account'));

// Search & Filter Drawer
document.getElementById('toggle-filter-btn')?.addEventListener('click', () => {
  document.getElementById('filter-drawer').classList.toggle('hidden');
});

document.getElementById('clear-filter-btn')?.addEventListener('click', () => {
  document.getElementById('search-location').value = "";
  document.getElementById('filter-max-price').value = "";
  document.getElementById('filter-size').value = "";
  loadPosts();
});

// Search Input Dynamic Event
document.getElementById('search-location')?.addEventListener('input', loadPosts);
document.getElementById('apply-filter-btn')?.addEventListener('click', loadPosts);

// Geolocation 50 KM Detection (FIXED)
document.getElementById('geo-radius-btn')?.addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      activeUserGeoLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      document.getElementById('active-geo-status').classList.remove('hidden');
      document.getElementById('geo-status-text').innerHTML = `<i class="fa-solid fa-circle-check"></i> 50 KM Radius Active (GPS)`;
      loadPosts();
    }, () => {
      alert("Please allow location access on your phone/browser.");
    });
  }
});

document.getElementById('clear-geo-btn')?.addEventListener('click', () => {
  activeUserGeoLocation = null;
  document.getElementById('active-geo-status').classList.add('hidden');
  loadPosts();
});

// Interactive Map Picker (Leaflet OSM)
document.getElementById('open-map-picker-btn')?.addEventListener('click', () => {
  const mapModal = document.getElementById('map-modal');
  mapModal.classList.remove('hidden');

  setTimeout(() => {
    if (!leafletMap) {
      leafletMap = L.map('leaflet-map').setView([22.3072, 73.1812], 8); // Default Gujarat Center
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(leafletMap);

      leafletMap.on('click', (e) => {
        mapSelectedCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (mapMarker) leafletMap.removeLayer(mapMarker);
        mapMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(leafletMap);
        document.getElementById('selected-map-coords').innerText = `Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`;
      });
    } else {
      leafletMap.invalidateSize();
    }
  }, 200);
});

document.getElementById('close-map-btn')?.addEventListener('click', () => {
  document.getElementById('map-modal').classList.add('hidden');
});

document.getElementById('confirm-map-loc-btn')?.addEventListener('click', () => {
  if (!mapSelectedCoords) return alert("Please click on the map to select location!");
  activeUserGeoLocation = mapSelectedCoords;
  document.getElementById('map-modal').classList.add('hidden');
  document.getElementById('active-geo-status').classList.remove('hidden');
  document.getElementById('geo-status-text').innerHTML = `<i class="fa-solid fa-map-pin"></i> 50 KM Map Filter Active`;
  loadPosts();
});

// Load Posts Function
async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;
  container.innerHTML = "<p class='text-center py-6 text-gray-500 font-medium'>Loading land listings...</p>";

  const queryText = document.getElementById('search-location')?.value.toLowerCase().trim() || "";
  const maxPriceFilter = Number(document.getElementById('filter-max-price')?.value) || 0;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    container.innerHTML = "";
    let count = 0;

    snapshot.forEach(docSnap => {
      const post = { id: docSnap.id, ...docSnap.data() };

      // Fuzzy Search Match
      if (queryText) {
        const loc = (post.location || "").toLowerCase();
        const title = (post.subject || "").toLowerCase();
        if (!loc.includes(queryText) && !title.includes(queryText)) return;
      }

      if (maxPriceFilter && Number(post.price) > maxPriceFilter) return;

      // 50 KM Radius Filter
      if (activeUserGeoLocation && post.coords) {
        const dist = getDistanceFromLatLonInKm(
          activeUserGeoLocation.lat, activeUserGeoLocation.lng,
          post.coords.lat, post.coords.lng
        );
        if (dist > 50) return;
      }

      count++;
      const img = (post.images && post.images.length) ? post.images[0] : 'https://via.placeholder.com/300x180';

      const card = document.createElement('div');
      card.className = "bg-white rounded-xl shadow overflow-hidden cursor-pointer hover:shadow-md transition";
      card.innerHTML = `
        <img src="${img}" class="w-full h-40 object-cover" />
        <div class="p-3">
          <div class="flex justify-between items-center">
            <span class="text-lg font-bold text-emerald-700">₹${Number(post.price).toLocaleString('en-IN')}</span>
            <span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">${post.size}</span>
          </div>
          <h3 class="font-semibold text-gray-800 text-sm mt-1">${post.subject}</h3>
          <p class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-location-dot text-emerald-600"></i> ${post.location}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        showSection('postDetail');
        document.getElementById('post-detail-content').innerHTML = `
          <h2 class="text-xl font-bold">${post.subject}</h2>
          <p class="text-2xl font-extrabold text-emerald-600">₹${Number(post.price).toLocaleString('en-IN')}</p>
          <p class="text-sm text-gray-600 my-2"><i class="fa-solid fa-location-dot"></i> ${post.location} (${post.size})</p>
          <p class="text-xs text-gray-700 bg-gray-50 p-3 rounded">${post.description}</p>
        `;
      });

      container.appendChild(card);
    });

    if (count === 0) {
      container.innerHTML = "<p class='text-center py-6 text-gray-400'>No land listings found.</p>";
    }
  } catch (err) {
    container.innerHTML = "<p class='text-center py-6 text-red-400'>Error loading posts.</p>";
  }
}

document.getElementById('back-to-home-btn')?.addEventListener('click', () => showSection('home'));

// App Init
window.addEventListener('DOMContentLoaded', () => {
  startSplashScreenAnimation(() => {
    onAuthStateChanged(auth, (user) => {
      hideAllSections();
      if (user) {
        currentUser = user;
        showSection('home');
        loadPosts();
      } else {
        showSection('auth');
      }
    });
  });
});
