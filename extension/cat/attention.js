(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'attention',
    apply(proto) {

      // ── Shared chase state factory ──
      function makeChaseState(action, speedMult, sitSprite, messages) {
        proto['enter_' + action] = function () {
          this.showBubble(this.pick(messages));
          this._chaseSpeedMult = speedMult;
          this._chaseSitSprite = sitSprite;
          this._chaseSitting = false;
          this._chaseSitUntil = 0;
          this._lastPosReport = 0;

          // Track when chasing started (globally, across escalation states)
          if (!this._chaseGlobalStart) {
            this._chaseGlobalStart = Date.now();
          }
          // Track continuous chase time for frustration mechanic
          this._chaseRunStart = Date.now();

          this._chaseLoop();
        };

        proto['exit_' + action] = function () {
          if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
          this._cancelCountdown();
        };
      }

      // ── Chase loop (shared by all 3 states) ──
      proto._chaseLoop = function () {
        const action = this.currentAction;
        if (action !== 'needy' && action !== 'hissing' && action !== 'attacking') return;

        const now = Date.now();
        const catCX = this.catX + C.DW / 2;
        const catCY = this.catY + C.DH / 2;
        const dx = this.mouseX - catCX;
        const dy = this.mouseY - catCY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Gradual speed ramp based on total chase time, multiplied by state escalation
        const totalChaseTime = (now - (this._chaseGlobalStart || now)) / 1000;
        const mult = this._chaseSpeedMult || 1.0;
        const speed = Math.min(
          (C.TUNING.chaseBaseSpeed + totalChaseTime * C.TUNING.chaseSpeedRamp) * mult,
          C.TUNING.chaseMaxSpeed
        );

        // Still in sit cooldown — stay put (but in attacking, resume sooner if mouse escapes)
        if (this._chaseSitting && now < this._chaseSitUntil) {
          if (action === 'attacking' && dist > C.DW) {
            // Mouse moved away — cancel countdown, track escape
            this._cancelCountdown();
            if (!this._mouseEscapedAt) {
              this._mouseEscapedAt = now;
            } else if (now - this._mouseEscapedAt >= C.TUNING.chaseAttackResumeDelay) {
              // Waited long enough, resume chasing now
              this._chaseSitting = false;
              this._chaseRunStart = now;
              this._mouseEscapedAt = null;
            }
          } else {
            this._mouseEscapedAt = null;
            // In attacking + sitting on cursor — schedule countdown
            if (action === 'attacking' && !this._countdownActive && !this._countdownStartTimer) {
              this._countdownStartTimer = setTimeout(() => {
                if (this._chaseSitting && this.currentAction === 'attacking') {
                  this._startCountdown();
                }
              }, C.TUNING.attackCountdownDelay);
            }
          }
        } else if (this._chaseSitting && now >= this._chaseSitUntil) {
          this._mouseEscapedAt = null;
          // Sit cooldown ended — resume chasing
          this._chaseSitting = false;
          this._chaseRunStart = now;
        } else if (dist > speed) {
          // Frustration: chasing too long without catching
          const chaseRunElapsed = now - (this._chaseRunStart || now);
          if (chaseRunElapsed > C.TUNING.chaseFrustrationTime) {
            // Stop, show hiss, sit 3-5s, then resume
            this._chaseSitting = true;
            const sitDuration = C.TUNING.chaseSitMin +
              Math.random() * (C.TUNING.chaseSitMax - C.TUNING.chaseSitMin);
            this._chaseSitUntil = now + sitDuration;
            this.setSprite('hiss');
            this.showBubble(this.pick(C.MESSAGES.angry));
          } else {
            // Chase — walk toward cursor at gradual speed
            this.catX += (dx / dist) * speed;
            this.catY += (dy / dist) * speed;

            if (Math.abs(dx) >= Math.abs(dy)) {
              this.setSprite(dx > 0 ? 'walk-right' : 'walk-left');
            } else {
              this.setSprite(dy > 0 ? 'walk-down' : 'walk-up');
            }
          }
        } else {
          // Caught the cursor — snap center onto it
          this.catX = this.mouseX - C.DW / 2;
          this.catY = this.mouseY - C.DH / 2;

          if (!this._chaseSitting) {
            this._chaseSitting = true;
            const sitDuration = C.TUNING.chaseSitMin +
              Math.random() * (C.TUNING.chaseSitMax - C.TUNING.chaseSitMin);
            this._chaseSitUntil = now + sitDuration;
            this.setSprite(this._chaseSitSprite);
          }
        }

        this.updatePosition();

        // Report position to background periodically
        if (now - this._lastPosReport > C.TUNING.chasePosReportInterval) {
          this._lastPosReport = now;
          chrome.runtime.sendMessage({ type: 'updatePos', catX: this.catX, catY: this.catY });
        }

        this.frameId = requestAnimationFrame(() => this._chaseLoop());
      };

      // ── Attack countdown ──
      proto._startCountdown = function () {
        if (this._countdownActive) return;
        this._countdownActive = true;
        this._countdownValue = C.TUNING.attackCountdownDuration;
        this._rageMessageShown = false;
        this.countdownEl.textContent = this._countdownValue;
        this.countdownEl.classList.remove('hiding');
        this.countdownEl.classList.add('active');

        this._countdownInterval = setInterval(() => {
          this._countdownValue--;
          if (this._countdownValue <= 0) {
            this._cancelCountdown();
            // Close the tab via background
            chrome.runtime.sendMessage({ type: 'closeTab' });
          } else {
            this.countdownEl.textContent = this._countdownValue;
            // Show rage quit message at second 3
            if (this._countdownValue === 3 && !this._rageMessageShown) {
              this._rageMessageShown = true;
              this.showBubble(this.pick(C.MESSAGES.rageQuit));
            }
          }
        }, 1000);
      };

      proto._cancelCountdown = function () {
        clearTimeout(this._countdownStartTimer);
        this._countdownStartTimer = null;
        if (!this._countdownActive) return;
        this._countdownActive = false;
        clearInterval(this._countdownInterval);
        this.countdownEl.classList.add('hiding');
        setTimeout(() => {
          this.countdownEl.classList.remove('active', 'hiding');
        }, 300);
      };

      // ── Clear global chase timer when cat is satisfied ──
      const origExit = proto.exit_happy;
      proto.exit_happy = function () {
        this._chaseGlobalStart = null;
        this._cancelCountdown();
        if (origExit) origExit.call(this);
      };

      // ── Register all 3 escalation states ──
      makeChaseState('needy',     C.TUNING.chaseNeedyMult,  'meow', C.MESSAGES.needy);
      makeChaseState('hissing',   C.TUNING.chaseHissMult,   'hiss', C.MESSAGES.angry);
      makeChaseState('attacking', C.TUNING.chaseAttackMult, 'paw',  C.MESSAGES.attack);

    }
  });
})();
