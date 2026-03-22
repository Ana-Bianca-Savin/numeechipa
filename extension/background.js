// ── Cat State Machine Brain ──────────────────────────────────────────
// Single source of truth. All tabs compute position from this state.

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
  catX: 300,
  catY: 600,
  animStart: Date.now(),
  // walk params
  startX: 300,
  startY: 600,
  walkTargetX: 300,
  walkTargetY: 600,
  walkSpeed: 2,
  // pet
  petCount: 0,
  petsNeeded: 6,        // runtime copy, synced from config
  totalPets: 0,
};

let config = {
  // ── Attention timing (ms) ──
  attentionMinDelay: 30000,     // min time before cat demands attention (30s)
  attentionMaxDelay: 90000,     // max time before cat demands attention (90s)
  patienceDelay: 6000,          // time before needy→hissing (6s)
  hissingDuration: 12000,       // time in hissing before escalating to attack (12s)

  // ── Petting ──
  petsNeeded: 3,                // clicks needed to satisfy the cat

  // ── Idle behavior (ms) ──
  idleMinDelay: 2000,           // min idle time before next activity (2s)
  idleMaxDelay: 6000,           // max idle time before next activity (6s)

  // ── Walking ──
  walkMinSpeed: 0.8,            // min walk speed multiplier (slower)
  walkMaxSpeed: 1.5,            // max walk speed multiplier
  walkViewportWidth: 1400,      // assumed viewport width for walk targets
  walkViewportHeight: 900,      // assumed viewport height for walk targets
  walkMaxDuration: 20000,       // max walk time before forced stop (ms)

  // ── Activities ──
  sleepLoops: 8,                // animation loop count for sleep (longer naps)
  activityLoops: 3,             // animation loop count for other activities

  // ── Happy state (ms) ──
  happyDuration: 4000,          // how long the cat stays happy after being satisfied

};

let idleTimer = null;
let activityTimer = null;
let attentionTimer = null;
let patienceTimer = null;
let happyTimer = null;
let ready = false;

// ── Persistence ──────────────────────────────────────────────────────

function saveState() {
  chrome.storage.local.set({ catState: { ...state } });
}

async function loadState() {
  const data = await chrome.storage.local.get(['catState', 'catConfig']);
  if (data.catState) Object.assign(state, data.catState);
  if (data.catConfig) {
    const c = data.catConfig;
    if (c.appearMinDelay != null)   config.attentionMinDelay = c.appearMinDelay;
    if (c.appearMaxDelay != null)   config.attentionMaxDelay = c.appearMaxDelay;
    if (c.demandDelay != null)      config.patienceDelay = c.demandDelay;
    if (c.hissingDuration != null)  config.hissingDuration = c.hissingDuration;
    if (c.petsNeeded != null)       config.petsNeeded = c.petsNeeded;
    if (c.idleMinDelay != null)     config.idleMinDelay = c.idleMinDelay;
    if (c.idleMaxDelay != null)     config.idleMaxDelay = c.idleMaxDelay;
    if (c.walkMinSpeed != null)     config.walkMinSpeed = c.walkMinSpeed;
    if (c.walkMaxSpeed != null)     config.walkMaxSpeed = c.walkMaxSpeed;
    if (c.walkMaxDuration != null)  config.walkMaxDuration = c.walkMaxDuration;
    if (c.happyDuration != null)    config.happyDuration = c.happyDuration;
  }
}

// ── State transitions ────────────────────────────────────────────────

function enterIdle() {
  clearTimeout(idleTimer);
  clearTimeout(activityTimer);
  clearTimeout(patienceTimer);
  clearTimeout(happyTimer);
  state.action = 'idle';
  state.sprite = Math.random() < 0.5 ? 'rest' : 'sit';
  // Pick a random static frame for rest/sit
  const frames = SPRITE_INFO[state.sprite] ? SPRITE_INFO[state.sprite].frames : 6;
  state.spriteFrame = Math.floor(Math.random() * frames);
  state.animStart = Date.now();
  // catX stays where it was
  saveState();

  const delay = config.idleMinDelay + Math.random() * (config.idleMaxDelay - config.idleMinDelay);
  idleTimer = setTimeout(pickActivity, delay);
}

