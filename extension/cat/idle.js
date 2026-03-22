(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'idle',
    apply(proto) {

      proto.enterIdle = function () {
        this.clearState();
        this.state = 'idle';
        this.catEl.classList.remove('purring');
        this.setSprite(Math.random() < 0.5 ? 'rest' : 'sit');

        const delay = 2000 + Math.random() * 4000;
        this.stateTimer = setTimeout(() => this.pickActivity(), delay);

        if (Math.random() < 0.3) {
          setTimeout(() => this.showBubble(this.pick(C.MESSAGES.idle)), 500);
        }
      };

      proto.pickActivity = function () {
        if (this.state !== 'idle') return;

        const activities = ['walk', 'walk', 'walk', 'eat', 'wash', 'yawn', 'sleep', 'itch', 'sit'];
        const choice = activities[Math.floor(Math.random() * activities.length)];

        switch (choice) {
          case 'walk': this.startWalking(); break;
          case 'sit':  this.doActivity('sit', 1); break;
          default:     this.doActivity(choice, choice === 'sleep' ? 4 : 2); break;
        }
      };

    }
  });
})();
