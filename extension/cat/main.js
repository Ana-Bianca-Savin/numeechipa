(function () {
  'use strict';

  const C = window.CAT;
  if (!C) return;

  const { DW, DH, STYLES } = C;

  class BrowserCat {
    constructor() {
      this.currentAction = null;
      this.catX = 200;
      this.catY = 0;
      this.targetX = 200;
      this.walkSpeed = 2;

      this.mouseX = window.innerWidth / 2;
      this.mouseY = window.innerHeight / 2;

      this.frameId = null;
      this.bubbleTimer = null;

      this.createDOM();
      this.bindEvents();

      this.catX = DW + Math.random() * (window.innerWidth - DW * 2);
      this.catY = window.innerHeight - DH;
      this.updatePosition();

      // Connect to background to keep service worker alive
      this.port = chrome.runtime.connect({ name: 'cat-keepalive' });

      // Load initial state
      chrome.storage.local.get(['catState'], (data) => {
        if (data.catState) this.applyState(data.catState);
      });

      // React to state changes from background
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.catState) {
          this.applyState(changes.catState.newValue);
        }
      });
    }

    // ── State application ────────────────────────────────────────────
    applyState(newState) {
      if (!newState) return;

      const oldAction = this.currentAction;
      const newAction = newState.action;

      if (oldAction === newAction) return;

      // Exit old state
      const exitFn = this['exit_' + oldAction];
      if (exitFn) exitFn.call(this);

      this.currentAction = newAction;

      // Set sprite (walking overrides locally in enter_walking)
      if (newAction !== 'walking') {
        this.setSprite(newState.sprite);
      }

      // Enter new state
      const enterFn = this['enter_' + newAction];
      if (enterFn) enterFn.call(this, newState);
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

      // Capture-phase click on document to bypass shadow DOM issues
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
        if (this.currentAction !== 'attacking') {
          this.catY = window.innerHeight - DH;
          this.catX = Math.max(0, Math.min(window.innerWidth - DW, this.catX));
          this.updatePosition();
        }
      });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    setSprite(name) {
      this.sprite.className = 'sprite sprite-' + name;
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
