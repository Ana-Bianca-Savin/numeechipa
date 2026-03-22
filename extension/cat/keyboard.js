(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'keyboard67',
    apply(proto) {

      proto.initKeyboard = function () {
        this._67active = false;
        this._67timeout = null;
        this._67savedAction = null;

        document.addEventListener('keydown', (e) => {
          const a = this.currentAction;
          if (a === 'needy' || a === 'hissing' || a === 'attacking') return;

          if (e.key === '6') {
            this._trigger67('67');
          } else if (e.key === '7') {
            this._trigger67('67-mirrored');
          }
        });
      };

      proto._trigger67 = function (spriteName) {
        if (!this._67active) {
          this._67savedAction = this.currentAction;
          // Pause current animation frame loop
          if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
          }
        }

        this._67active = true;
        this.setSprite(spriteName);
        this.showBubble('67!');

        clearTimeout(this._67timeout);

        // Return to normal after 1.5s of no key press
        this._67timeout = setTimeout(() => {
          this._67active = false;
          this.hideBubble();

          // Resume the animation loop for the current state
          const action = this._67savedAction;
          this._67savedAction = null;

          if (action === 'walking') {
            this.walkLoop();
          } else if (action === 'needy' || action === 'hissing' || action === 'attacking') {
            this._chaseLoop();
          } else {
            // Re-apply current state sprite
            chrome.storage.local.get(['catState'], (data) => {
              if (data.catState) {
                this.setSprite(data.catState.sprite, data.catState.animStart, data.catState.spriteFrame);
              }
            });
          }
        }, 1500);
      };

    }
  });
})();
