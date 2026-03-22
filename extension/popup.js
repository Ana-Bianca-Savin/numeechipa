document.addEventListener('DOMContentLoaded', () => {
  const totalPetsEl = document.getElementById('totalPets');
  const moodTextEl = document.getElementById('moodText');
  const moodBarEl = document.getElementById('moodBar');
  const catFaceEl = document.getElementById('catFace');
  const summonBtn = document.getElementById('summonBtn');
  const saveBtn = document.getElementById('saveBtn');
  const cfgMin = document.getElementById('cfgMin');
  const cfgMax = document.getElementById('cfgMax');
  const cfgDemand = document.getElementById('cfgDemand');
  const cfgPets = document.getElementById('cfgPets');
  const cfgHappy = document.getElementById('cfgHappy');
  const cfgIdleMin = document.getElementById('cfgIdleMin');
  const cfgIdleMax = document.getElementById('cfgIdleMax');
  const cfgWalkMin = document.getElementById('cfgWalkMin');
  const cfgWalkMax = document.getElementById('cfgWalkMax');

  // ── Presets (values in seconds, except petsNeeded and walkSpeed) ──
  const PRESETS = {
    test:   { min: 5,   max: 15,  demand: 4,  pets: 2, happy: 3, idleMin: 2,  idleMax: 5,  walkMin: 1,   walkMax: 2 },
    normal: { min: 30,  max: 90,  demand: 6,  pets: 3, happy: 4, idleMin: 5,  idleMax: 15, walkMin: 0.8, walkMax: 1.5 },
    chill:  { min: 120, max: 300, demand: 10, pets: 3, happy: 5, idleMin: 10, idleMax: 30, walkMin: 0.5, walkMax: 1 },
  };

  // ── Load existing config into inputs ──
  chrome.storage.local.get(['catConfig'], (data) => {
    const c = data.catConfig || {};
    cfgMin.value     = Math.round((c.appearMinDelay || 30000) / 1000);
    cfgMax.value     = Math.round((c.appearMaxDelay || 90000) / 1000);
    cfgDemand.value  = Math.round((c.demandDelay || 6000) / 1000);
    cfgPets.value    = c.petsNeeded || 3;
    cfgHappy.value   = Math.round((c.happyDuration || 4000) / 1000);
    cfgIdleMin.value = Math.round((c.idleMinDelay || 5000) / 1000);
    cfgIdleMax.value = Math.round((c.idleMaxDelay || 15000) / 1000);
    cfgWalkMin.value = c.walkMinSpeed || 0.8;
    cfgWalkMax.value = c.walkMaxSpeed || 1.5;
  });

  // ── Save config ──
  function saveConfig() {
    const config = {
      appearMinDelay: Math.max(1, parseInt(cfgMin.value) || 3) * 1000,
      appearMaxDelay: Math.max(1, parseInt(cfgMax.value) || 8) * 1000,
      demandDelay:    Math.max(1, parseInt(cfgDemand.value) || 4) * 1000,
      petsNeeded:     Math.max(1, parseInt(cfgPets.value) || 3),
      happyDuration:  Math.max(1, parseInt(cfgHappy.value) || 3) * 1000,
      idleMinDelay:   Math.max(1, parseInt(cfgIdleMin.value) || 2) * 1000,
      idleMaxDelay:   Math.max(1, parseInt(cfgIdleMax.value) || 6) * 1000,
      walkMinSpeed:   Math.max(0.5, parseFloat(cfgWalkMin.value) || 1.5),
      walkMaxSpeed:   Math.max(0.5, parseFloat(cfgWalkMax.value) || 3.0),
    };
    // Ensure min <= max
    if (config.appearMinDelay > config.appearMaxDelay) {
      config.appearMaxDelay = config.appearMinDelay;
      cfgMax.value = cfgMin.value;
    }
    if (config.idleMinDelay > config.idleMaxDelay) {
      config.idleMaxDelay = config.idleMinDelay;
      cfgIdleMax.value = cfgIdleMin.value;
    }
    if (config.walkMinSpeed > config.walkMaxSpeed) {
      config.walkMaxSpeed = config.walkMinSpeed;
      cfgWalkMax.value = cfgWalkMin.value;
    }
    chrome.storage.local.set({ catConfig: config });
    return config;
  }

  saveBtn.addEventListener('click', () => {
    saveConfig();
    saveBtn.textContent = 'Saved!';
    saveBtn.style.background = 'linear-gradient(135deg, #6BCB77, #4CAF50)';
    setTimeout(() => {
      saveBtn.textContent = 'Save Settings';
      saveBtn.style.background = '';
    }, 1200);
  });

  // ── Presets ──
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = PRESETS[btn.dataset.preset];
      if (!p) return;
      cfgMin.value = p.min;
      cfgMax.value = p.max;
      cfgDemand.value = p.demand;
      cfgPets.value = p.pets;
      cfgHappy.value = p.happy;
      cfgIdleMin.value = p.idleMin;
      cfgIdleMax.value = p.idleMax;
      cfgWalkMin.value = p.walkMin;
      cfgWalkMax.value = p.walkMax;
      saveConfig();

      // Flash feedback
      btn.style.background = '#6BCB77';
      btn.style.color = 'white';
      setTimeout(() => { btn.style.background = ''; btn.style.color = ''; }, 600);
    });
  });

  // ── Load stats ──
  chrome.runtime.sendMessage({ type: 'getStats' }, (response) => {
    if (chrome.runtime.lastError) return;
    const pets = response?.totalPets || 0;
    totalPetsEl.textContent = pets;

    let mood, moodPct, face;
    if (pets === 0) {
      mood = 'Lonely';    moodPct = 20;  face = '😿';
    } else if (pets < 5) {
      mood = 'Content';   moodPct = 45;  face = '🐱';
    } else if (pets < 15) {
      mood = 'Happy';     moodPct = 70;  face = '😺';
    } else if (pets < 30) {
      mood = 'Joyful';    moodPct = 85;  face = '😸';
    } else {
      mood = 'Ecstatic!'; moodPct = 100; face = '😻';
    }

    moodTextEl.textContent = mood;
    moodBarEl.style.width = moodPct + '%';
    catFaceEl.textContent = face;
  });

  // ── Extra cats ──
  const catCountEl = document.getElementById('catCount');
  const catPlus = document.getElementById('catPlus');
  const catMinus = document.getElementById('catMinus');

  chrome.storage.local.get(['extraCatCount'], (data) => {
    catCountEl.textContent = data.extraCatCount || 0;
  });

  catPlus.addEventListener('click', () => {
    const current = parseInt(catCountEl.textContent) || 0;
    const next = Math.min(current + 1, 100);
    catCountEl.textContent = next;
    chrome.storage.local.set({ extraCatCount: next });
  });

  catMinus.addEventListener('click', () => {
    const current = parseInt(catCountEl.textContent) || 0;
    const next = Math.max(current - 1, 0);
    catCountEl.textContent = next;
    chrome.storage.local.set({ extraCatCount: next });
  });

  // ── Summon button ──
  summonBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'summon' });
    summonBtn.textContent = '✨ Cat noticed you!';
    summonBtn.style.background = 'linear-gradient(135deg, #6BCB77, #4CAF50)';
    setTimeout(() => {
      summonBtn.textContent = '🐾 Get Cat\'s Attention';
      summonBtn.style.background = '';
    }, 1500);
  });
});
