(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'keyboard67',
    apply(proto) {

      proto.initKeyboard = function () {
        this.is67Active = false;
        this.savedSprite = null;
        this.keyTimeout = null;

        document.addEventListener('keydown', (e) => this.onKeyPress(e));
      };

      proto.onKeyPress = function (e) {
        // Block only attacking state (cursor-following)
        if (this.currentAction === 'attacking') return;

        if (e.key === '6') {
          this.trigger67Animation('67');
        } else if (e.key === '7') {
          this.trigger67Animation('67-mirrored');
        }
      };

      proto.trigger67Animation = function (spriteName) {
        // Save current sprite if not already in 67 mode
        if (!this.is67Active) {
          this.savedSprite = this.sprite.className;
          // Pause walking if active
          if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
          }
        }

        this.is67Active = true;
        this.setSprite(spriteName);
        this.showBubble('67');

        // Clear any existing timeout
        clearTimeout(this.keyTimeout);

        // Return to normal after 1.5 seconds of no key press
        this.keyTimeout = setTimeout(() => {
          this.is67Active = false;
          if (this.savedSprite) {
            this.sprite.className = this.savedSprite;
            this.savedSprite = null;
          }
          this.hideBubble();
          // Resume walking if that was the state
          if (this.currentAction === 'walking' && this.walkLoop) {
            this.walkLoop();
          }
        }, 1500);
      };

    }
  });
})();
