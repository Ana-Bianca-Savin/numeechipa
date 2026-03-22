// ── Cat State Machine Brain ──────────────────────────────────────────
// All state lives here. Content scripts are dumb renderers.
// State syncs to all tabs via chrome.storage.local.

const SPRITE_INFO = {
  rest:  { frames: 6,  speed: 0.25 },
  sit:   { frames: 6,  speed: 0.2  },
  eat:   { frames: 8,  speed: 0.15 },
  wash:  { frames: 9,  speed: 0.12 },
  yawn:  { frames: 8,  speed: 0.15 },
  sleep: { frames: 2,  speed: 0.5  },
  itch:  { frames: 11, speed: 0.1  },
};

let state = {
  action: 'idle',
  sprite: 'rest',
  petCount: 0,
  petsNeeded: 3,
  totalPets: 0,
};

let config = {
  attentionMinDelay: 3000,
  attentionMaxDelay: 8000,
  patienceDelay: 4000,
};

let idleTimer = null;
let activityTimer = null;
let attentionTimer = null;
let patienceTimer = null;
let happyTimer = null;

// ── Persistence ──────────────────────────────────────────────────────

function saveState() {
  chrome.storage.local.set({ catState: { ...state } });
}

async function loadState() {
  const data = await chrome.storage.local.get(['catState', 'catConfig']);
  if (data.catState) Object.assign(state, data.catState);
  if (data.catConfig) {
    config.attentionMinDelay = data.catConfig.appearMinDelay || 3000;
    config.attentionMaxDelay = data.catConfig.appearMaxDelay || 8000;
    config.patienceDelay = data.catConfig.demandDelay || 4000;
  }
}

// ── State transitions ────────────────────────────────────────────────

function enterIdle() {
  clearTimeout(idleTimer);
  clearTimeout(activityTimer);

  state.action = 'idle';
  state.sprite = Math.random() < 0.5 ? 'rest' : 'sit';
  saveState();

  const delay = 2000 + Math.random() * 4000;
  idleTimer = setTimeout(pickActivity, delay);
}

function pickActivity() {
  if (state.action !== 'idle') return;

  const choices = ['walk', 'walk', 'walk', 'eat', 'wash', 'yawn', 'sleep', 'itch', 'sit'];
  const choice = choices[Math.floor(Math.random() * choices.length)];

  if (choice === 'walk') {
    state.action = 'walking';
    state.sprite = 'walk-right'; // content overrides direction locally
    saveState();
    activityTimer = setTimeout(enterIdle, 10000); // max walk time
  } else {
    state.action = 'activity';
    state.sprite = choice;
    saveState();

    const s = SPRITE_INFO[choice];
    const loops = choice === 'sleep' ? 4 : 2;
    const duration = s.frames * s.speed * loops * 1000;
    activityTimer = setTimeout(enterIdle, duration);
  }
}

function scheduleAttention() {
  clearTimeout(attentionTimer);
  const delay = config.attentionMinDelay +
    Math.random() * (config.attentionMaxDelay - config.attentionMinDelay);
  attentionTimer = setTimeout(needAttention, delay);
}

function needAttention() {
  if (state.action === 'needy' || state.action === 'hissing' ||
      state.action === 'attacking' || state.action === 'happy') return;

  clearTimeout(idleTimer);
  clearTimeout(activityTimer);

  state.action = 'needy';
  state.sprite = 'meow';
  state.petCount = 0;
  saveState();

  patienceTimer = setTimeout(startHissing, config.patienceDelay);
}

function startHissing() {
  if (state.action !== 'needy') return;
  state.action = 'hissing';
  state.sprite = 'hiss';
  saveState();

  patienceTimer = setTimeout(startAttacking, config.patienceDelay);
}

function startAttacking() {
  if (state.action !== 'hissing') return;
  state.action = 'attacking';
  state.sprite = 'paw';
  saveState();
}

function handlePet() {
  state.totalPets++;

  if (state.action === 'needy' || state.action === 'hissing' || state.action === 'attacking') {
    state.petCount++;
    if (state.petCount >= state.petsNeeded) {
      satisfy();
      return { ...state, petted: true };
    }
  }

  saveState();
  return { ...state, petted: false };
}

function satisfy() {
  clearTimeout(patienceTimer);

  state.action = 'happy';
  state.sprite = 'sleep';
  state.petCount = 0;
  saveState();

  happyTimer = setTimeout(() => {
    enterIdle();
    scheduleAttention();
  }, 2500);
}

// ── Messages ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'pet') {
    const result = handlePet();
    sendResponse(result);
    return false;
  }

  if (msg.type === 'walkDone') {
    if (state.action === 'walking') {
      clearTimeout(activityTimer);
      enterIdle();
    }
    return false;
  }

  if (msg.type === 'summon') {
    needAttention();
    return false;
  }

  if (msg.type === 'getStats') {
    sendResponse({ totalPets: state.totalPets });
    return false;
  }

  if (msg.type === 'getState') {
    sendResponse({ ...state });
    return false;
  }
});

// ── Config live-reload ───────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes) => {
  if (changes.catConfig) {
    const c = changes.catConfig.newValue || {};
    if (c.appearMinDelay != null) config.attentionMinDelay = c.appearMinDelay;
    if (c.appearMaxDelay != null) config.attentionMaxDelay = c.appearMaxDelay;
    if (c.demandDelay != null)    config.patienceDelay = c.demandDelay;
  }
});

// ── Keep-alive via port connections from content scripts ─────────────

chrome.runtime.onConnect.addListener(() => {});

// ── Startup ──────────────────────────────────────────────────────────

loadState().then(() => {
  // On restart, reset transient states to idle
  if (['idle', 'walking', 'activity', 'happy'].includes(state.action)) {
    enterIdle();
  }
  // If cat was demanding attention, keep that state but restart patience
  if (state.action === 'needy') {
    patienceTimer = setTimeout(startHissing, config.patienceDelay);
  } else if (state.action === 'hissing') {
    patienceTimer = setTimeout(startAttacking, config.patienceDelay);
  }
  scheduleAttention();
  console.log('[BrowserCat BG] Started, state:', state.action);
});
