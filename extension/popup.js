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

  // ── Presets (values in seconds) ──
  const PRESETS = {
    test:   { min: 3,   max: 8,   demand: 4  },
    normal: { min: 60,  max: 180, demand: 10 },
    chill:  { min: 300, max: 600, demand: 15 },
  };

  // ── Load existing config into inputs ──
  chrome.storage.local.get(['catConfig'], (data) => {
    const c = data.catConfig || { appearMinDelay: 3000, appearMaxDelay: 8000, demandDelay: 4000 };
    cfgMin.value = Math.round(c.appearMinDelay / 1000);
    cfgMax.value = Math.round(c.appearMaxDelay / 1000);
    cfgDemand.value = Math.round(c.demandDelay / 1000);
  });

  // ── Save config ──
  function saveConfig() {
    const config = {
      appearMinDelay: Math.max(1, parseInt(cfgMin.value) || 3) * 1000,
      appearMaxDelay: Math.max(1, parseInt(cfgMax.value) || 8) * 1000,
      demandDelay:    Math.max(1, parseInt(cfgDemand.value) || 4) * 1000,
    };
    // Ensure min <= max
    if (config.appearMinDelay > config.appearMaxDelay) {
      config.appearMaxDelay = config.appearMinDelay;
      cfgMax.value = cfgMin.value;
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
