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
    // idle: ['*sits*', '*looks around*', 'Mrrp?', '~', '*stretch*']
    'Mrrp?': 'mrr',

    // needy: ['Pet me!', 'Meow!', 'Hey!', 'Miau!', 'Notice me!', 'Mrrp?', 'Psst!']
    'Pet me!': 'petme',
    'Meow!': 'miau',
    'Hey!': 'hey',
    'Miau!': 'miau',

    // angry: ['PET ME!', 'MEOW!!', 'HEY!!', '*angry meow*', 'MIAU!', 'Acum!']
    'PET ME!': 'petme',
    'MEOW!!': 'miau',
    'HEY!!': 'hey',
    'Acum!': 'acum',

    // attack: ['*ATTACK*', 'MIAU!!!', '*paw paw*', 'PET. ME. NOW.']
    '*ATTACK*': 'attack',
    'MIAU!!!': 'miau',
    'PET. ME. NOW.': 'petmenow',

    // rageQuit: ['GOODBYE!', '*RAGE QUIT*', 'I\'m outta here!', 'Bye forever!', 'You had your chance!']
    'GOODBYE!': 'goodbye',
    '*RAGE QUIT*': 'ragequit',
    "I'm outta here!": 'imout',
    'Bye forever!': 'byeforever',
    'You had your chance!': 'youhadyourchance',

    // happy: ['Prrr~', '♥', 'Mrrr~', ':3']
    'Prrr~': 'purr',
    '\u2665': 'purr',
    'Mrrr~': 'mrr',
    ':3': 'purr',

    // sleep: ['zzz...', '*snore*', 'z..z..']
    'zzz...': 'snore',
    '*snore*': 'snore',
    'z..z..': 'snore',

    // 67 keyboard trigger
    '67!': '67',
  };

  const HISS_SPRITES = ['hiss'];

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

      proto.isHissing = false;

      proto.playSound = function (soundName) {
        if (!audioUnlocked) return;

        const sound = getAudio(soundName);
        if (sound) {
          sound.currentTime = 0;
          sound.play().catch(() => {});
        }
      };

      // Hook into setSprite for hiss animation (checked first)
      const origSetSprite = proto.setSprite;
      proto.setSprite = function (name, animStart) {
        if (origSetSprite) origSetSprite.call(this, name, animStart);

        if (HISS_SPRITES.includes(name)) {
          this.isHissing = true;
          this.playSound('hiss');
        } else {
          this.isHissing = false;
        }
      };

      // Hook into showBubble to play sounds based on message
      const origShowBubble = proto.showBubble;
      proto.showBubble = function (text) {
        if (origShowBubble) origShowBubble.call(this, text);

        // Skip message sounds if hiss animation is active
        if (this.isHissing) return;

        // Check if this message has a sound
        const soundName = MESSAGE_SOUNDS[text];
        if (soundName) {
          this.playSound(soundName);
        }
      };

    }
  });
})();
