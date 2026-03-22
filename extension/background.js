// ── Cat State Machine Brain ──────────────────────────────────────────
// Single source of truth. All tabs compute position from this state.

const SPRITE_INFO = {
  rest:  { frames: 6,  speed: 0.4  },
  sit:   { frames: 6,  speed: 0.35 },
  eat:   { frames: 8,  speed: 0.25 },
  wash:  { frames: 9,  speed: 0.2  },
  yawn:  { frames: 8,  speed: 0.25 },
  sleep: { frames: 2,  speed: 0.8  },
  itch:  { frames: 11, speed: 0.17 },
};

let state = {
  action: 'idle',
  sprite: 'rest',
  catX: 300,
  animStart: Date.now(),
  // walk params
  startX: 300,
  walkTarget: 300,
  walkSpeed: 2,
  // pet
  petCount: 0,
  petsNeeded: 6,
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
  state.animStart = Date.now();
  // catX stays where it was
  saveState();

  const delay = 2000 + Math.random() * 4000;
  idleTimer = setTimeout(pickActivity, delay);
}

function pickActivity() {
  if (state.action !== 'idle') return;

  const choices = ['walk', 'walk', 'walk', 'eat', 'wash', 'yawn', 'sleep', 'itch', 'sit'];
  const choice = choices[Math.floor(Math.random() * choices.length)];

  if (choice === 'walk') {
    // Determine walk parameters (all tabs use these exact values)
    const margin = 96; // DW
    const viewW = 1400; // assume reasonable width, clamped per tab
    state.startX = state.catX;
    state.walkTarget = margin + Math.random() * (viewW - margin * 2);
    state.walkSpeed = 1.5 + Math.random() * 1.5;
    state.action = 'walking';
    state.sprite = state.walkTarget > state.catX ? 'walk-right' : 'walk-left';
    state.animStart = Date.now();
    saveState();

    // Max walk time fallback
    activityTimer = setTimeout(() => {
      if (state.action === 'walking') {
        state.catX = state.walkTarget;
        enterIdle();
      }
    }, 15000);
  } else {
    state.action = 'activity';
    state.sprite = choice;
    state.animStart = Date.now();
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

  // If was walking, compute final position
  if (state.action === 'walking') {
    state.catX = computeWalkX();
  }

  state.action = 'needy';
  state.sprite = 'meow';
  state.petCount = 0;
  state.animStart = Date.now();
  saveState();

  patienceTimer = setTimeout(startHissing, config.patienceDelay);
}

function startHissing() {
  if (state.action !== 'needy') return;
  state.action = 'hissing';
  state.sprite = 'hiss';
  state.animStart = Date.now();
  saveState();

  patienceTimer = setTimeout(startAttacking, config.patienceDelay);
}

function startAttacking() {
  if (state.action !== 'hissing') return;
  state.action = 'attacking';
  state.sprite = 'paw';
  state.animStart = Date.now();
  saveState();
}

function handlePet(catX) {
  state.totalPets++;

  if (catX != null) state.catX = catX;

  if (state.action === 'needy' || state.action === 'hissing' || state.action === 'attacking') {
    state.petCount++;
    if (state.petCount >= state.petsNeeded) {
      satisfy();
      return { ...state };
    }
  }

  saveState();
  return { ...state };
}

function satisfy() {
  clearTimeout(patienceTimer);

  state.action = 'happy';
  state.sprite = 'sleep';
  state.petCount = 0;
  state.animStart = Date.now();
  saveState();

  happyTimer = setTimeout(() => {
    enterIdle();
    scheduleAttention();
  }, 2500);
}

// ── Walk position helper ─────────────────────────────────────────────

function computeWalkX() {
  const elapsed = (Date.now() - state.animStart) / 1000;
  const speedPerSec = state.walkSpeed * 60;
  const totalDist = state.walkTarget - state.startX;
  const dir = Math.sign(totalDist);
  const traveled = Math.min(speedPerSec * elapsed, Math.abs(totalDist));
  return state.startX + dir * traveled;
}

// ── Messages ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'pet') {
    const result = handlePet(msg.catX);
    sendResponse(result);
    return false;
  }

  if (msg.type === 'walkDone') {
    if (state.action === 'walking') {
      clearTimeout(activityTimer);
      state.catX = msg.catX != null ? msg.catX : computeWalkX();
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

// ── Keep-alive via port connections ──────────────────────────────────

chrome.runtime.onConnect.addListener(() => {});

// ── Startup ──────────────────────────────────────────────────────────

loadState().then(() => {
  if (['walking', 'activity', 'happy'].includes(state.action)) {
    if (state.action === 'walking') state.catX = computeWalkX();
    enterIdle();
  } else if (state.action === 'idle') {
    enterIdle();
  } else if (state.action === 'needy') {
    patienceTimer = setTimeout(startHissing, config.patienceDelay);
  } else if (state.action === 'hissing') {
    patienceTimer = setTimeout(startAttacking, config.patienceDelay);
  }
  scheduleAttention();
  console.log('[BrowserCat BG] Started, state:', state.action, 'x:', state.catX);
});
