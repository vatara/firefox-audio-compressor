'use strict';

var prefs = {
  sites: {
    'default': { enabled: false, threshold: -24, knee: 30, ratio: 12, attack: .003, release: .25, boost: 0 }
  }
};
var settings = prefs.sites.default;

console.log('injecting compressor');

let audio;
function adjustSource(target, settings) {

  audio = target;

  if (typeof (target.attached) === "undefined") {
    target.attached = false;
  }

  if (!target.attached && settings.enabled) {
    if (!target.initialized) {
      console.log('creating compressor', settings.enabled);

      target.context = new window.AudioContext();
      target.source = target.context.createMediaElementSource(target);
      target.compressor = target.context.createDynamicsCompressor();
      target.boost = target.context.createGain();
      target.initialized = true;
    }

    try {
      target.source.disconnect(target.context.destination);
    }
    catch (e) {
      console.log("Caught error disconnecting source");
    }
    target.source.connect(target.compressor);
    target.compressor = target.compressor;
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
      if (s == 'enabled') {

      }
      else if (s == 'boost') {
        target.boost.gain.value = settings[s] * 4 + 1;
      }
      else {
        target.compressor[s].value = settings[s];
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

browser.runtime.onMessage.addListener(() => {
  var active = false;
  if (audio != null) {
    active = audio.attached == true;
  }
  return Promise.resolve({ active: active });
});