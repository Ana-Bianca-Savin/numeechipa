(function () {
  'use strict';

  const C = window.CAT;
  if (!C) return;

  const { DW, DH, STYLES } = C;

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

      this.attentionMinDelay = 3000;
      this.attentionMaxDelay = 8000;
      this.patienceDelay = 4000;

      this.loadConfig().then(() => {
        console.log('[BrowserCat] Ready. Attention:',
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

    // ── DOM ──────────────────────────────────────────────────────────
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

    // ── Events ───────────────────────────────────────────────────────
    bindEvents() {
      document.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });

      document.addEventListener('click', (e) => {
        const rect = this.catEl.getBoundingClientRect();
        if (rect.width === 0) return;
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          this.onPet();
        }
      }, true);

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

    // ── Helpers ──────────────────────────────────────────────────────
    setSprite(name) {
      this.sprite.className = 'sprite sprite-' + name;
    }

    clearState() {
      if (this.stateTimer) { clearTimeout(this.stateTimer); this.stateTimer = null; }
      if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
    }

    clearAttention() {
      if (this.attentionTimer) { clearTimeout(this.attentionTimer); this.attentionTimer = null; }
      if (this.patienceTimer) { clearTimeout(this.patienceTimer); this.patienceTimer = null; }
    }

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

    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  }

  // ── Apply all registered behaviors ─────────────────────────────────
  for (const b of C.behaviors) {
    b.apply(BrowserCat.prototype);
  }

  // ── Boot ───────────────────────────────────────────────────────────
  if (document.body) new BrowserCat();
  else document.addEventListener('DOMContentLoaded', () => new BrowserCat());

  delete window.CAT;
})();
