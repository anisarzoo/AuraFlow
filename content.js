let scrollingActive = false;
let scrollSpeed = 1.0;
let scrollMode = 'zen';
let scrollDirection = 'down';
let lastTimestamp = 0;
let lastPulseTime = 0;
let rafId = null;
let PULSE_INTERVAL = 15000;
let boostEnabled = false;

const MODE_LEVELS = {
  zen: 2,
  turbo: 30,
  pulse: 1
};

// ============================================
// PERFORMANCE BOOST LOGIC
// ============================================
let boostInterval = null;
let videoObserver = null;

function applyBoost() {
  if (!boostEnabled) return;

  // 1. Stop Autoplay Videos (Global & Instagram specific)
  if (!videoObserver) {
    videoObserver = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const videos = node.querySelectorAll('video');
            videos.forEach(v => {
              v.pause();
              v.preload = 'none';
            });
          }
        });
      });
    });
    videoObserver.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('video').forEach(v => v.pause());
  }

  // 2. DOM Cleanup (Keep memory light)
  if (!boostInterval) {
    boostInterval = setInterval(() => {
      const posts = document.querySelectorAll('article, [role="article"], .tweet, .Post');
      if (posts.length > 12) {
        // Remove posts that are far above the viewport
        for (let i = 0; i < posts.length - 12; i++) {
          const rect = posts[i].getBoundingClientRect();
          if (rect.bottom < -1000) {
            posts[i].remove();
          }
        }
      }
    }, 5000);
  }
}

function removeBoost() {
  if (boostInterval) clearInterval(boostInterval);
  if (videoObserver) videoObserver.disconnect();
  boostInterval = null;
  videoObserver = null;
}

// ============================================
// SCROLLING ENGINE
// ============================================
function getScrollTarget() { return window; }

function autoScroll(timestamp) {
  if (!scrollingActive) return;

  if (!lastTimestamp) {
    lastTimestamp = timestamp;
    lastPulseTime = timestamp;
  }
  
  const dirMultiplier = scrollDirection === 'up' ? -1 : 1;
  const target = getScrollTarget();

  if (scrollMode === 'pulse') {
    const nextPulseDelay = PULSE_INTERVAL / scrollSpeed;
    if (timestamp - lastPulseTime > nextPulseDelay) {
      target.scrollBy({
        top: window.innerHeight * dirMultiplier,
        behavior: 'smooth'
      });
      lastPulseTime = timestamp;
    }
  } else {
    const velocity = scrollSpeed * (MODE_LEVELS[scrollMode] || 1) * dirMultiplier;
    if (target === window) { window.scrollBy(0, velocity); }
    else { target.scrollTop += velocity; }
  }

  rafId = requestAnimationFrame(autoScroll);
}

function startScrolling() {
  if (!scrollingActive) {
    scrollingActive = true;
    lastTimestamp = 0;
    if (boostEnabled) applyBoost();
    rafId = requestAnimationFrame(autoScroll);
  }
}

function stopScrolling() {
  scrollingActive = false;
  lastTimestamp = 0;
  removeBoost();
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'TOGGLE':
      scrollDirection = message.direction || 'down';
      if (message.active) startScrolling();
      else stopScrolling();
      break;
    case 'SET_SPEED':
      scrollSpeed = message.speed;
      break;
    case 'SET_MODE':
      scrollMode = message.mode;
      break;
    case 'SET_DIRECTION':
      scrollDirection = message.direction;
      break;
    case 'SET_REEL_INTERVAL':
      PULSE_INTERVAL = message.interval * 1000;
      break;
    case 'SET_BOOST':
      boostEnabled = message.enabled;
      if (boostEnabled && scrollingActive) applyBoost();
      else removeBoost();
      break;
  }
});

// Auto-stop triggers
window.addEventListener('wheel', () => stopScrollingAndRefreshPopup(), { passive: true });
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code)) {
    stopScrollingAndRefreshPopup();
  }
});

function stopScrollingAndRefreshPopup() {
  if (scrollingActive) {
    stopScrolling();
    chrome.storage.local.set({ active: false });
  }
}

chrome.storage.local.get(['active', 'mode', 'speed', 'direction', 'reelInterval', 'boost'], (data) => {
  if (data.reelInterval) PULSE_INTERVAL = data.reelInterval * 1000;
  scrollDirection = data.direction || 'down';
  scrollMode = data.mode || 'zen';
  scrollSpeed = data.speed || 1.0;
  boostEnabled = data.boost || false;
  if (data.active) startScrolling();
  console.log('Aura Flow Engine Initialized');
});
