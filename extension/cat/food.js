(function () {
  'use strict';

  const C = window.CAT;
  if (!C) return;

  C.behaviors.push({
    name: 'food',
    apply(proto) {
      // 1. All your logic (constructor, scheduleFood, spawnFood, etc.) 
      // MUST be inside this apply(proto) { ... } block.
      
      const oldConstructor = proto.constructor;
      proto.constructor = function() {
        oldConstructor.apply(this, arguments);
        this.foodEl = null;
        this.foodX = 0;
        this.foodTimer = null;
        this.scheduleFood(5000); 
      };

      proto.scheduleFood = function(delay) {
        if (this.foodTimer) clearTimeout(this.foodTimer);
        const d = delay || (30 + Math.random() * 60) * 1000;
        this.foodTimer = setTimeout(() => this.spawnFood(), d);
      };

      proto.spawnFood = function() {
        if (this.foodEl || this.currentAction === 'sleeping') {
          this.scheduleFood();
          return;
        }
        
        // Ensure FISH_TYPES exists in config.js
        if (!C.FISH_TYPES) return;

        const randomFish = C.FISH_TYPES[Math.floor(Math.random() * C.FISH_TYPES.length)];
        this.foodEl = document.createElement('div');
        this.foodX = Math.random() * (window.innerWidth - 50);
        
        Object.assign(this.foodEl.style, {
          position: 'fixed',
          left: this.foodX + 'px',
          bottom: '20px',
          width: '40px',
          height: '40px',
          backgroundImage: `url('${randomFish.url}')`,
          backgroundSize: 'contain',
          imageRendering: 'pixelated',
          zIndex: '2147483647'
        });
        document.body.appendChild(this.foodEl);

        this.setState('walking', { walkTargetX: this.foodX, walkTargetY: window.innerHeight - C.DH });
      };

      proto.checkFoodCollision = function() {
        if (!this.foodEl) return false;
        if (Math.abs(this.catX - this.foodX) < 20 && this.currentAction !== 'eating') {
          this.startEating();
          return true;
        }
        return false;
      };

      proto.startEating = function() {
        this.setState('eating');
        if (this.playMeow) this.playMeow();
        setTimeout(() => {
          if (this.foodEl) { this.foodEl.remove(); this.foodEl = null; }
          this.setState('idle');
          this.scheduleFood();
        }, 3000);
      };
    }
  });
})();

// Spawn fish from console
window.spawnTestFish = function() {
    const catInstance = document.querySelector('#browser-cat-host');
    if (catInstance) {
        console.log("Force spawning fish...");
        // This assumes your instance is accessible. 
        // If not, just use this simple test:
        const test = document.createElement('div');
        test.style.cssText = "position:fixed;top:50px;left:50px;width:50px;height:50px;background:red;z-index:999999;";
        test.innerText = "FISH TEST";
        document.body.appendChild(test);
    }
};