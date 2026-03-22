(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'petting',
    apply(proto) {

      proto.onPet = function () {
        if (this.currentAction === 'happy') return;

        // Debounce: prevent double pet from overlapping click handlers
        const now = Date.now();
        if (now - this.lastPetTime < C.TUNING.petDebounce) return;
        this.lastPetTime = now;

        this.spawnHeart();
        this.showBubble(this.pick(C.MESSAGES.happy));

        chrome.runtime.sendMessage({ type: 'pet', catX: this.catX, catY: this.catY });
      };

      proto.enter_happy = function () {
        this.catEl.classList.add('purring');
        this.showBubble('Prrrrr~ \u2665');
        for (let i = 0; i < C.TUNING.happyHeartCount; i++) {
          setTimeout(() => this.spawnHeart(), i * C.TUNING.happyHeartInterval);
        }
      };

      proto.exit_happy = function () {
        this.catEl.classList.remove('purring');
        this.catX = Math.max(0, Math.min(window.innerWidth - C.DW, this.catX));
        this.catY = Math.max(0, Math.min(window.innerHeight - C.DH, this.catY));
        this.updatePosition();
      };

      proto.spawnHeart = function () {
        const h = document.createElement('div');
        h.className = 'heart';
        h.textContent = '\u2764\uFE0F';
        h.style.left = (this.catX + Math.random() * C.DW) + 'px';
        h.style.top = (this.catY + C.TUNING.heartOffsetY) + 'px';
        this.shadow.appendChild(h);
        setTimeout(() => h.remove(), C.TUNING.heartDuration);
      };

    }
  });
})();
