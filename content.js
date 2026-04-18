let scrollingActive = false;
let scrollSpeed = 1.0;
let scrollMode = 'zen';
let scrollDirection = 'down';
let lastTimestamp = 0;
let lastPulseTime = 0;
let lastWarpTime = 0;
let rafId = null;
let PULSE_INTERVAL = 15000;
let boostEnabled = false;

const MODE_LEVELS = {
  zen: 2,
  turbo: 30,
  pulse: 1,
  warp: 0 // Special handling
};

// ============================================
// SMART PRELOAD & ADAPTIVE FLOW
// ============================================
let isPreloading = false;

function isTargetLoading(target) {
  if (!target) return false;
  const host = window.location.host;
  
  // Instagram Specific Loader Detection
  if (host.includes('instagram.com')) {
    const igLoader = document.querySelector('svg circle.x2p9j3c') || 
                     document.querySelector('.x78zum5.xl56j7k.x1yzt98f') ||
                     document.querySelector('div[role="progressbar"]');
    if (igLoader) return true;
  }

  // Messenger/Facebook Specific
  if (host.includes('messenger.com') || host.includes('facebook.com')) {
    const fbLoader = document.querySelector('.x1ypdohk.xd16t52') || 
                     document.querySelector('[role="progressbar"]');
    if (fbLoader) return true;
  }
  
  // Generic Fallback
  return target !== window && target.querySelector('.loading, .spinner, .loader') !== null;
}

function predictivePreload(target) {
  if (!boostEnabled || isPreloading || target === window) return;
  
  const host = window.location.host;
  const threshold = 1200; // Trigger way before reaching the boundary

  if (host.includes('instagram.com') || host.includes('messenger.com')) {
    // If scrolling UP (history)
    if (scrollDirection === 'up' && target.scrollTop < threshold) {
      isPreloading = true;
      const currentPos = target.scrollTop;
      
      // Trick the app into thinking we hit the top to trigger fetch
      target.scrollTo({ top: 0, behavior: 'auto' });
      
      setTimeout(() => {
        target.scrollTo({ top: currentPos, behavior: 'auto' });
        // Cooldown to prevent spamming
        setTimeout(() => { isPreloading = false; }, 3000);
      }, 5);
    }
  }
}

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
// Smart Selector: Finds the element that actually scrolls (needed for Chats/Reels)
function getScrollTarget() {
  const host = window.location.host;
  
  // 1. Specific refined selectors for major platforms
  if (host.includes('messenger.com') || host.includes('facebook.com')) {
    const chat = document.querySelector('[role="main"]') || document.querySelector('.x9f619.x78zum5.x1q0g3np');
    if (chat) return chat;
  }
  
  if (host.includes('instagram.com')) {
    // 1. Primary Selectors
    const igChat = document.querySelector('div[role="main"] div[style*="overflow-y: auto"]') ||
                   document.querySelector('div.x168nmei.x13lgxp2.x5yr21d') ||
                   document.querySelector('.x9f619.x78zum5.xdt5ytf.x1iyjqo2.xs83m0k.x1x7p64p.x1n2onr6');
    if (igChat) return igChat;

    // 2. Deep Search Fallback (Inside the main chat area)
    const mainArea = document.querySelector('div[role="main"]');
    if (mainArea) {
      const scrollable = Array.from(mainArea.querySelectorAll('div')).find(el => {
        const style = window.getComputedStyle(el);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
      });
      if (scrollable) return scrollable;
    }
  }

  // 2. Generic "Deep Search": Find the largest scrollable element currently visible
  let bestTarget = window;
  let maxArea = 0;

  const scrollables = document.querySelectorAll('div, section, article, main');
  scrollables.forEach(el => {
    const style = window.getComputedStyle(el);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      const area = el.offsetWidth * el.offsetHeight;
      if (area > maxArea) {
        maxArea = area;
        bestTarget = el;
      }
    }
  });

  return bestTarget;
}

function autoScroll(timestamp) {
  if (!scrollingActive) return;

  if (!lastTimestamp) {
    lastTimestamp = timestamp;
    lastPulseTime = timestamp;
  }
  
  const dirMultiplier = scrollDirection === 'up' ? -1 : 1;
  const target = getScrollTarget();

  if (scrollMode === 'warp') {
    const isUp = scrollDirection === 'up';
    const isWindow = target === window;
    
    if (isWindow) {
      const targetPos = isUp ? 0 : document.documentElement.scrollHeight;
      window.scrollTo(0, targetPos);
    } else {
      const style = window.getComputedStyle(target);
      const isReverse = style.flexDirection === 'column-reverse';

      if (isUp) {
        if (isReverse) {
          // Negative coordinate systems (Chrome/FF)
          target.scrollTop = -target.scrollHeight; 
          // Legacy/Inverted positive systems
          if (target.scrollTop === 0) target.scrollTop = target.scrollHeight; 
        } else {
          target.scrollTop = 0;
        }
      } else {
        // Down (Latest messages)
        target.scrollTop = isReverse ? 0 : target.scrollHeight;
      }
    }
    
    rafId = requestAnimationFrame(autoScroll);
    return;
  }

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
    let velocity = scrollSpeed * (MODE_LEVELS[scrollMode] || 1) * dirMultiplier;
    
    // Adaptive Flow: Slow down if loading to avoid "hitting the wall"
    if (boostEnabled && isTargetLoading(target)) {
      velocity *= 0.15; // Smooth crawl while buffer fills
    } else if (boostEnabled) {
      predictivePreload(target);
    }

    if (target === window) {
      window.scrollBy({ top: velocity, behavior: 'auto' });
    } else {
      target.scrollTop += velocity;
    }
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
