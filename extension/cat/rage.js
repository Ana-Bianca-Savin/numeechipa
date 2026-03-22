(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'rage',
    apply(proto) {

      proto.enter_rageQuit = function () {
        this.overlay.classList.add('active');

        // Create a countdown overlay immediately
        let countdown = 5;
        let messageShown = false;
        const self = this;

        const countdownEl = document.createElement('div');
        countdownEl.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          color: #ff3333;
          font-size: 72px;
          font-weight: bold;
          font-family: Arial, sans-serif;
          padding: 40px 80px;
          border-radius: 20px;
          z-index: 2147483647;
          text-align: center;
          box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
        `;
        countdownEl.textContent = countdown;
        document.body.appendChild(countdownEl);

        // Store references for cleanup
        this.countdownEl = countdownEl;
        this.countdownInterval = setInterval(function() {
          countdown--;
          if (countdown > 0) {
            countdownEl.textContent = countdown;
            // Show message when countdown reaches 3
            if (countdown === 3 && !messageShown) {
              messageShown = true;
              self.showBubble(self.pick(C.MESSAGES.rageQuit));
            }
          } else {
            clearInterval(self.countdownInterval);
            // Send message to background to close the tab
            chrome.runtime.sendMessage({ type: 'closeTab' });
          }
        }, 1000);

        // Start attacking animation
        this.attackLoop();
      };

      proto.exit_rageQuit = function () {
        this.overlay.classList.remove('active');
        if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
        // Clean up countdown
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
        if (this.countdownEl) {
          this.countdownEl.remove();
          this.countdownEl = null;
        }
      };

      proto.attackLoop = function () {
        if (this.currentAction !== 'attacking' && this.currentAction !== 'rageQuit') return;

        const catCX = this.catX + C.DW / 2;
        const catCY = this.catY + C.DH / 2;
        const dx = this.mouseX - catCX;
        const dy = this.mouseY - catCY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
          this.catX += dx * 0.08;
          this.catY += dy * 0.08;
        }

        this.updatePosition();
        this.frameId = requestAnimationFrame(() => this.attackLoop());
      };

    }
  });
})();
