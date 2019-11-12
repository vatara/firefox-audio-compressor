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

console.log('injecting compressor');

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
      console.log('creating compressor', settings.enabled);

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
      console.log("Caught error disconnecting source", e);
    }

    target.source.connect(target.compressor);
    target.compressor.connect(target.boost);
    target.boost.connect(target.context.destination);

    applySettings();
    target.attached = true;
  }
  else if (target.attached && !settings.enabled) {
    console.log('disabling compressor');

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
          target.boost.gain.exponentialRampToValueAtTime(value * 4 + 1, target.currentTime + parameterChangeDuration);
        }
        catch (e) {
          console.log('Error setting gain', e);
          target.boost.gain.value = value * 4 + 1;
        }
      }
      else {
        try {
          if (value == 0) {
            value = .01;
          }

          if (s == 'threshold') {
            target.compressor[s].linearRampToValueAtTime(value, target.currentTime + parameterChangeDuration);
          }
          else {
            target.compressor[s].exponentialRampToValueAtTime(value, target.currentTime + parameterChangeDuration);
          }
        }
        catch (e) {
          console.log('Error setting ' + s, e);
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

var update = () => {
  settings = prefs.sites[getBestSiteMatch()];
  adjustSource(audio, settings);
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
  adjustSource(target, settings);
}, true);

window.addEventListener('canplay', ({ target }) => {
  adjustSource(target, settings);
}, true);

const play = Audio.prototype.play;
Audio.prototype.play = function () {
  try {
    adjustSource(this, settings);
  }
  catch (e) { console.log(e) }
  return play.apply(this, arguments);
};

browser.runtime.onMessage.addListener(() => {
  var active = false;
  if (audio != null) {
    active = audio.attached == true;
  }
  return Promise.resolve({ active: active });
});