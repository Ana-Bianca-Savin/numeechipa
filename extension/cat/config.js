(function () {
  if (window !== window.top) return;

  const FW = 32;
  const FH = 32;
  const SCALE = 3;
  const DW = FW * SCALE;
  const DH = FH * SCALE;

  const SPRITES = {
    rest:         { frames: 6,  speed: 0.4  },
    sit:          { frames: 6,  speed: 0.35 },
    'walk-right': { frames: 8,  speed: 0.14 },
    'walk-left':  { frames: 8,  speed: 0.14 },
    'walk-down':  { frames: 4,  speed: 0.2  },
    'walk-up':    { frames: 4,  speed: 0.2  },
    sleep:        { frames: 2,  speed: 0.8  },
    eat:          { frames: 8,  speed: 0.25 },
    meow:         { frames: 3,  speed: 0.2  },
    yawn:         { frames: 8,  speed: 0.25 },
    wash:         { frames: 9,  speed: 0.2  },
    itch:         { frames: 11, speed: 0.17 },
    hiss:         { frames: 2,  speed: 0.2  },
    paw:          { frames: 9,  speed: 0.08 },
    '67':         { frames: 2,  speed: 0.3 },
    '67-mirrored': { frames: 2,  speed: 0.3 },
  };

  for (const [name, s] of Object.entries(SPRITES)) {
    s.url = chrome.runtime.getURL(`sprites/${name}.png`);
  }

  // ── CSS generation ─────────────────────────────────────────────────
  let spriteCSS = '';
  for (const [name, s] of Object.entries(SPRITES)) {
    spriteCSS += `
      @keyframes anim-${name} {
        from { background-position: 0 0; }
        to   { background-position: -${s.frames * DW}px 0; }
      }
      .sprite-${name} {
        background-image: url('${s.url}');
        background-size: ${s.frames * DW}px ${DH}px;
        animation: anim-${name} ${s.frames * s.speed}s steps(${s.frames}) infinite;
      }
    `;
  }

  const STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    #overlay {
      display: none;
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      z-index: 2147483646;
      pointer-events: auto;
      cursor: none;
    }
    #overlay.active { display: block; }

    #cat {
      position: fixed;
      z-index: 2147483647;
      pointer-events: auto;
      cursor: pointer;
      width: ${DW}px;
      height: ${DH}px;
      user-select: none;
      -webkit-user-select: none;
    }

    .sprite {
      width: ${DW}px;
      height: ${DH}px;
      background-repeat: no-repeat;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }

    ${spriteCSS}

    #bubble {
      position: absolute;
      top: -28px;
      left: 50%;
      transform: translateX(-50%) scale(0);
      background: white;
      color: #333;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #bubble.show { transform: translateX(-50%) scale(1); }
    #bubble::after {
      content: '';
      position: absolute;
      bottom: -6px; left: 50%;
      transform: translateX(-50%);
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid white;
    }

    .heart {
      position: fixed;
      font-size: 18px;
      pointer-events: none;
      animation: float-up 1s ease-out forwards;
      z-index: 2147483647;
    }
    @keyframes float-up {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-60px) scale(1.5); }
    }

    #cat.purring .sprite {
      animation-name: purr-shake !important;
      animation-duration: 0.12s !important;
      animation-timing-function: linear !important;
      animation-iteration-count: infinite !important;
    }
    @keyframes purr-shake {
      0%, 100% { transform: translateX(0); }
      25%      { transform: translateX(-2px); }
      75%      { transform: translateX(2px); }
    }
  `;

  // ── Messages ───────────────────────────────────────────────────────
  const MESSAGES = {
    idle:   ['*sits*', '*looks around*', 'Mrrp?', '~', '*stretch*'],
    needy:  ['Pet me!', 'Meow!', 'Hey!', 'Miau!', 'Notice me!', 'Mrrp?', 'Psst!'],
    angry:  ['PET ME!', 'MEOW!!', 'HEY!!', '*angry meow*', 'MIAU!', 'Acum!'],
    attack: ['*ATTACK*', 'MIAU!!!', '*paw paw*', 'PET. ME. NOW.'],
    rageQuit: ['GOODBYE!', '*RAGE QUIT*', 'I\'m outta here!', 'Bye forever!', 'You had your chance!'],
    happy:  ['Prrr~', '\u2665', 'Mrrr~', ':3'],
    sleep:  ['zzz...', '*snore*', 'z..z..'],
  };

  // ── Tuning constants (content-side) ────────────────────────────────
  const TUNING = {
    // ── Bubbles ──
    bubbleDuration: 3000,           // how long speech bubbles stay visible (ms)

    // ── Idle ──
    idleBubbleChance: 0.3,          // probability of showing a bubble in idle
    idleBubbleDelay: 500,           // delay before idle bubble appears (ms)

    // ── Activities ──
    sleepBubbleChance: 0.5,         // probability of showing sleep bubble
    sleepBubbleDelay: 800,          // delay before sleep bubble appears (ms)

    // ── Chase (gradual speed ramp) ──
    chaseBaseSpeed: 1.0,            // starting speed (px/frame)
    chaseSpeedRamp: 0.05,           // speed increase per second of attention
    chaseMaxSpeed: 6,               // speed cap (px/frame)
    chaseNeedyMult: 1.0,            // speed multiplier in needy state
    chaseHissMult: 1.6,             // speed multiplier in hissing state
    chaseAttackMult: 2.2,           // speed multiplier in attacking state
    chaseFrustrationTime: 7000,     // chase this long without catching → frustration pause (ms)
    chaseSitMin: 3000,              // min sit duration after catch or frustration (ms)
    chaseSitMax: 5000,              // max sit duration (ms)
    chaseAttackResumeDelay: 600,    // in attacking: resume chase this fast after mouse escapes (ms)
    chasePosReportInterval: 500,    // how often to sync position to background (ms)

    // ── Petting ──
    petDebounce: 100,               // min time between pet registrations (ms)
    happyHeartCount: 5,             // hearts spawned when cat becomes happy
    happyHeartInterval: 200,        // delay between heart spawns (ms)
    heartDuration: 1000,            // how long hearts float before removal (ms)
    heartOffsetY: -10,              // vertical offset for heart spawn position (px)
  };

  // ── Export ─────────────────────────────────────────────────────────
  window.CAT = {
    FW, FH, SCALE, DW, DH,
    SPRITES, STYLES, MESSAGES, TUNING,
    behaviors: [],
  };
})();
