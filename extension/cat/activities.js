(function () {
  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'activities',
    apply(proto) {

      proto.enter_activity = function (state) {
        const sprite = state.sprite;
        // Show a bubble for the activity
        const msgMap = {
          sleep: C.MESSAGES.sleep,
          eat:   C.MESSAGES.eat,
          wash:  C.MESSAGES.wash,
          yawn:  C.MESSAGES.yawn,
          itch:  C.MESSAGES.itch,
          sit:   C.MESSAGES.sit,
        };
        const msgs = msgMap[sprite];
        if (msgs) {
          setTimeout(() => this.showBubble(this.pick(msgs)), C.TUNING.sleepBubbleDelay);
        }
      };

    }
  });
})();
