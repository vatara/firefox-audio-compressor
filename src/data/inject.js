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

window.audioCompressor = {
  targets: []
};

function adjustSource(target, settings) {
  /*
  document.querySelectorAll('video, audio').forEach((e) => {
    e.crossOrigin = 'anonymous';
  });
  */

  if (typeof target === 'undefined') return;
  if (target == null) return;

  if (!window.audioCompressor.targets.includes(target)) {
    window.audioCompressor.targets.push(target);
  }

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
          // clamp input to a range of [-1, 1]
          let gain = Math.max(Math.min(parseFloat(value), 1), -1);
          // scale gain input range [-1, 1] to output range [~0, ~5]
          // so that an input of 0 keeps the same output level
          gain = Math.pow((gain + 1) / 2, 2.3219281) * 5;
          gain = Math.max(.00001, gain);
          target.boost.gain.exponentialRampToValueAtTime(gain, parameterChangeDuration);
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
  browser.runtime.sendMessage({
    type: "isActive",
    active: target.attached == true
  });
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
  if (typeof window.audioCompressor == 'undefined') return;

  let settings = prefs.sites[getBestSiteMatch()];

  window.audioCompressor.targets.forEach((t) => {
    console.log(logPrefix + 'updating target', t);
    adjustSource(t, settings);
  });

  if (target == null) {
    let videos = document.querySelectorAll('video');
    for (var v of videos) {
      let playing = !!(v.currentTime > 0 && !v.paused && !v.ended && v.readyState > 2 && !v.muted)
      if (!playing) continue;
      if (window.audioCompressor.targets.includes(v)) continue;

      target = v;
      break;
    }
  }
  if (target == null) return;


  if (!window.audioCompressor.targets.includes(target)) {
    console.log(logPrefix + 'adding target', target);
    adjustSource(target, settings);
  }
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
  update(target);
}, true);

window.addEventListener('canplay', ({ target }) => {
  update(target);
}, true);

setInterval(() => {
  let videos = document.querySelectorAll('video');
  videos.forEach((v) => {
    let playing = !!(v.currentTime > 0 && !v.paused && !v.ended && v.readyState > 2 && !v.muted)
    if (!playing) return;
    if (window.audioCompressor.targets.includes(v)) return;
    update(v);
  });

}, 500);

if (typeof play === 'undefined') {
  const play = Audio.prototype.play;
}

Audio.prototype.play = function () {
  try {
    update(this);
  }
  catch (e) { console.log(logPrefix, e) }
  return play.apply(this, arguments);
};

if (typeof browser === 'undefined') {
  window.browser = chrome;
}
browser.runtime.onMessage.addListener((message) => {
  if (message.type == "isActive") {
    onIsActiveMessage();
  }
  else if (message.type == "toggleEnable") {
    toggleEnable();
  }
});

function onIsActiveMessage() {
  if (window.audioCompressor == null) {
    return;
  }
  if (window.audioCompressor.targets == null) {
    return;
  }

  var active = false;
  for (var t of window.audioCompressor.targets) {
    if (t == null) continue;
    if (t.attached) {
      active = true;
      break;
    }
  }

  chrome.runtime.sendMessage({
    type: "isActive",
    active: active
  });
  // can't get this to work with chrome
  //return Promise.resolve({ active: active });
}

function toggleEnable() {  
  if (typeof window.audioCompressor == 'undefined') return;
  
  let site = getBestSiteMatch();
  if (site == null) return;

  prefs.sites[site].enabled = !prefs.sites[site].enabled;
  chrome.storage.local.set(prefs);
  console.log('Toggled enable for current site', prefs.sites[site]);
}
