(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'activities',
    apply(proto) {

      proto.enter_activity = function (state) {
        if (state.sprite === 'sleep' && Math.random() < 0.5) {
          setTimeout(() => this.showBubble(this.pick(C.MESSAGES.sleep)), 800);
        }
      };

    }
  });
})();
