(function () {
  'use strict';

  const C = window.CAT;
  if (!C) return;

  const { DW, DH, STYLES } = C;

  class BrowserCat {
    constructor() {
      this.currentAction = null;
      this.catX = 300;
      this.catY = 0;
      this.frameId = null;
      this.bubbleTimer = null;

      this.mouseX = window.innerWidth / 2;
      this.mouseY = window.innerHeight / 2;

      this.createDOM();
      this.bindEvents();

      this.catY = window.innerHeight - DH;

      // Connect to background to keep service worker alive
      this.port = chrome.runtime.connect({ name: 'cat-keepalive' });

      // Load initial state
      chrome.storage.local.get(['catState'], (data) => {
        if (data.catState) this.applyState(data.catState);
      });

      // React to all state changes from background
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.catState && changes.catState.newValue) {
          this.applyState(changes.catState.newValue);
        }
      });
    }

    // ── State application (reactive) ─────────────────────────────────
    applyState(s) {
      if (!s) return;

      const oldAction = this.currentAction;
      const newAction = s.action;

      if (oldAction === newAction) return;

      // Exit old state
      const exitFn = this['exit_' + oldAction];
      if (exitFn) exitFn.call(this);

      // Update position from state (walk/attack compute it locally)
      if (newAction !== 'walking' && newAction !== 'attacking') {
        if (s.catX != null) {
          this.catX = Math.max(0, Math.min(window.innerWidth - DW, s.catX));
        }
        this.catY = window.innerHeight - DH;
        this.updatePosition();
      }

      this.currentAction = newAction;

      // Set sprite with animation sync (walk overrides in enter handler)
      if (newAction !== 'walking') {
        this.setSprite(s.sprite, s.animStart);
      }

      // Enter new state
      const enterFn = this['enter_' + newAction];
      if (enterFn) enterFn.call(this, s);
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
        if (this.currentAction !== 'attacking') {
          this.catY = window.innerHeight - DH;
          this.catX = Math.max(0, Math.min(window.innerWidth - DW, this.catX));
          this.updatePosition();
        }
      });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    setSprite(name, animStart) {
      // Sync animation frame across tabs using animation-delay
      if (animStart) {
        const offset = (Date.now() - animStart) / 1000;
        this.sprite.style.animationDelay = -offset + 's';
      } else {
        this.sprite.style.animationDelay = '0s';
      }
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
