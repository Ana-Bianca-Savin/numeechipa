(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'walk',
    apply(proto) {

      // Time-based walking: all tabs compute the same position from the same params
      proto.enter_walking = function (state) {
        this.walkStartX = state.startX != null ? state.startX : state.catX;
        this.walkTarget = state.walkTarget != null ? state.walkTarget : this.catX;
        this.walkSpeedPerSec = (state.walkSpeed || 2) * 60;
        this.walkAnimStart = state.animStart || Date.now();

        // Clamp target to this tab's viewport
        this.walkTarget = Math.max(C.DW, Math.min(window.innerWidth - C.DW, this.walkTarget));

        const dir = this.walkTarget > this.walkStartX ? 'walk-right' : 'walk-left';
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
        const totalDist = this.walkTarget - this.walkStartX;
        const dir = Math.sign(totalDist);
        const traveled = Math.min(this.walkSpeedPerSec * elapsed, Math.abs(totalDist));
        this.catX = this.walkStartX + dir * traveled;
        return traveled >= Math.abs(totalDist);
      };

      proto.walkLoop = function () {
        if (this.currentAction !== 'walking') return;

        const done = this.computeWalkPosition();
        this.updatePosition();

        if (done) {
          chrome.runtime.sendMessage({ type: 'walkDone', catX: this.catX });
          return;
        }

        this.frameId = requestAnimationFrame(() => this.walkLoop());
      };

    }
  });
})();
