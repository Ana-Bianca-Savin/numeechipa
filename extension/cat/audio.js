(function () {
  const C = window.CAT;
  if (!C) return;

  // Track if user has interacted with page (required for autoplay)
  let audioUnlocked = false;

  // Audio file URLs
  const AUDIO_FILES = {
    miau: 'audio/miau.ogg',
    hiss: 'audio/hiss.ogg',
    purr: 'audio/purr.ogg',
    attack: 'audio/attack.ogg',
    '67': 'audio/67.ogg',
    goodbye: 'audio/goodbye.ogg',
    hey: 'audio/hey.ogg',
    imout: 'audio/imout.ogg',
    mrr: 'audio/mrr.ogg',
    petmenow: 'audio/petmenow.ogg',
    ragequit: 'audio/ragequit.ogg',
    youhadyourchance: 'audio/youhadyourchance.ogg',
    snore: 'audio/snore.ogg',
    acum: 'audio/acum.ogg',
    petme: 'audio/petme.ogg',
    byeforever: 'audio/byeforever.ogg',
  };

  // Cache for audio elements
  const audioCache = {};

  // Get or create audio element
  function getAudio(name) {
    if (!audioCache[name] && AUDIO_FILES[name]) {
      audioCache[name] = new Audio(chrome.runtime.getURL(AUDIO_FILES[name]));
      audioCache[name].volume = 0.5;
    }
    return audioCache[name];
  }

  // Message to sound mapping (must match config.js MESSAGES exactly)
  const MESSAGE_SOUNDS = {
    // idle
    'mrrp?': 'mrr',
    'prr...': 'purr',

    // walk
    'mrrp': 'mrr',

    // sit
    '*purr*': 'purr',
    'prr~': 'purr',

    // sleep
    'zzz...': 'snore',
    '*snore*': 'snore',
    'z..z..': 'snore',
    'zzZZzz...': 'snore',

    // needy
    'meow!': 'miau',
    'mew!': 'miau',
    'miau!': 'miau',
    'mrrow?': 'mrr',
    'mew mew!': 'miau',
    'prr?': 'purr',

    // angry
    'MEOW!!': 'miau',
    'MRRROW!!': 'miau',
    '*hisss*': 'hiss',
    'MIAU!': 'miau',
    'MEW!!': 'miau',
    '*growl*': 'hiss',
    'HSSS!': 'hiss',

    // attack
    '*SCRATCH*': 'attack',
    'MIAU!!!': 'miau',
    '*CHOMP*': 'attack',
    '*BITE*': 'attack',
    'HSSS!!': 'hiss',
    'MRRROW!!!': 'miau',

    // rageQuit
    '*HISS*': 'hiss',
    '*ANGRY MEOW*': 'miau',
    '*door slam*': 'ragequit',

    // happy
    'prrr~': 'purr',
    '\u2665': 'purr',
    'mrrr~': 'mrr',
    ':3': 'purr',
    '*purr purr*': 'purr',
    '*nuzzle*': 'purr',
    '*headbutt*': 'mrr',
    'prrrr~': 'purr',

    // 67 keyboard trigger
    '67!': '67',
  };

  // Sounds that should not restart if already playing
  const NO_RESTART_SOUNDS = ['67'];

  // Unlock audio on first user interaction
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  }

  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  C.behaviors.push({
    name: 'audio',
    apply(proto) {

      proto._hissTimeout = null;

      proto.playSound = function (soundName) {
        if (!audioUnlocked) return;

        const sound = getAudio(soundName);
        if (sound) {
          // Don't restart certain sounds if already playing
          if (NO_RESTART_SOUNDS.includes(soundName) && !sound.paused) {
            return;
          }
          sound.currentTime = 0;
          sound.play().catch(() => {});
        }
      };

      // Hook into setSprite to detect hiss animation
      const origSetSprite = proto.setSprite;
      proto.setSprite = function (name, animStart, spriteFrame) {
        if (origSetSprite) origSetSprite.call(this, name, animStart, spriteFrame);

        // Clear any pending hiss sound
        clearTimeout(this._hissTimeout);

        // If hiss sprite, schedule hiss sound (will be cancelled if text appears)
        if (name === 'hiss') {
          this._hissTimeout = setTimeout(() => {
            this.playSound('hiss');
          }, 100);
        }
      };

      // Hook into showBubble to play sounds based on message
      const origShowBubble = proto.showBubble;
      proto.showBubble = function (text) {
        if (origShowBubble) origShowBubble.call(this, text);

        // Cancel pending hiss sound if text appears
        clearTimeout(this._hissTimeout);

        // Check if this message has a sound
        const soundName = MESSAGE_SOUNDS[text];
        if (soundName) {
          this.playSound(soundName);
        }
      };

    }
  });
})();
