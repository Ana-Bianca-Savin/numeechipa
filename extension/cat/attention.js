(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'attention',
    apply(proto) {

      proto.enter_needy = function () {
        this.showBubble(this.pick(C.MESSAGES.needy));
      };

      proto.enter_hissing = function () {
        this.showBubble(this.pick(C.MESSAGES.angry));
      };

      proto.enter_attacking = function (state) {
        if (state.catX != null) {
          this.catX = Math.max(0, Math.min(window.innerWidth - C.DW, state.catX));
        }
        this.catY = window.innerHeight - C.DH;
        this.updatePosition();

        this.overlay.classList.add('active');
        this.showBubble(this.pick(C.MESSAGES.attack));
        this.attackLoop();
      };

      proto.exit_attacking = function () {
        this.overlay.classList.remove('active');
        if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      };

      proto.attackLoop = function () {
        if (this.currentAction !== 'attacking') return;

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
