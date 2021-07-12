'use strict';

// for legacy browsers
//const AudioContext = window.AudioContext || window.webkitAudioContext;

var prefs = {
  sites: {
    'default': { enabled: false, threshold: -24, knee: 30, ratio: 12, attack: .003, release: .25, boost: 0 }
  }
  //disableForCrossSiteElements: false
};
var settings = prefs.sites.default;
var parameterChangeDuration = .1;

var logPrefix = 'Audio Compressor: ';

//console.log(logPrefix + 'injecting compressor');

window.audioCompressor = {};

function adjustSource(target, settings) {
  /*
  document.querySelectorAll('video, audio').forEach((e) => {
    e.crossOrigin = 'anonymous';
  });
  */

  if (typeof target === 'undefined') {
    return;
  }

  window.audioCompressor.target = target;

  if (typeof (target.attached) === 'undefined') {
    target.attached = false;
  }

  if (!target.attached && settings.enabled) {
    /*
    var targetURL;
    try {
      targetURL = new URL(target.currentSrc);
    }
    catch (e) {}

    // not as simple as checking the url host
    // videos can have a source like: blob:twitch.tv/ajhakjdshakhdsj
    if (prefs.disableForCrossSiteElements && 
        targetURL != null && 
        window.location.host != targetURL.host) {
      console.log(logPrefix + ' cross-origin source, not enabling', target);
      return;
    }
    */

    if (!target.initialized) {
        console.log(logPrefix + 'creating compressor', settings);
        //console.log(logPrefix + 'creating compressor', settings, target);

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
      console.log(logPrefix + 'caught error disconnecting source', e);
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
          if (s == 'knee' || s == 'attack' || s == 'release') {
            if (value <= 0) {
              value = .001;
            }
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

  if (typeof browser === 'undefined') {
    window.browser = chrome;
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
    if (typeof audioCompressor !== 'undefined') {
      target = audioCompressor.target;
    }
  }

  settings = prefs.sites[getBestSiteMatch()];
  adjustSource(target, settings);
};

chrome.storage.local.get(prefs, results => {
  Object.assign(prefs, results);
  update();
});

chrome.storage.onChanged.addListener(changes => {
  /*
  if (changes.disableForCrossSiteElements) {
    prefs.disableForCrossSiteElements = changes.disableForCrossSiteElements.newValue == true;
  }
  */
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

if (typeof play === 'undefined') {
  const play = Audio.prototype.play;
}

Audio.prototype.play = function () {
  try {
    update(this, settings);
  }
  catch (e) { console.log(logPrefix, e) }
  return play.apply(this, arguments);
};

if (typeof browser === 'undefined') {
  window.browser = chrome;
}
browser.runtime.onMessage.addListener(() => {
  if (window.audioCompressor == null) {
    return;
  }
  if (window.audioCompressor.target == null) {
    return;
  }
  if (!window.audioCompressor.target.attached) {
    return;
  }

  chrome.runtime.sendMessage({ active: true });
});
