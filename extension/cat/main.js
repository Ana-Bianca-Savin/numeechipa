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

      if (this.initKeyboard) this.initKeyboard();

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

  // ── Extra cat (idle/walk/activities + responds to attention) ──
  // Shared config for all extra cats, loaded from storage
  const extraConfig = {
    idleMinDelay: 2000,
    idleMaxDelay: 6000,
    walkMinSpeed: 0.8,
    walkMaxSpeed: 1.5,
    sleepLoops: 8,
    activityLoops: 3,
  };

  function loadExtraConfig() {
    chrome.storage.local.get(['catConfig'], (data) => {
      const c = data.catConfig || {};
      if (c.idleMinDelay != null) extraConfig.idleMinDelay = c.idleMinDelay;
      if (c.idleMaxDelay != null) extraConfig.idleMaxDelay = c.idleMaxDelay;
      if (c.walkMinSpeed != null) extraConfig.walkMinSpeed = c.walkMinSpeed;
      if (c.walkMaxSpeed != null) extraConfig.walkMaxSpeed = c.walkMaxSpeed;
    });
  }
  loadExtraConfig();

  // Listen for config changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.catConfig && changes.catConfig.newValue) {
      const c = changes.catConfig.newValue;
      if (c.idleMinDelay != null) extraConfig.idleMinDelay = c.idleMinDelay;
      if (c.idleMaxDelay != null) extraConfig.idleMaxDelay = c.idleMaxDelay;
      if (c.walkMinSpeed != null) extraConfig.walkMinSpeed = c.walkMinSpeed;
      if (c.walkMaxSpeed != null) extraConfig.walkMaxSpeed = c.walkMaxSpeed;
    }
  });

  class ExtraCat {
    constructor() {
      this.catX = Math.random() * (window.innerWidth - DW);
      this.catY = Math.random() * (window.innerHeight - DH);
      this.frameId = null;
      this.bubbleTimer = null;
      this.action = 'idle';
      this.mouseX = window.innerWidth / 2;
      this.mouseY = window.innerHeight / 2;

      this.host = document.createElement('div');
      document.body.appendChild(this.host);
      this.shadow = this.host.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = STYLES;
      this.shadow.appendChild(style);

      this.catEl = document.createElement('div');
      this.catEl.id = 'cat';
      this.catEl.innerHTML = '<div class="sprite sprite-rest"></div><div id="bubble"></div>';
      this.shadow.appendChild(this.catEl);

      this.sprite = this.catEl.querySelector('.sprite');
      this.bubble = this.catEl.querySelector('#bubble');

      this.countdownEl = document.createElement('div');
      this.countdownEl.id = 'countdown';
      this.shadow.appendChild(this.countdownEl);

      this.lastPetTime = 0;

      // Click to pet
      document.addEventListener('click', (e) => {
        const rect = this.catEl.getBoundingClientRect();
        if (rect.width === 0) return;
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          this.onPet();
        }
      }, true);

      document.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });

      this.updatePosition();
      this._enterIdle();
    }

    onPet() {
      if (this.action === 'happy') return;
      const now = Date.now();
      if (now - this.lastPetTime < C.TUNING.petDebounce) return;
      this.lastPetTime = now;

      this.spawnHeart();
      this.showBubble(this.pick(C.MESSAGES.happy));
      chrome.runtime.sendMessage({ type: 'pet', catX: this.catX, catY: this.catY });
    }

    spawnHeart() {
      const h = document.createElement('div');
      h.className = 'heart';
      h.textContent = '\u2764\uFE0F';
      h.style.left = (this.catX + Math.random() * DW) + 'px';
      h.style.top = (this.catY + C.TUNING.heartOffsetY) + 'px';
      this.shadow.appendChild(h);
      setTimeout(() => h.remove(), C.TUNING.heartDuration);
    }

    setSprite(name, animStart, frame) {
      if (frame != null) {
        const info = C.SPRITES[name];
        if (info) {
          this.sprite.style.backgroundImage = "url('" + info.url + "')";
          this.sprite.style.backgroundSize = (info.frames * DW) + 'px ' + DH + 'px';
          this.sprite.style.backgroundPosition = -(frame * DW) + 'px 0';
          this.sprite.style.animationDelay = '0s';
          this.sprite.className = 'sprite';
          return;
        }
      }
      if (animStart) {
        this.sprite.style.animationDelay = -((Date.now() - animStart) / 1000) + 's';
      } else {
        this.sprite.style.animationDelay = '0s';
      }
      this.sprite.style.backgroundImage = '';
      this.sprite.style.backgroundSize = '';
      this.sprite.style.backgroundPosition = '';
      this.sprite.className = 'sprite sprite-' + name;
      // Play hiss sound on hiss sprite
      if (name === 'hiss' && C.playSound) C.playSound('hiss');
    }

    updatePosition() {
      this.catEl.style.left = this.catX + 'px';
      this.catEl.style.top = this.catY + 'px';
    }

    showBubble(text) {
      this.bubble.textContent = text;
      this.bubble.classList.add('show');
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => this.bubble.classList.remove('show'), C.TUNING.bubbleDuration);
      // Play sound for message
      if (C.playMessageSound) C.playMessageSound(text);
    }

    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ── Attention: follows main cat's escalation state ──
    summon(escalationState) {
      const state = escalationState || 'needy';
      const chaseStates = ['needy', 'hissing', 'attacking'];
      if (!chaseStates.includes(state)) return;

      // If already chasing at same or higher level, skip
      if (chaseStates.includes(this.action) &&
          chaseStates.indexOf(this.action) >= chaseStates.indexOf(state)) return;

      if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      clearTimeout(this._timer);

      this.action = state;
      this._chaseSitting = false;
      this._chaseSitUntil = 0;
      this._mouseEscapedAt = null;

      // Speed multiplier per state
      const mults = { needy: C.TUNING.chaseNeedyMult, hissing: C.TUNING.chaseHissMult, attacking: C.TUNING.chaseAttackMult };
      this._chaseSpeedMult = mults[state] || 1;
      this._chaseSitSprite = { needy: 'meow', hissing: 'hiss', attacking: 'paw' }[state];

      if (!this._chaseGlobalStart) this._chaseGlobalStart = Date.now();
      this._chaseRunStart = Date.now();

      const msgs = { needy: C.MESSAGES.needy, hissing: C.MESSAGES.angry, attacking: C.MESSAGES.attack };
      this.showBubble(this.pick(msgs[state]));
      this._chaseLoop();
    }

    _chaseLoop() {
      const chaseStates = ['needy', 'hissing', 'attacking'];
      if (!chaseStates.includes(this.action)) return;

      const now = Date.now();
      const catCX = this.catX + DW / 2;
      const catCY = this.catY + DH / 2;
      const dx = this.mouseX - catCX;
      const dy = this.mouseY - catCY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Gradual speed ramp
      const totalChaseTime = (now - (this._chaseGlobalStart || now)) / 1000;
      const speed = Math.min(
        (C.TUNING.chaseBaseSpeed + totalChaseTime * C.TUNING.chaseSpeedRamp) * (this._chaseSpeedMult || 1),
        C.TUNING.chaseMaxSpeed
      );

      if (this._chaseSitting && now < this._chaseSitUntil) {
        // Attacking: resume sooner if mouse escapes
        if (this.action === 'attacking' && dist > DW) {
          this._cancelCountdown();
          if (!this._mouseEscapedAt) {
            this._mouseEscapedAt = now;
          } else if (now - this._mouseEscapedAt >= C.TUNING.chaseAttackResumeDelay) {
            this._chaseSitting = false;
            this._chaseRunStart = now;
            this._mouseEscapedAt = null;
          }
        } else {
          this._mouseEscapedAt = null;
          // Schedule countdown in attacking
          if (this.action === 'attacking' && !this._countdownActive && !this._countdownStartTimer) {
            this._countdownStartTimer = setTimeout(() => {
              if (this._chaseSitting && this.action === 'attacking') {
                this._startCountdown();
              }
            }, C.TUNING.attackCountdownDelay);
          }
        }
      } else if (this._chaseSitting && now >= this._chaseSitUntil) {
        this._mouseEscapedAt = null;
        this._chaseSitting = false;
        this._chaseRunStart = now;
      } else if (dist > speed) {
        // Frustration check
        const chaseRunElapsed = now - (this._chaseRunStart || now);
        if (chaseRunElapsed > C.TUNING.chaseFrustrationTime) {
          this._chaseSitting = true;
          const sitDur = C.TUNING.chaseSitMin + Math.random() * (C.TUNING.chaseSitMax - C.TUNING.chaseSitMin);
          this._chaseSitUntil = now + sitDur;
          this.setSprite('hiss');
          this.showBubble(this.pick(C.MESSAGES.angry));
        } else {
          this.catX += (dx / dist) * speed;
          this.catY += (dy / dist) * speed;
          if (Math.abs(dx) >= Math.abs(dy)) {
            this.setSprite(dx > 0 ? 'walk-right' : 'walk-left');
          } else {
            this.setSprite(dy > 0 ? 'walk-down' : 'walk-up');
          }
        }
      } else {
        // Caught cursor
        this.catX = this.mouseX - DW / 2;
        this.catY = this.mouseY - DH / 2;
        if (!this._chaseSitting) {
          this._chaseSitting = true;
          const sitDur = C.TUNING.chaseSitMin + Math.random() * (C.TUNING.chaseSitMax - C.TUNING.chaseSitMin);
          this._chaseSitUntil = now + sitDur;
          this.setSprite(this._chaseSitSprite);
        }
      }

      this.updatePosition();
      this.frameId = requestAnimationFrame(() => this._chaseLoop());
    }

    _startCountdown() {
      if (this._countdownActive) return;
      this._countdownActive = true;
      this._countdownValue = C.TUNING.attackCountdownDuration;
      this.countdownEl.textContent = this._countdownValue;
      this.countdownEl.classList.remove('hiding');
      this.countdownEl.classList.add('active');

      this._countdownInterval = setInterval(() => {
        this._countdownValue--;
        if (this._countdownValue <= 0) {
          this._cancelCountdown();
          this.showBubble(this.pick(C.MESSAGES.rageQuit));
          setTimeout(() => {
            chrome.runtime.sendMessage({ type: 'closeTab' });
          }, 500);
        } else {
          this.countdownEl.textContent = this._countdownValue;
        }
      }, 1000);
    }

    _cancelCountdown() {
      clearTimeout(this._countdownStartTimer);
      this._countdownStartTimer = null;
      if (!this._countdownActive) return;
      this._countdownActive = false;
      clearInterval(this._countdownInterval);
      this.countdownEl.classList.add('hiding');
      setTimeout(() => {
        this.countdownEl.classList.remove('active', 'hiding');
      }, 300);
    }

    // Main cat became happy → extra cats purr too
    enterHappy() {
      this._chaseGlobalStart = null;
      if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      clearTimeout(this._timer);
      this.action = 'happy';
      this.catEl.classList.add('purring');
      this.showBubble(this.pick(C.MESSAGES.happy));
      for (let i = 0; i < C.TUNING.happyHeartCount; i++) {
        setTimeout(() => this.spawnHeart(), i * C.TUNING.happyHeartInterval);
      }
    }

    exitHappy() {
      this.catEl.classList.remove('purring');
      this._enterIdle();
    }

    // ── 67 animation ──
    trigger67(spriteName) {
      const a = this.action;
      if (a === 'needy' || a === 'hissing' || a === 'attacking') return;

      if (!this._67active) {
        this._67savedAction = this.action;
        if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      }

      this._67active = true;
      this.setSprite(spriteName);
      this.showBubble('67!');

      clearTimeout(this._67timeout);
      this._67timeout = setTimeout(() => {
        this._67active = false;
        this.bubble.classList.remove('show');

        const action = this._67savedAction;
        this._67savedAction = null;

        if (action === 'walking') {
          this._startWalk();
        } else {
          this._enterIdle();
        }
      }, 1500);
    }

    // Extra cats calm down when main cat is satisfied
    calmDown() {
      this._chaseGlobalStart = null;
      this._enterIdle();
    }

    // ── Idle ──
    _enterIdle() {
      this.action = 'idle';
      if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      clearTimeout(this._timer);

      const spr = Math.random() < 0.5 ? 'rest' : 'sit';
      const info = C.SPRITES[spr];
      const frame = Math.floor(Math.random() * (info ? info.frames : 6));
      this.setSprite(spr, null, frame);

      if (Math.random() < C.TUNING.idleBubbleChance) {
        setTimeout(() => this.showBubble(this.pick(C.MESSAGES.idle)), C.TUNING.idleBubbleDelay);
      }

      const delay = extraConfig.idleMinDelay +
        Math.random() * (extraConfig.idleMaxDelay - extraConfig.idleMinDelay);
      this._timer = setTimeout(() => this._pickActivity(), delay);
    }

    _pickActivity() {
      const choices = ['walk', 'walk', 'walk', 'sit', 'sleep', 'eat', 'wash', 'yawn', 'itch'];
      const choice = choices[Math.floor(Math.random() * choices.length)];

      if (choice === 'walk') {
        this._startWalk();
      } else {
        this.action = 'activity';
        const info = C.SPRITES[choice];
        if (choice === 'sit') {
          const frame = Math.floor(Math.random() * (info ? info.frames : 6));
          this.setSprite('sit', null, frame);
        } else {
          this.setSprite(choice);
        }

        const msgMap = { sleep: C.MESSAGES.sleep, eat: C.MESSAGES.eat, wash: C.MESSAGES.wash,
                         yawn: C.MESSAGES.yawn, itch: C.MESSAGES.itch, sit: C.MESSAGES.sit };
        if (msgMap[choice]) this.showBubble(this.pick(msgMap[choice]));

        const loops = choice === 'sleep' ? extraConfig.sleepLoops : extraConfig.activityLoops;
        const duration = info ? info.frames * info.speed * loops * 1000 : 3000;
        this._timer = setTimeout(() => this._enterIdle(), duration);
      }
    }

    _startWalk() {
      this.action = 'walking';
      const margin = DW;
      this._walkTargetX = margin + Math.random() * (window.innerWidth - margin * 2);
      this._walkTargetY = margin + Math.random() * (window.innerHeight - margin * 2);
      this._walkSpeed = extraConfig.walkMinSpeed +
        Math.random() * (extraConfig.walkMaxSpeed - extraConfig.walkMinSpeed);

      if (Math.random() < 0.4) this.showBubble(this.pick(C.MESSAGES.walk));

      this._walkLoop();
    }

    _walkLoop() {
      if (this.action !== 'walking') return;

      const dx = this._walkTargetX - this.catX;
      const dy = this._walkTargetY - this.catY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this._walkSpeed) {
        this.catX = this._walkTargetX;
        this.catY = this._walkTargetY;
        this.updatePosition();
        this._enterIdle();
        return;
      }

      this.catX += (dx / dist) * this._walkSpeed;
      this.catY += (dy / dist) * this._walkSpeed;
      this.updatePosition();

      if (Math.abs(dx) >= Math.abs(dy)) {
        this.setSprite(dx > 0 ? 'walk-right' : 'walk-left');
      } else {
        this.setSprite(dy > 0 ? 'walk-down' : 'walk-up');
      }

      this.frameId = requestAnimationFrame(() => this._walkLoop());
    }

    destroy() {
      if (this.frameId) cancelAnimationFrame(this.frameId);
      clearTimeout(this._timer);
      clearTimeout(this.bubbleTimer);
      clearTimeout(this._67timeout);
      this._cancelCountdown();
      this.host.remove();
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────
  let extraCats = [];

  function syncExtraCats(count) {
    while (extraCats.length > count) {
      extraCats.pop().destroy();
    }
    while (extraCats.length < count) {
      extraCats.push(new ExtraCat());
    }
  }

  function boot() {
    new BrowserCat();

    // 67 for all extra cats
    document.addEventListener('keydown', (e) => {
      if (e.key === '6') {
        for (const cat of extraCats) cat.trigger67('67');
      } else if (e.key === '7') {
        for (const cat of extraCats) cat.trigger67('67-mirrored');
      }
    });

    chrome.storage.local.get(['extraCatCount'], (data) => {
      syncExtraCats(data.extraCatCount || 0);
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.extraCatCount && changes.extraCatCount.newValue != null) {
        syncExtraCats(changes.extraCatCount.newValue);
      }
      // Extra cats follow main cat's escalation
      if (changes.catState && changes.catState.newValue) {
        const action = changes.catState.newValue.action;
        if (action === 'needy' || action === 'hissing' || action === 'attacking') {
          for (const cat of extraCats) cat.summon(action);
        } else if (action === 'happy') {
          for (const cat of extraCats) cat.enterHappy();
        } else if (action === 'idle') {
          for (const cat of extraCats) {
            if (cat.action === 'happy') cat.exitHappy();
            else cat.calmDown();
          }
        }
      }
    });
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);

  delete window.CAT;
})();
