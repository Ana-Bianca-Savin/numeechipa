(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'idle',
    apply(proto) {

      proto.enter_idle = function () {
        if (Math.random() < 0.3) {
          setTimeout(() => this.showBubble(this.pick(C.MESSAGES.idle)), 500);
        }
      };

    }
  });
})();
