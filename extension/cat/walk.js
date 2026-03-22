(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'walk',
    apply(proto) {

      // Time-based 2D walking: all tabs compute the same position from the same params
      proto.enter_walking = function (state) {
        if (Math.random() < 0.4) {
          this.showBubble(this.pick(C.MESSAGES.walk));
        }
        this.walkStartX = state.startX != null ? state.startX : this.catX;
        this.walkStartY = state.startY != null ? state.startY : this.catY;
        this.walkTargetX = state.walkTargetX != null ? state.walkTargetX : this.catX;
        this.walkTargetY = state.walkTargetY != null ? state.walkTargetY : this.catY;
        this.walkSpeedPerSec = (state.walkSpeed || 2) * 60;
        this.walkAnimStart = state.animStart || Date.now();

        // Clamp targets to this tab's viewport
        this.walkTargetX = Math.max(C.DW, Math.min(window.innerWidth - C.DW, this.walkTargetX));
        this.walkTargetY = Math.max(C.DH, Math.min(window.innerHeight - C.DH, this.walkTargetY));

        // Pick sprite based on dominant direction
        const dx = this.walkTargetX - this.walkStartX;
        const dy = this.walkTargetY - this.walkStartY;
        let dir;
        if (Math.abs(dx) >= Math.abs(dy)) {
          dir = dx > 0 ? 'walk-right' : 'walk-left';
        } else {
          dir = dy > 0 ? 'walk-down' : 'walk-up';
        }
        this.setSprite(dir, state.animStart);

        // Compute current position (might be mid-walk if tab opened late)
        this.computeWalkPosition();
        this.updatePosition();
        this.walkLoop();
      };

      proto.exit_walking = function () {
        if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      };

      proto.computeWalkPosition = function () {
        const elapsed = (Date.now() - this.walkAnimStart) / 1000;
        const totalDX = this.walkTargetX - this.walkStartX;
        const totalDY = this.walkTargetY - this.walkStartY;
        const totalDist = Math.sqrt(totalDX * totalDX + totalDY * totalDY);
        const traveled = Math.min(this.walkSpeedPerSec * elapsed, totalDist);
        const ratio = totalDist > 0 ? traveled / totalDist : 1;
        this.catX = this.walkStartX + totalDX * ratio;
        this.catY = this.walkStartY + totalDY * ratio;
        return traveled >= totalDist;
      };

      proto.walkLoop = function () {
        if (this.currentAction !== 'walking') return;

        const done = this.computeWalkPosition();
        this.updatePosition();

        if (done) {
          chrome.runtime.sendMessage({ type: 'walkDone', catX: this.catX, catY: this.catY });
          return;
        }

        this.frameId = requestAnimationFrame(() => this.walkLoop());
      };

    }
  });
})();
