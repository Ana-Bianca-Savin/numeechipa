(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'activities',
    apply(proto) {

      proto.doActivity = function (spriteName, loops) {
        this.clearState();
        this.state = 'activity';
        this.setSprite(spriteName);

        if (spriteName === 'sleep' && Math.random() < 0.5) {
          setTimeout(() => this.showBubble(this.pick(C.MESSAGES.sleep)), 800);
        }

        const s = C.SPRITES[spriteName];
        const duration = s.frames * s.speed * loops * 1000;
        this.stateTimer = setTimeout(() => this.enterIdle(), duration);
      };

    }
  });
})();
