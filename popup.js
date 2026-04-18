let active = false;
let currentMode = 'zen';
let speed = 1.0;
let direction = 'down';
let reelInterval = 15;
let boostEnabled = false;

const toggleBtn = document.getElementById('toggleBtn');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const modeCards = document.querySelectorAll('.mode-card');
const dirToggle = document.getElementById('dirToggle');
const boostToggle = document.getElementById('boostToggle');

const mainView = document.getElementById('mainView');
const settingsView = document.getElementById('settingsView');
const goToSettings = document.getElementById('goToSettings');
const backToMain = document.getElementById('backToMain');

const reelInput = document.getElementById('reelInterval');
const incInterval = document.getElementById('incInterval');
const decInterval = document.getElementById('decInterval');
const saveStatus = document.getElementById('saveStatus');

// Load initial state
chrome.storage.local.get(['active', 'mode', 'speed', 'direction', 'reelInterval', 'boost'], (data) => {
  active = data.active === true;
  currentMode = data.mode || 'zen';
  speed = data.speed || 1.0;
  direction = data.direction || 'down';
  reelInterval = data.reelInterval || 15;
  boostEnabled = data.boost || false;

  updateUI();
});

function updateUI() {
  toggleBtn.textContent = active ? 'Stop' : 'Start';
  toggleBtn.className = `main-toggle ${active ? 'active' : ''}`;
  
  speedSlider.value = speed;
  speedValue.textContent = speed.toFixed(1) + 'x';
  boostToggle.checked = boostEnabled;

  modeCards.forEach(card => {
    card.classList.toggle('active', card.dataset.mode === currentMode);
  });

  dirToggle.querySelectorAll('span').forEach(span => {
    span.classList.toggle('active', span.dataset.dir === direction);
  });

  reelInput.value = reelInterval;
}

// Navigation
goToSettings.addEventListener('click', () => {
  mainView.classList.add('hidden');
  settingsView.classList.remove('hidden');
});

backToMain.addEventListener('click', () => {
  settingsView.classList.add('hidden');
  mainView.classList.remove('hidden');
});

// Settings Logic
function saveReelInterval() {
  chrome.storage.local.set({ reelInterval }, () => {
    saveStatus.style.opacity = '1';
    setTimeout(() => saveStatus.style.opacity = '0', 2000);
    // Notify content script if running
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_REEL_INTERVAL', interval: reelInterval }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    });
  });
}

incInterval.addEventListener('click', () => {
  reelInterval++;
  reelInput.value = reelInterval;
  saveReelInterval();
});

decInterval.addEventListener('click', () => {
  if (reelInterval > 1) {
    reelInterval--;
    reelInput.value = reelInterval;
    saveReelInterval();
  }
});

// Existing Listeners
toggleBtn.addEventListener('click', () => {
  active = !active;
  chrome.storage.local.set({ active });
  updateUI();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE', active, direction }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  });
});

dirToggle.addEventListener('click', (e) => {
  if (e.target.dataset.dir) {
    direction = e.target.dataset.dir;
    chrome.storage.local.set({ direction });
    updateUI();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_DIRECTION', direction }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    });
  }
});

speedSlider.addEventListener('input', (e) => {
  speed = parseFloat(e.target.value);
  speedValue.textContent = speed.toFixed(1) + 'x';
  chrome.storage.local.set({ speed });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_SPEED', speed }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  });
});

modeCards.forEach(card => {
  card.addEventListener('click', () => {
    currentMode = card.dataset.mode;
    chrome.storage.local.set({ mode: currentMode });
    updateUI();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_MODE', mode: currentMode }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    });
  });
});

boostToggle.addEventListener('change', () => { boostEnabled = boostToggle.checked; chrome.storage.local.set({ boost: boostEnabled }); chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { if (tabs[0]?.id) { chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_BOOST', enabled: boostEnabled }); } }); });
