(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'petting',
    apply(proto) {

      proto.onPet = function () {
        if (this.state === 'happy') return;

        this.totalPets++;
        this.saveStats();
        this.spawnHeart();

        if (this.state !== 'needy' && this.state !== 'hissing' && this.state !== 'attacking') {
          this.showBubble(this.pick(C.MESSAGES.happy));
          return;
        }

        this.petCount++;
        if (this.petCount >= this.petsNeeded) {
          this.satisfy();
        } else {
          this.showBubble(this.pick(C.MESSAGES.happy));
        }
      };

      proto.satisfy = function () {
        this.clearState();
        this.clearAttention();
        this.state = 'happy';

        this.overlay.classList.remove('active');
        this.setSprite('sleep');
        this.catEl.classList.add('purring');
        this.showBubble('Prrrrr~ \u2665');

        for (let i = 0; i < 5; i++) setTimeout(() => this.spawnHeart(), i * 200);

        this.stateTimer = setTimeout(() => {
          this.catY = window.innerHeight - C.DH;
          this.catX = Math.max(0, Math.min(window.innerWidth - C.DW, this.catX));
          this.updatePosition();
          this.catEl.classList.remove('purring');
          this.enterIdle();
          this.scheduleAttention();
        }, 2500);
      };

      proto.spawnHeart = function () {
        const h = document.createElement('div');
        h.className = 'heart';
        h.textContent = '\u2764\uFE0F';
        h.style.left = (this.catX + Math.random() * C.DW) + 'px';
        h.style.top = (this.catY - 10) + 'px';
        this.shadow.appendChild(h);
        setTimeout(() => h.remove(), 1000);
      };

    }
  });
})();
