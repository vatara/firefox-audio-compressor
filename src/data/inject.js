'use strict';

// for legacy browsers
const AudioContext = window.AudioContext || window.webkitAudioContext;

var prefs = {
  sites: {
    'default': { enabled: false, threshold: -24, knee: 30, ratio: 12, attack: .003, release: .25, boost: 0 }
  }
};
var settings = prefs.sites.default;
var parameterChangeDuration = .3;

var logPrefix = "Audio Compressor: ";

//console.log(logPrefix + 'injecting compressor');

var audio;
function adjustSource(target, settings) {
  audio = target;

  /*
  document.querySelectorAll('video, audio').forEach((e) => {
    e.crossOrigin = 'anonymous';
  });
  */

  if (typeof (target.attached) === "undefined") {
    target.attached = false;
  }

  if (!target.attached && settings.enabled) {
    if (!target.initialized) {
      console.log(logPrefix + 'creating compressor', settings);

      //target.crossOrigin = 'anonymous';

      target.context = new AudioContext();
      target.source = target.context.createMediaElementSource(target);
      target.compressor = target.context.createDynamicsCompressor();
      target.boost = target.context.createGain();
      target.initialized = true;
    }

    try {
      target.source.disconnect();
    }
    catch (e) {
      console.log(logPrefix + "caught error disconnecting source", e);
    }

    target.source.connect(target.compressor);
    target.compressor.connect(target.boost);
    target.boost.connect(target.context.destination);

    applySettings();
    target.attached = true;
  }
  else if (target.attached && !settings.enabled) {
    console.log(logPrefix + 'disabling compressor');

    target.source.disconnect(target.compressor);
    target.compressor.disconnect(target.boost);
    target.boost.disconnect(target.context.destination);
    target.source.connect(target.context.destination);
    target.attached = false;
  }
  else if (target.attached && settings.enabled) {
    applySettings();
  }

  function applySettings() {
    for (var s in settings) {
      var value = settings[s];

      if (s == 'enabled') {

      }
      else if (s == 'boost') {
        try {
          target.boost.gain.exponentialRampToValueAtTime(value * 4 + 1, parameterChangeDuration);
        }
        catch (e) {
          console.log(logPrefix + 'error setting gain', e);
          target.boost.gain.value = value * 4 + 1;
        }
      }
      else {
        try {
          if (value == 0) {
            value = .01;
          }

          if (s == 'threshold') {
            target.compressor[s].linearRampToValueAtTime(value, parameterChangeDuration);
          }
          else {
            target.compressor[s].exponentialRampToValueAtTime(value, parameterChangeDuration);
          }
        }
        catch (e) {
          console.log(logPrefix + 'error setting ' + s, e);
          target.compressor[s].value = value;
        }
      }
    }
  }

  browser.runtime.sendMessage({ active: target.attached == true });
}

function getBestSiteMatch() {
  var bestSiteMatch = 'default';
  var maxLength = 0;
  for (var s in prefs.sites) {
    if (s == 'default') {
      continue;
    }
    if (document.location.href.startsWith(s) && s.length > maxLength) {
      bestSiteMatch = s;
      maxLength = s.length
    }
  }

  return bestSiteMatch;
}

var update = (target) => {
  if (target == null) {
    target = audio;
  }

  settings = prefs.sites[getBestSiteMatch()];
  adjustSource(target, settings);
};

chrome.storage.local.get(prefs, results => {
  Object.assign(prefs, results);
  update();
});

chrome.storage.onChanged.addListener(changes => {
  if (changes.sites) {
    prefs.sites = changes.sites.newValue;
    update();
  }
});

window.addEventListener('playing', ({ target }) => {
  update(target, settings);
}, true);

window.addEventListener('canplay', ({ target }) => {
  update(target, settings);
}, true);

const play = Audio.prototype.play;
Audio.prototype.play = function () {
  try {
    update(this, settings);
  }
  catch (e) { console.log(logPrefix, e) }
  return play.apply(this, arguments);
};

browser.runtime.onMessage.addListener(() => {
  var active = false;
  if (audio != null) {
    active = audio.attached == true;
  }
  return Promise.resolve({ active: active });
});