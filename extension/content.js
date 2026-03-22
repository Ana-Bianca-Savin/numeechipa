(function () {
  'use strict';

  if (window !== window.top) return;

  // ── Sprite config ──────────────────────────────────────────────────
  const FRAME = 16;        // source frame size
  const SCALE = 5;         // display scale (16 * 5 = 80px)
  const SIZE = FRAME * SCALE;

  const SPRITES = {
    idle: { url: chrome.runtime.getURL('sprites/rest.png'),       frames: 12, speed: 0.12 },
    walk: { url: chrome.runtime.getURL('sprites/walk-right.png'), frames: 8,  speed: 0.08 },
    meow: { url: chrome.runtime.getURL('sprites/meow-sit.png'),  frames: 6,  speed: 0.15 },
    sleep:{ url: chrome.runtime.getURL('sprites/sleep.png'),      frames: 4,  speed: 0.35 },
  };

  // ── CSS ────────────────────────────────────────────────────────────
  // Generate keyframes for each sprite
  let spriteCSS = '';
  for (const [name, s] of Object.entries(SPRITES)) {
    spriteCSS += `
      @keyframes anim-${name} {
        from { background-position: 0 0; }
        to   { background-position: -${s.frames * SIZE}px 0; }
      }
      .sprite-${name} {
        background-image: url('${s.url}');
        background-size: ${s.frames * SIZE}px ${SIZE}px;
        animation: anim-${name} ${s.frames * s.speed}s steps(${s.frames}) infinite;
      }
    `;
  }

  const STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      position: fixed !important;
      top: 0 !important; left: 0 !important;
      width: 100vw !important; height: 100vh !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      overflow: hidden;
    }

    #overlay {
      display: none;
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: auto;
      cursor: none;
    }
    #overlay.active { display: block; }

    #cat {
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
      width: ${SIZE}px;
      height: ${SIZE}px;
      transform: translate(-50%, -50%);
      user-select: none;
      -webkit-user-select: none;
    }
    #cat.hidden { display: none; }
    #cat.flip .sprite { transform: scaleX(-1); }

    .sprite {
      width: ${SIZE}px;
      height: ${SIZE}px;
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
      position: absolute;
      font-size: 18px;
      pointer-events: none;
      animation: float-up 1s ease-out forwards;
      z-index: 20;
    }
    @keyframes float-up {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-60px) scale(1.5); }
    }

    /* ── Entrance ── */
    #cat.entering {
      animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    @keyframes pop-in {
      0%   { transform: translate(-50%,-50%) scale(0); }
      70%  { transform: translate(-50%,-50%) scale(1.15); }
      100% { transform: translate(-50%,-50%) scale(1); }
    }

    /* ── Leave ── */
    #cat.leaving {
      animation: shrink-out 0.4s ease-in forwards;
      pointer-events: none;
    }
    @keyframes shrink-out {
      0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
      100% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
    }

    /* ── Walk bounce ── */
    #cat.walking {
      animation: walk-bounce 0.35s ease-in-out infinite;
    }
    @keyframes walk-bounce {
      0%, 100% { transform: translate(-50%,-50%) translateY(0); }
      50%      { transform: translate(-50%,-50%) translateY(-6px); }
    }

    /* ── Purr vibration ── */
    #cat.purring {
      animation: purr 0.12s linear infinite;
    }
    @keyframes purr {
      0%, 100% { transform: translate(-50%,-50%) translateX(0); }
      25%      { transform: translate(-50%,-50%) translateX(-2px); }
      75%      { transform: translate(-50%,-50%) translateX(2px); }
    }
  `;

  // ── Messages ───────────────────────────────────────────────────────
  const MSG_APPEAR = ['Meow!','Pet me!','Mrrp?','Miau!','*purr*','Hey!','Psst!','Notice me!'];
  const MSG_DEMAND = ['PET ME!','MEOW!!','HEY!!','*angry meow*','MIAU!','Acum!'];
  const MSG_HAPPY  = ['Prrr~','♡','Mrrr~',':3'];

  // ── Main Class ─────────────────────────────────────────────────────
  class BrowserCat {
    constructor() {
      this.state = 'hidden';
      this.mouseX = window.innerWidth / 2;
      this.mouseY = window.innerHeight / 2;
      this.catX = 0;
      this.catY = 0;
      this.petCount = 0;
      this.petsNeeded = 3;
      this.totalPets = 0;
      this.demandTimeout = null;
      this.frameId = null;

      this.appearMinDelay = 3000;
      this.appearMaxDelay = 8000;
      this.demandDelay = 4000;
      this.chaseSpeed = 0.04;

      this.loadConfig().then(() => {
        console.log('[BrowserCat] Ready, delays:', this.appearMinDelay, '-', this.appearMaxDelay);
        this.init();
      });
    }

    init() {
      this.createDOM();
      this.bindEvents();
      this.scheduleAppearance();
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
      this.catEl.className = 'hidden';
      this.catEl.innerHTML = '<div class="sprite sprite-idle"></div><div id="bubble"></div>';
      this.shadow.appendChild(this.catEl);

      this.sprite = this.catEl.querySelector('.sprite');
      this.bubble = this.catEl.querySelector('#bubble');

      console.log('[BrowserCat] DOM created');
    }

    bindEvents() {
      document.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
      this.overlay.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });

      this.overlay.addEventListener('click', (e) => {
        const dx = e.clientX - this.catX, dy = e.clientY - this.catY;
        if (Math.sqrt(dx*dx + dy*dy) < 60) this.onPet();
      });

      this.catEl.addEventListener('click', () => this.onPet());

      if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'summon') this.appear(); });
      }

      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes) => {
          if (changes.catConfig) {
            const c = changes.catConfig.newValue || {};
            if (c.appearMinDelay != null) this.appearMinDelay = c.appearMinDelay;
            if (c.appearMaxDelay != null) this.appearMaxDelay = c.appearMaxDelay;
            if (c.demandDelay != null)    this.demandDelay = c.demandDelay;
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
            if (c.appearMinDelay != null) this.appearMinDelay = c.appearMinDelay;
            if (c.appearMaxDelay != null) this.appearMaxDelay = c.appearMaxDelay;
            if (c.demandDelay != null)    this.demandDelay = c.demandDelay;
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

    // ── Scheduling ───────────────────────────────────────────────────
    scheduleAppearance() {
      const delay = this.appearMinDelay + Math.random() * (this.appearMaxDelay - this.appearMinDelay);
      this.appearTimer = setTimeout(() => this.appear(), delay);
    }

    // ── Appear ───────────────────────────────────────────────────────
    appear() {
      if (this.state !== 'hidden') return;
      this.state = 'appearing';
      this.petCount = 0;
      this.setSprite('idle');

      const edge = Math.floor(Math.random() * 4);
      const m = SIZE;
      switch (edge) {
        case 0: this.catX = m + Math.random()*(window.innerWidth-m*2);  this.catY = m; break;
        case 1: this.catX = window.innerWidth-m;  this.catY = m + Math.random()*(window.innerHeight-m*2); break;
        case 2: this.catX = m + Math.random()*(window.innerWidth-m*2);  this.catY = window.innerHeight-m; break;
        case 3: this.catX = m;  this.catY = m + Math.random()*(window.innerHeight-m*2); break;
      }

      this.catEl.className = 'entering';
      this.updatePosition();
      this.showBubble(this.pick(MSG_APPEAR));
      console.log('[BrowserCat] Appearing at', Math.round(this.catX), Math.round(this.catY));

      setTimeout(() => {
        this.catEl.classList.remove('entering');
        this.catEl.className = '';
        this.state = 'waiting';
        this.setSprite('meow');
        this.demandTimeout = setTimeout(() => this.startChasing(), this.demandDelay);
      }, 400);
    }

    // ── Chase ────────────────────────────────────────────────────────
    startChasing() {
      if (this.state !== 'waiting') return;
      this.state = 'chasing';
      this.setSprite('walk');
      this.catEl.classList.add('walking');
      this.overlay.classList.add('active');
      this.showBubble(this.pick(MSG_DEMAND));
      this.chase();
    }

    chase() {
      if (this.state !== 'chasing') return;

      const dx = this.mouseX - this.catX;
      const dy = this.mouseY - this.catY;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist > 20) {
        this.catX += dx * this.chaseSpeed;
        this.catY += dy * this.chaseSpeed;
      }

      if (dx < -5) this.catEl.classList.add('flip');
      else if (dx > 5) this.catEl.classList.remove('flip');

      if (dist < 30) {
        this.catEl.classList.remove('walking');
        this.setSprite('meow');
      } else if (!this.catEl.classList.contains('walking')) {
        this.catEl.classList.add('walking');
        this.setSprite('walk');
      }

      this.updatePosition();
      this.frameId = requestAnimationFrame(() => this.chase());
    }

    // ── Petting ──────────────────────────────────────────────────────
    onPet() {
      if (this.state === 'hidden' || this.state === 'leaving') return;

      this.petCount++;
      this.totalPets++;
      this.saveStats();
      this.spawnHeart();

      if (this.demandTimeout) { clearTimeout(this.demandTimeout); this.demandTimeout = null; }

      if (this.petCount >= this.petsNeeded) {
        this.satisfy();
      } else {
        this.showBubble(this.pick(MSG_HAPPY));
      }
    }

    // ── Satisfied ────────────────────────────────────────────────────
    satisfy() {
      this.state = 'satisfied';
      if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      this.overlay.classList.remove('active');
      this.catEl.classList.remove('walking');

      this.setSprite('sleep');
      this.catEl.classList.add('purring');
      this.showBubble('Prrrrr~ ♡');

      for (let i = 0; i < 5; i++) setTimeout(() => this.spawnHeart(), i * 200);
      setTimeout(() => this.leave(), 2000);
    }

    // ── Leave ────────────────────────────────────────────────────────
    leave() {
      this.state = 'leaving';
      this.catEl.classList.remove('purring');
      this.catEl.classList.add('leaving');
      this.hideBubble();

      setTimeout(() => {
        this.catEl.className = 'hidden';
        this.setSprite('idle');
        this.state = 'hidden';
        this.scheduleAppearance();
      }, 400);
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
      h.style.left = (this.catX - 20 + Math.random() * 40) + 'px';
      h.style.top = (this.catY - 20) + 'px';
      this.shadow.appendChild(h);
      setTimeout(() => h.remove(), 1000);
    }

    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  }

  // ── Start ──────────────────────────────────────────────────────────
  if (document.body) new BrowserCat();
  else document.addEventListener('DOMContentLoaded', () => new BrowserCat());
})();
