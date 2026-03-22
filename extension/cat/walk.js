(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'walk',
    apply(proto) {

      proto.startWalking = function () {
        this.clearState();
        this.state = 'walking';
        this.walkSpeed = 1.5 + Math.random() * 1.5;

        const margin = C.DW;
        this.targetX = margin + Math.random() * (window.innerWidth - margin * 2);

        const dir = this.targetX > this.catX ? 'walk-right' : 'walk-left';
        this.setSprite(dir);
        this.walk();
      };

      proto.walk = function () {
        if (this.state !== 'walking') return;

        const dx = this.targetX - this.catX;
        if (Math.abs(dx) < 4) {
          this.enterIdle();
          return;
        }

        this.catX += Math.sign(dx) * this.walkSpeed;
        this.updatePosition();
        this.frameId = requestAnimationFrame(() => this.walk());
      };

    }
  });
})();