function pickActivity() {
  if (state.action !== 'idle') return;

  const choices = ['walk', 'walk', 'walk', 'walk', 'walk', 'sit', 'sleep', 'eat', 'wash', 'yawn', 'itch'];
  const choice = choices[Math.floor(Math.random() * choices.length)];

  if (choice === 'walk') {
    // Determine 2D walk parameters (all tabs use these exact values)
    const margin = 96; // DW
    state.startX = state.catX;
    state.startY = state.catY;
    state.walkTargetX = margin + Math.random() * (config.walkViewportWidth - margin * 2);
    state.walkTargetY = margin + Math.random() * (config.walkViewportHeight - margin * 2);
    state.walkSpeed = config.walkMinSpeed + Math.random() * (config.walkMaxSpeed - config.walkMinSpeed);
    state.action = 'walking';
    state.spriteFrame = null;

    // Pick sprite based on dominant direction
    const dx = state.walkTargetX - state.catX;
    const dy = state.walkTargetY - state.catY;
    if (Math.abs(dx) >= Math.abs(dy)) {
      state.sprite = dx > 0 ? 'walk-right' : 'walk-left';
    } else {
      state.sprite = dy > 0 ? 'walk-down' : 'walk-up';
    }
    state.animStart = Date.now();
    saveState();

    // Max walk time fallback
    activityTimer = setTimeout(() => {
      if (state.action === 'walking') {
        state.catX = state.walkTargetX;
        state.catY = state.walkTargetY;
        enterIdle();
      }
    }, config.walkMaxDuration);
  } else {
    state.action = 'activity';
    state.sprite = choice;
    state.animStart = Date.now();

    if (choice === 'sit') {
      // Sit uses a single static frame, like idle rest/sit
      const frames = SPRITE_INFO.sit ? SPRITE_INFO.sit.frames : 6;
      state.spriteFrame = Math.floor(Math.random() * frames);
    } else {
      state.spriteFrame = null;
    }

    saveState();

    const s = SPRITE_INFO[choice];
    const loops = choice === 'sleep' ? config.sleepLoops : config.activityLoops;
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
    const pos = computeWalkPos();
    state.catX = pos.x;
    state.catY = pos.y;
  }

  state.action = 'needy';
  state.sprite = 'meow';
  state.spriteFrame = null;
  state.petCount = 0;
  state.petsNeeded = config.petsNeeded;
  state.animStart = Date.now();
  saveState();

  patienceTimer = setTimeout(startHissing, config.patienceDelay);
}

function startHissing() {
  if (state.action !== 'needy') return;
  state.action = 'hissing';
  state.sprite = 'hiss';
  state.spriteFrame = null;
  state.animStart = Date.now();
  saveState();

  patienceTimer = setTimeout(startAttacking, config.hissingDuration);
}

function startAttacking() {
  if (state.action !== 'hissing') return;
  state.action = 'attacking';
  state.sprite = 'paw';
  state.spriteFrame = null;
  state.animStart = Date.now();
  saveState();
}

function handlePet(catX, catY) {
  state.totalPets++;

  if (catX != null) state.catX = catX;
  if (catY != null) state.catY = catY;

  if (state.action === 'needy' || state.action === 'hissing' || state.action === 'attacking') {
    state.petCount++;

    // Reset patience timer — don't escalate while being petted
    clearTimeout(patienceTimer);

    if (state.petCount >= state.petsNeeded) {
      satisfy();
      return { ...state };
    }

    // Restart patience timer with fresh delay
    if (state.action === 'needy') {
      patienceTimer = setTimeout(startHissing, config.patienceDelay);
    } else if (state.action === 'hissing') {
      patienceTimer = setTimeout(startAttacking, config.hissingDuration);
    }
  }

  saveState();
  return { ...state };
}

function satisfy() {
  clearTimeout(patienceTimer);

  state.action = 'happy';
  state.sprite = 'sleep';
  state.spriteFrame = null;
  state.petCount = 0;
  state.animStart = Date.now();
  saveState();

  happyTimer = setTimeout(() => {
    enterIdle();
    scheduleAttention();
  }, config.happyDuration);
}

// ── Walk position helper ─────────────────────────────────────────────

