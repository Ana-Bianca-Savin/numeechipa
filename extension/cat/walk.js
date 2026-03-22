(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'walk',
    apply(proto) {

      proto.enter_walking = function () {
        this.walkSpeed = 1.5 + Math.random() * 1.5;
        const margin = C.DW;
        this.targetX = margin + Math.random() * (window.innerWidth - margin * 2);
        const dir = this.targetX > this.catX ? 'walk-right' : 'walk-left';
        this.setSprite(dir);
        this.walkLoop();
      };

      proto.exit_walking = function () {
        if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      };

      proto.walkLoop = function () {
        if (this.currentAction !== 'walking') return;

        const dx = this.targetX - this.catX;
        if (Math.abs(dx) < 4) {
          chrome.runtime.sendMessage({ type: 'walkDone' });
          return;
        }

        this.catX += Math.sign(dx) * this.walkSpeed;
        this.updatePosition();
        this.frameId = requestAnimationFrame(() => this.walkLoop());
      };

    }
  });
})();
