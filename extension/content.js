(function () {
  'use strict';

  if (window !== window.top) return;

  // ── Sprite config ──────────────────────────────────────────────────
  const FW = 32;
  const FH = 32;
  const SCALE = 3;
  const DW = FW * SCALE;   // 96px
  const DH = FH * SCALE;   // 96px

  const SPRITES = {
    rest:         { frames: 6,  speed: 0.25 },
    sit:          { frames: 6,  speed: 0.2  },
    'walk-right': { frames: 8,  speed: 0.08 },
    'walk-left':  { frames: 8,  speed: 0.08 },
    'walk-down':  { frames: 4,  speed: 0.12 },
    'walk-up':    { frames: 4,  speed: 0.12 },
    sleep:        { frames: 2,  speed: 0.5  },
    eat:          { frames: 8,  speed: 0.15 },
    meow:         { frames: 3,  speed: 0.2  },
    yawn:         { frames: 8,  speed: 0.15 },
    wash:         { frames: 9,  speed: 0.12 },
    itch:         { frames: 11, speed: 0.1  },
    hiss:         { frames: 2,  speed: 0.2  },
    paw:          { frames: 9,  speed: 0.08 },
  };

  for (const [name, s] of Object.entries(SPRITES)) {
    s.url = chrome.runtime.getURL(`sprites/${name}.png`);
  }

  // ── CSS ────────────────────────────────────────────────────────────
  let spriteCSS = '';
  for (const [name, s] of Object.entries(SPRITES)) {
    spriteCSS += `
      @keyframes anim-${name} {
        from { background-position: 0 0; }
        to   { background-position: -${s.frames * DW}px 0; }
      }
      .sprite-${name} {
        background-image: url('${s.url}');
        background-size: ${s.frames * DW}px ${DH}px;
        animation: anim-${name} ${s.frames * s.speed}s steps(${s.frames}) infinite;
      }
    `;
  }

  const STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    #overlay {
      display: none;
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      z-index: 2147483646;
      pointer-events: auto;
      cursor: none;
    }
    #overlay.active { display: block; }

    #cat {
      position: fixed;
      z-index: 2147483647;
      pointer-events: auto;
      cursor: pointer;
      width: ${DW}px;
      height: ${DH}px;
      user-select: none;
      -webkit-user-select: none;
    }

    .sprite {
      width: ${DW}px;
      height: ${DH}px;
      background-repeat: no-repeat;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }

    ${spriteCSS}

    /* ── Speech bubble ── */
    #bubble {
      position: absolute;
      top: -28px;
      left: 50%;
      transform: translateX(-50%) scale(0);
      background: white;
      color: #333;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #bubble.show { transform: translateX(-50%) scale(1); }
    #bubble::after {
      content: '';
      position: absolute;
      bottom: -6px; left: 50%;
      transform: translateX(-50%);
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid white;
    }

    /* ── Hearts ── */
    .heart {
      position: fixed;
      font-size: 18px;
      pointer-events: none;
      animation: float-up 1s ease-out forwards;
      z-index: 2147483647;
    }
    @keyframes float-up {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-60px) scale(1.5); }
    }

    /* ── Purr vibration ── */
    #cat.purring .sprite {
      animation-name: purr-shake !important;
      animation-duration: 0.12s !important;
      animation-timing-function: linear !important;
      animation-iteration-count: infinite !important;
    }
    @keyframes purr-shake {
      0%, 100% { transform: translateX(0); }
      25%      { transform: translateX(-2px); }
      75%      { transform: translateX(2px); }
    }
  `;

  // ── Messages ───────────────────────────────────────────────────────
  const MSG_IDLE    = ['*sits*', '*looks around*', 'Mrrp?', '~', '*stretch*'];
  const MSG_NEEDY   = ['Pet me!', 'Meow!', 'Hey!', 'Miau!', 'Notice me!', 'Mrrp?', 'Psst!'];
  const MSG_ANGRY   = ['PET ME!', 'MEOW!!', 'HEY!!', '*angry meow*', 'MIAU!', 'Acum!'];
  const MSG_ATTACK  = ['*ATTACK*', 'MIAU!!!', '*paw paw*', 'PET. ME. NOW.'];
  const MSG_HAPPY   = ['Prrr~', '\u2665', 'Mrrr~', ':3'];
  const MSG_SLEEP   = ['zzz...', '*snore*', 'z..z..'];

  // ── Main Class ─────────────────────────────────────────────────────
  class BrowserCat {
    constructor() {
      this.state = 'idle';
      this.catX = 200;
      this.catY = 0;
      this.targetX = 200;
      this.walkSpeed = 2;

      this.mouseX = window.innerWidth / 2;
      this.mouseY = window.innerHeight / 2;

      this.petCount = 0;
      this.petsNeeded = 3;
      this.totalPets = 0;

      this.stateTimer = null;
      this.attentionTimer = null;
      this.patienceTimer = null;
      this.frameId = null;
      this.bubbleTimer = null;

      // Config defaults (Testing preset)
      this.attentionMinDelay = 3000;
      this.attentionMaxDelay = 8000;
      this.patienceDelay = 4000;

      this.loadConfig().then(() => {
        console.log('[BrowserCat] Ready. Attention interval:',
          this.attentionMinDelay, '-', this.attentionMaxDelay,
          'Patience:', this.patienceDelay);
        this.init();
      });
    }

    init() {
      this.createDOM();
      this.bindEvents();
      this.catX = DW + Math.random() * (window.innerWidth - DW * 2);
      this.catY = window.innerHeight - DH;
      this.updatePosition();
      this.enterIdle();
      this.scheduleAttention();
      this.loadStats();
    }

    createDOM() {
      this.host = document.createElement('div');
      this.host.id = 'browser-cat-host';
      document.body.appendChild(this.host);

      this.shadow = this.host.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = STYLES;
      this.shadow.appendChild(style);

      this.overlay = document.createElement('div');
      this.overlay.id = 'overlay';
      this.shadow.appendChild(this.overlay);

      this.catEl = document.createElement('div');
      this.catEl.id = 'cat';
      this.catEl.innerHTML = '<div class="sprite sprite-rest"></div><div id="bubble"></div>';
      this.shadow.appendChild(this.catEl);

      this.sprite = this.catEl.querySelector('.sprite');
      this.bubble = this.catEl.querySelector('#bubble');
    }

    bindEvents() {
      document.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });

      // Click handler on document (capture phase) to bypass shadow DOM issues
      document.addEventListener('click', (e) => {
        const rect = this.catEl.getBoundingClientRect();
        if (rect.width === 0) return;
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          this.onPet();
        }
      }, true);

      // Also handle clicks on the overlay during attack
      this.overlay.addEventListener('click', (e) => {
        const rect = this.catEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        if (Math.sqrt(dx * dx + dy * dy) < DW) this.onPet();
      });

      this.overlay.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });

      window.addEventListener('resize', () => {
        if (this.state !== 'attacking') {
          this.catY = window.innerHeight - DH;
          this.catX = Math.max(0, Math.min(window.innerWidth - DW, this.catX));
          this.updatePosition();
        }
      });

      if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.type === 'summon') this.needAttention();
        });
      }

      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes) => {
          if (changes.catConfig) {
            const c = changes.catConfig.newValue || {};
            if (c.appearMinDelay != null) this.attentionMinDelay = c.appearMinDelay;
            if (c.appearMaxDelay != null) this.attentionMaxDelay = c.appearMaxDelay;
            if (c.demandDelay != null)    this.patienceDelay = c.demandDelay;
          }
        });
      }
    }

    // ── Config / Stats ───────────────────────────────────────────────
    loadConfig() {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) return resolve();
        chrome.storage.local.get(['catConfig'], (data) => {
          if (data.catConfig) {
            const c = data.catConfig;
            if (c.appearMinDelay != null) this.attentionMinDelay = c.appearMinDelay;
            if (c.appearMaxDelay != null) this.attentionMaxDelay = c.appearMaxDelay;
            if (c.demandDelay != null)    this.patienceDelay = c.demandDelay;
          }
          resolve();
        });
      });
    }

    loadStats() {
      if (chrome?.storage?.local) {
        chrome.storage.local.get(['totalPets'], (d) => { this.totalPets = d.totalPets || 0; });
      }
    }

    saveStats() {
      if (chrome?.storage?.local) chrome.storage.local.set({ totalPets: this.totalPets });
    }

    // ── Sprite switching ─────────────────────────────────────────────
    setSprite(name) {
      this.sprite.className = 'sprite sprite-' + name;
    }

    // ── State cleanup ────────────────────────────────────────────────
    clearState() {
      if (this.stateTimer) { clearTimeout(this.stateTimer); this.stateTimer = null; }
      if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
    }

    clearAttention() {
      if (this.attentionTimer) { clearTimeout(this.attentionTimer); this.attentionTimer = null; }
      if (this.patienceTimer) { clearTimeout(this.patienceTimer); this.patienceTimer = null; }
    }

    // ── IDLE ─────────────────────────────────────────────────────────
    enterIdle() {
      this.clearState();
      this.state = 'idle';
      this.catEl.classList.remove('purring');
      this.setSprite(Math.random() < 0.5 ? 'rest' : 'sit');

      const delay = 2000 + Math.random() * 4000;
      this.stateTimer = setTimeout(() => this.pickActivity(), delay);

      if (Math.random() < 0.3) {
        setTimeout(() => this.showBubble(this.pick(MSG_IDLE)), 500);
      }
    }

    // ── ACTIVITY PICKER ──────────────────────────────────────────────
    pickActivity() {
      if (this.state !== 'idle') return;

      const activities = ['walk', 'walk', 'walk', 'eat', 'wash', 'yawn', 'sleep', 'itch', 'sit'];
      const choice = activities[Math.floor(Math.random() * activities.length)];

      switch (choice) {
        case 'walk': this.startWalking(); break;
        case 'sit':  this.doActivity('sit', 1); break;
        default:     this.doActivity(choice, choice === 'sleep' ? 4 : 2); break;
      }
    }

    // ── WALKING ──────────────────────────────────────────────────────
    startWalking() {
      this.clearState();
      this.state = 'walking';
      this.walkSpeed = 1.5 + Math.random() * 1.5;

      const margin = DW;
      this.targetX = margin + Math.random() * (window.innerWidth - margin * 2);

      const dir = this.targetX > this.catX ? 'walk-right' : 'walk-left';
      this.setSprite(dir);
      this.walk();
    }

    walk() {
      if (this.state !== 'walking') return;

      const dx = this.targetX - this.catX;
      if (Math.abs(dx) < 4) {
        this.enterIdle();
        return;
      }

      this.catX += Math.sign(dx) * this.walkSpeed;
      this.updatePosition();
      this.frameId = requestAnimationFrame(() => this.walk());
    }

    // ── GENERIC ACTIVITY ─────────────────────────────────────────────
    doActivity(spriteName, loops) {
      this.clearState();
      this.state = 'activity';
      this.setSprite(spriteName);

      if (spriteName === 'sleep' && Math.random() < 0.5) {
        setTimeout(() => this.showBubble(this.pick(MSG_SLEEP)), 800);
      }

      const s = SPRITES[spriteName];
      const duration = s.frames * s.speed * loops * 1000;
      this.stateTimer = setTimeout(() => this.enterIdle(), duration);
    }

    // ── ATTENTION SYSTEM ─────────────────────────────────────────────
    scheduleAttention() {
      this.clearAttention();
      const delay = this.attentionMinDelay +
        Math.random() * (this.attentionMaxDelay - this.attentionMinDelay);
      this.attentionTimer = setTimeout(() => this.needAttention(), delay);
    }

    needAttention() {
      if (this.state === 'needy' || this.state === 'hissing' ||
          this.state === 'attacking' || this.state === 'happy') return;

      this.clearState();
      this.clearAttention();
      this.state = 'needy';
      this.petCount = 0;
      this.setSprite('meow');
      this.showBubble(this.pick(MSG_NEEDY));
      console.log('[BrowserCat] Needs attention!');

      this.patienceTimer = setTimeout(() => this.startHissing(), this.patienceDelay);
    }

    startHissing() {
      if (this.state !== 'needy') return;
      this.state = 'hissing';
      this.setSprite('hiss');
      this.showBubble(this.pick(MSG_ANGRY));
      console.log('[BrowserCat] Hissing!');

      this.patienceTimer = setTimeout(() => this.startAttacking(), this.patienceDelay);
    }

    startAttacking() {
      if (this.state !== 'hissing') return;
      this.state = 'attacking';
      this.setSprite('paw');
      this.overlay.classList.add('active');
      this.showBubble(this.pick(MSG_ATTACK));
      console.log('[BrowserCat] Attacking cursor!');
      this.attack();
    }

    attack() {
      if (this.state !== 'attacking') return;

      const catCX = this.catX + DW / 2;
      const catCY = this.catY + DH / 2;
      const dx = this.mouseX - catCX;
      const dy = this.mouseY - catCY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 10) {
        const speed = 0.08;
        this.catX += dx * speed;
        this.catY += dy * speed;
      }

      this.updatePosition();
      this.frameId = requestAnimationFrame(() => this.attack());
    }

    // ── PETTING ──────────────────────────────────────────────────────
    onPet() {
      if (this.state === 'happy') return;

      this.totalPets++;
      this.saveStats();
      this.spawnHeart();

      // If not in attention-demanding states, just show love
      if (this.state !== 'needy' && this.state !== 'hissing' && this.state !== 'attacking') {
        this.showBubble(this.pick(MSG_HAPPY));
        return;
      }

      this.petCount++;
      if (this.petCount >= this.petsNeeded) {
        this.satisfy();
      } else {
        this.showBubble(this.pick(MSG_HAPPY));
      }
    }

    // ── SATISFIED ────────────────────────────────────────────────────
    satisfy() {
      this.clearState();
      this.clearAttention();
      this.state = 'happy';

      this.overlay.classList.remove('active');
      this.setSprite('sleep');
      this.catEl.classList.add('purring');
      this.showBubble('Prrrrr~ \u2665');

      for (let i = 0; i < 5; i++) setTimeout(() => this.spawnHeart(), i * 200);

      this.stateTimer = setTimeout(() => {
        this.catY = window.innerHeight - DH;
        this.catX = Math.max(0, Math.min(window.innerWidth - DW, this.catX));
        this.updatePosition();
        this.catEl.classList.remove('purring');
        this.enterIdle();
        this.scheduleAttention();
      }, 2500);
    }

    // ── Helpers ──────────────────────────────────────────────────────
    updatePosition() {
      this.catEl.style.left = this.catX + 'px';
      this.catEl.style.top = this.catY + 'px';
    }

    showBubble(text) {
      this.bubble.textContent = text;
      this.bubble.classList.add('show');
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => this.hideBubble(), 3000);
    }

    hideBubble() { this.bubble.classList.remove('show'); }

    spawnHeart() {
      const h = document.createElement('div');
      h.className = 'heart';
      h.textContent = '\u2764\uFE0F';
      h.style.left = (this.catX + Math.random() * DW) + 'px';
      h.style.top = (this.catY - 10) + 'px';
      this.shadow.appendChild(h);
      setTimeout(() => h.remove(), 1000);
    }

    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  }

  // ── Start ──────────────────────────────────────────────────────────
  if (document.body) new BrowserCat();
  else document.addEventListener('DOMContentLoaded', () => new BrowserCat());
})();
