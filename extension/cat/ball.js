(function () {
  const C = window.CAT;
  if (!C) return;

  const BALL_SIZE = 32;
  const FRICTION = 0.98;
  const MIN_SPEED = 0.1;

  C.behaviors.push({
    name: 'ball',
    apply(proto) {

      proto.initBall = function () {
        // Create ball element
        this.ballEl = document.createElement('div');
        this.ballEl.id = 'ball';
        this.ballEl.style.cssText = `
          position: fixed;
          width: ${BALL_SIZE}px;
          height: ${BALL_SIZE}px;
          background-image: url('${chrome.runtime.getURL('sprites/ball.png')}');
          background-size: contain;
          background-repeat: no-repeat;
          z-index: 2147483648;
          user-select: none;
          -webkit-user-select: none;
          image-rendering: pixelated;
          cursor: grab;
        `;

        // Start position
        this.ballX = window.innerWidth / 2;
        this.ballY = window.innerHeight - 100;

        // Velocity (starts stationary)
        this.ballVX = 0;
        this.ballVY = 0;

        // Dragging state
        this.isDraggingBall = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.updateBallPosition();
        document.body.appendChild(this.ballEl);

        // Ball drag events
        this.ballEl.addEventListener('mousedown', (e) => this.onBallMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onBallMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onBallMouseUp(e));

        // Touch support
        this.ballEl.addEventListener('touchstart', (e) => this.onBallTouchStart(e));
        document.addEventListener('touchmove', (e) => this.onBallTouchMove(e));
        document.addEventListener('touchend', (e) => this.onBallTouchEnd(e));

        // Start physics loop
        this.startBallPhysics();
      };

      proto.updateBallPosition = function () {
        this.ballEl.style.left = this.ballX + 'px';
        this.ballEl.style.top = this.ballY + 'px';
      };

      proto.onBallMouseDown = function (e) {
        e.preventDefault();
        this.isDraggingBall = true;
        this.ballEl.style.cursor = 'grabbing';
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        // Stop current velocity
        this.ballVX = 0;
        this.ballVY = 0;
      };

      proto.onBallMouseMove = function (e) {
        if (!this.isDraggingBall) return;

        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;

        // Track velocity based on movement
        this.ballVX = dx;
        this.ballVY = dy;

        // Move ball with cursor
        this.ballX += dx;
        this.ballY += dy;

        // Keep in bounds
        this.ballX = Math.max(0, Math.min(window.innerWidth - BALL_SIZE, this.ballX));
        this.ballY = Math.max(0, Math.min(window.innerHeight - BALL_SIZE, this.ballY));

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        this.updateBallPosition();
      };

      proto.onBallMouseUp = function () {
        if (!this.isDraggingBall) return;
        this.isDraggingBall = false;
        this.ballEl.style.cursor = 'grab';
        // Ball continues with current velocity
      };

      proto.onBallTouchStart = function (e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.isDraggingBall = true;
        this.lastMouseX = touch.clientX;
        this.lastMouseY = touch.clientY;
        this.ballVX = 0;
        this.ballVY = 0;
      };

      proto.onBallTouchMove = function (e) {
        if (!this.isDraggingBall) return;
        const touch = e.touches[0];

        const dx = touch.clientX - this.lastMouseX;
        const dy = touch.clientY - this.lastMouseY;

        this.ballVX = dx;
        this.ballVY = dy;

        this.ballX += dx;
        this.ballY += dy;

        this.ballX = Math.max(0, Math.min(window.innerWidth - BALL_SIZE, this.ballX));
        this.ballY = Math.max(0, Math.min(window.innerHeight - BALL_SIZE, this.ballY));

        this.lastMouseX = touch.clientX;
        this.lastMouseY = touch.clientY;

        this.updateBallPosition();
      };

      proto.onBallTouchEnd = function () {
        this.isDraggingBall = false;
      };

      proto.startBallPhysics = function () {
        if (this._ballPhysicsFrame) cancelAnimationFrame(this._ballPhysicsFrame);
        this._ballPhysicsFrame = requestAnimationFrame(() => this.ballPhysicsLoop());
      };

      proto.ballPhysicsLoop = function () {
        // Only apply physics when not dragging
        if (!this.isDraggingBall) {
          // Apply velocity
          this.ballX += this.ballVX;
          this.ballY += this.ballVY;

          // Bounce off left/right edges
          if (this.ballX <= 0) {
            this.ballX = 0;
            this.ballVX = Math.abs(this.ballVX) * 0.8;
          } else if (this.ballX >= window.innerWidth - BALL_SIZE) {
            this.ballX = window.innerWidth - BALL_SIZE;
            this.ballVX = -Math.abs(this.ballVX) * 0.8;
          }

          // Bounce off top/bottom edges
          if (this.ballY <= 0) {
            this.ballY = 0;
            this.ballVY = Math.abs(this.ballVY) * 0.8;
          } else if (this.ballY >= window.innerHeight - BALL_SIZE) {
            this.ballY = window.innerHeight - BALL_SIZE;
            this.ballVY = -Math.abs(this.ballVY) * 0.8;
          }

          // Apply friction
          this.ballVX *= FRICTION;
          this.ballVY *= FRICTION;

          // Stop if moving very slowly
          if (Math.abs(this.ballVX) < MIN_SPEED) this.ballVX = 0;
          if (Math.abs(this.ballVY) < MIN_SPEED) this.ballVY = 0;

          this.updateBallPosition();
        }

        this._ballPhysicsFrame = requestAnimationFrame(() => this.ballPhysicsLoop());
      };

      // Override idle to make cat follow ball
      const origEnterIdle = proto.enter_idle;
      proto.enter_idle = function (state) {
        if (origEnterIdle) origEnterIdle.call(this, state);
        this.startFollowingBall();
      };

      proto.startFollowingBall = function () {
        if (this._ballFollowFrame) cancelAnimationFrame(this._ballFollowFrame);
        this._ballFollowFrame = requestAnimationFrame(() => this.ballFollowLoop());
      };

      proto.ballFollowLoop = function () {
        const action = this.currentAction;
        // Don't follow ball during cursor states
        if (action === 'needy' || action === 'hissing' || action === 'attacking' || action === 'rageQuit') {
          return;
        }
        // Let normal walking/activity handle movement
        if (action === 'walking' || action === 'activity') {
          this._ballFollowFrame = requestAnimationFrame(() => this.ballFollowLoop());
          return;
        }

        // Calculate distance to ball
        const catCX = this.catX + C.DW / 2;
        const catCY = this.catY + C.DH / 2;
        const ballCX = this.ballX + BALL_SIZE / 2;
        const ballCY = this.ballY + BALL_SIZE / 2;
        const dx = ballCX - catCX;
        const dy = ballCY - catCY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // If close enough to ball, stay idle near ball
        if (dist < 40) {
          // Report position to background so cat stays here
          if (!this._lastBallPosReport || Date.now() - this._lastBallPosReport > 500) {
            this._lastBallPosReport = Date.now();
            chrome.runtime.sendMessage({ type: 'updatePos', catX: this.catX, catY: this.catY });
          }
          this._ballFollowFrame = requestAnimationFrame(() => this.ballFollowLoop());
          return;
        }

        // Move toward ball
        const speed = 2;
        if (dist > speed) {
          this.catX += (dx / dist) * speed;
          this.catY += (dy / dist) * speed;

          // Set walking sprite based on direction
          if (Math.abs(dx) >= Math.abs(dy)) {
            this.setSprite(dx > 0 ? 'walk-right' : 'walk-left');
          } else {
            this.setSprite(dy > 0 ? 'walk-down' : 'walk-up');
          }
        }

        // Keep cat in viewport
        this.catX = Math.max(0, Math.min(window.innerWidth - C.DW, this.catX));
        this.catY = Math.max(0, Math.min(window.innerHeight - C.DH, this.catY));
        this.updatePosition();

        // Report position while moving
        if (!this._lastBallPosReport || Date.now() - this._lastBallPosReport > 200) {
          this._lastBallPosReport = Date.now();
          chrome.runtime.sendMessage({ type: 'updatePos', catX: this.catX, catY: this.catY });
        }

        this._ballFollowFrame = requestAnimationFrame(() => this.ballFollowLoop());
      };

    }
  });
})();