function computeWalkPos() {
  const elapsed = (Date.now() - state.animStart) / 1000;
  const speedPerSec = state.walkSpeed * 60;
  const totalDX = state.walkTargetX - state.startX;
  const totalDY = state.walkTargetY - state.startY;
  const totalDist = Math.sqrt(totalDX * totalDX + totalDY * totalDY);
  const traveled = Math.min(speedPerSec * elapsed, totalDist);
  const ratio = totalDist > 0 ? traveled / totalDist : 1;
  return {
    x: state.startX + totalDX * ratio,
    y: state.startY + totalDY * ratio,
  };
}

// ── Messages ─────────────────────────────────────────────────────────

// Queue messages until state is loaded to prevent race condition
const pendingMessages = [];

function processMessage(msg, sender, sendResponse) {
  if (msg.type === 'pet') {
    const result = handlePet(msg.catX, msg.catY);
    sendResponse(result);
    return;
  }

  if (msg.type === 'walkDone') {
    if (state.action === 'walking') {
      clearTimeout(activityTimer);
      if (msg.catX != null) {
        state.catX = msg.catX;
        state.catY = msg.catY != null ? msg.catY : state.catY;
      } else {
        const pos = computeWalkPos();
        state.catX = pos.x;
        state.catY = pos.y;
      }
      enterIdle();
    }
    return;
  }

  if (msg.type === 'updatePos') {
    if (msg.catX != null) state.catX = msg.catX;
    if (msg.catY != null) state.catY = msg.catY;
    saveState();
    return;
  }

  if (msg.type === 'summon') {
    needAttention();
    return;
  }

  if (msg.type === 'getStats') {
    sendResponse({ totalPets: state.totalPets });
    return;
  }

  if (msg.type === 'closeTab') {
    if (sender && sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
    // Calm down — skip happy, go straight to idle
    clearTimeout(patienceTimer);
    enterIdle();
    scheduleAttention();
    return;
  }

  if (msg.type === 'getState') {
    sendResponse({ ...state });
    return;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!ready) {
    pendingMessages.push({ msg, sender, sendResponse });
    return true; // keep sendResponse channel open
  }
  processMessage(msg, sender, sendResponse);
  return false;
});

// ── Config live-reload ───────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes) => {
  if (changes.catConfig) {
    const c = changes.catConfig.newValue || {};
    if (c.appearMinDelay != null)   config.attentionMinDelay = c.appearMinDelay;
    if (c.appearMaxDelay != null)   config.attentionMaxDelay = c.appearMaxDelay;
    if (c.demandDelay != null)      config.patienceDelay = c.demandDelay;
    if (c.hissingDuration != null)  config.hissingDuration = c.hissingDuration;
    if (c.petsNeeded != null)       config.petsNeeded = c.petsNeeded;
    if (c.idleMinDelay != null)     config.idleMinDelay = c.idleMinDelay;
    if (c.idleMaxDelay != null)     config.idleMaxDelay = c.idleMaxDelay;
    if (c.walkMinSpeed != null)     config.walkMinSpeed = c.walkMinSpeed;
    if (c.walkMaxSpeed != null)     config.walkMaxSpeed = c.walkMaxSpeed;
    if (c.walkMaxDuration != null)  config.walkMaxDuration = c.walkMaxDuration;
    if (c.happyDuration != null)    config.happyDuration = c.happyDuration;
  }
});

// ── Keep-alive via port connections ──────────────────────────────────

chrome.runtime.onConnect.addListener(() => {});

// ── Startup ──────────────────────────────────────────────────────────

loadState().then(() => {
  if (['walking', 'activity', 'happy'].includes(state.action)) {
    if (state.action === 'walking') {
      const pos = computeWalkPos();
      state.catX = pos.x;
      state.catY = pos.y;
    }
    enterIdle();
  } else if (state.action === 'idle') {
    enterIdle();
  } else if (state.action === 'needy') {
    patienceTimer = setTimeout(startHissing, config.patienceDelay);
  } else if (state.action === 'hissing') {
    patienceTimer = setTimeout(startAttacking, config.hissingDuration);
  }
  scheduleAttention();

  // Flush any messages that arrived before state was loaded
  ready = true;
  for (const { msg, sender, sendResponse } of pendingMessages) {
    processMessage(msg, sender, sendResponse);
  }
  pendingMessages.length = 0;

  console.log('[BrowserCat BG] Started, state:', state.action, 'x:', state.catX);
});
