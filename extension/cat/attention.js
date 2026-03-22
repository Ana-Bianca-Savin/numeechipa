(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'attention',
    apply(proto) {

      proto.scheduleAttention = function () {
        this.clearAttention();
        const delay = this.attentionMinDelay +
          Math.random() * (this.attentionMaxDelay - this.attentionMinDelay);
        this.attentionTimer = setTimeout(() => this.needAttention(), delay);
      };

      proto.needAttention = function () {
        if (this.state === 'needy' || this.state === 'hissing' ||
            this.state === 'attacking' || this.state === 'happy') return;

        this.clearState();
        this.clearAttention();
        this.state = 'needy';
        this.petCount = 0;
        this.setSprite('meow');
        this.showBubble(this.pick(C.MESSAGES.needy));
        console.log('[BrowserCat] Needs attention!');

        this.patienceTimer = setTimeout(() => this.startHissing(), this.patienceDelay);
      };

      proto.startHissing = function () {
        if (this.state !== 'needy') return;
        this.state = 'hissing';
        this.setSprite('hiss');
        this.showBubble(this.pick(C.MESSAGES.angry));
        console.log('[BrowserCat] Hissing!');

        this.patienceTimer = setTimeout(() => this.startAttacking(), this.patienceDelay);
      };

      proto.startAttacking = function () {
        if (this.state !== 'hissing') return;
        this.state = 'attacking';
        this.setSprite('paw');
        this.overlay.classList.add('active');
        this.showBubble(this.pick(C.MESSAGES.attack));
        console.log('[BrowserCat] Attacking cursor!');
        this.attack();
      };

      proto.attack = function () {
        if (this.state !== 'attacking') return;

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
        this.frameId = requestAnimationFrame(() => this.attack());
      };

    }
  });
})();
