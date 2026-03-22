(function () {
  'use strict';

  const C = window.CAT;
  if (!C) return;

  const { DW, DH, STYLES } = C;

  class BrowserCat {
    constructor() {
      this.currentAction = null;
      this.catX = 300;
      this.catY = window.innerHeight - DH;
      this.frameId = null;
      this.bubbleTimer = null;

      this.mouseX = window.innerWidth / 2;
      this.mouseY = window.innerHeight / 2;
      this.lastPetTime = 0;

      this.createDOM();
      this.bindEvents();

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

      // Position: skip on local→local transitions (preserves chase position)
      const localStates = ['walking', 'needy', 'hissing', 'attacking'];
      const wasLocal = localStates.includes(oldAction);
      const isLocal = localStates.includes(newAction);

      if (!(isLocal && wasLocal)) {
        if (s.catX != null) {
          this.catX = Math.max(0, Math.min(window.innerWidth - DW, s.catX));
        }
        if (s.catY != null) {
          this.catY = Math.max(0, Math.min(window.innerHeight - DH, s.catY));
        }
        this.updatePosition();
      }

      this.currentAction = newAction;

      // Sprite: always set from state (enter functions may override)
      this.setSprite(s.sprite, s.animStart, s.spriteFrame);

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

      this.countdownEl = document.createElement('div');
      this.countdownEl.id = 'countdown';
      this.shadow.appendChild(this.countdownEl);
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
          this.catX = Math.max(0, Math.min(window.innerWidth - DW, this.catX));
          this.catY = Math.max(0, Math.min(window.innerHeight - DH, this.catY));
          this.updatePosition();
        }
      });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    setSprite(name, animStart, frame) {
      if (frame != null) {
        // Static single frame — no animation
        const info = C.SPRITES[name];
        if (info) {
          this.sprite.style.backgroundImage = "url('" + info.url + "')";
          this.sprite.style.backgroundSize = (info.frames * DW) + 'px ' + DH + 'px';
          this.sprite.style.backgroundPosition = -(frame * DW) + 'px 0';
          this.sprite.style.animationDelay = '0s';
          this.sprite.className = 'sprite';  // no animation class
          return;
        }
      }
      // Animated sprite
      if (animStart) {
        const offset = (Date.now() - animStart) / 1000;
        this.sprite.style.animationDelay = -offset + 's';
      } else {
        this.sprite.style.animationDelay = '0s';
      }
      this.sprite.style.backgroundImage = '';
      this.sprite.style.backgroundSize = '';
      this.sprite.style.backgroundPosition = '';
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
      this.bubbleTimer = setTimeout(() => this.hideBubble(), C.TUNING.bubbleDuration);
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
