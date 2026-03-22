(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'petting',
    apply(proto) {

      proto.onPet = function () {
        if (this.currentAction === 'happy') return;

        this.spawnHeart();
        this.showBubble(this.pick(C.MESSAGES.happy));

        // Tell background to handle state change
        chrome.runtime.sendMessage({ type: 'pet' });
      };

      proto.enter_happy = function () {
        this.catEl.classList.add('purring');
        this.showBubble('Prrrrr~ \u2665');
        for (let i = 0; i < 5; i++) setTimeout(() => this.spawnHeart(), i * 200);
      };

      proto.exit_happy = function () {
        this.catEl.classList.remove('purring');
        this.catY = window.innerHeight - C.DH;
        this.catX = Math.max(0, Math.min(window.innerWidth - C.DW, this.catX));
        this.updatePosition();
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
