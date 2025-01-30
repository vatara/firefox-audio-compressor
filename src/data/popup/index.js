'use strict';

const isChrome = typeof (chrome.runtime.getBrowserInfo) == 'undefined';

var elements = {
  //disableForCrossSiteElements: document.getElementById('disableForCrossSiteElements'),
  presets: document.getElementById('presets'),
  enabled: document.getElementById('enabled'),
  compressorControlsTable: document.getElementById('compressorControlsTable'),
  compressorControls: {},
  siteSettings: document.getElementById('siteSettings'),
  url: document.getElementById('url'),
  currentSite: document.getElementById('currentSite'),
  removeSite: document.getElementById('removeSite')
};

function assignRangeControls(id) {
  elements.compressorControls[id] = document.getElementById(id);
  var num = id + 'Number';
  elements.compressorControls[num] = document.getElementById(num);

  elements.compressorControls[id].onchange = () => {
    elements.compressorControls[num].value = elements.compressorControls[id].value;
    saveSettings();
  }
  elements.compressorControls[num].onchange = () => {
    elements.compressorControls[id].value = elements.compressorControls[num].value;
    saveSettings();
  }
}

assignRangeControls('threshold');
assignRangeControls('knee');
assignRangeControls('ratio');
assignRangeControls('attack');
assignRangeControls('release');
assignRangeControls('boost');

elements.enabled.onchange = () => {
  saveSettings();
}

/*
elements.disableForCrossSiteElements.onchange = () => {
  saveSettings();
}
*/

var defaultCompressorSettings = { enabled: false, threshold: -24, knee: 30, ratio: 12, attack: .003, release: .25, boost: 0 };

var currentSite = 'default';
var urlSegments = [];
var currentUrl = '';

var prefs = {
  sites: {
    'default': defaultCompressorSettings
  }
  //disableForCrossSiteElements: false
};

// enabled, threshold, knee, ratio, attack, release, boost
var presets = {
  'Disabled': { enabled: false, threshold: 0, knee: 30, ratio: 1, attack: .003, release: .25, boost: 0 },
  'None': { enabled: true, threshold: 0, knee: 30, ratio: 1, attack: .003, release: .25, boost: 0 },
  'Low': { enabled: true, threshold: -12, knee: 30, ratio: 6, attack: .003, release: .25, boost: 0 },
  'Medium': { enabled: true, threshold: -30, knee: 30, ratio: 12, attack: .003, release: .25, boost: 0 },
  'High': { enabled: true, threshold: -50, knee: 30, ratio: 20, attack: .003, release: .25, boost: 0 }
};

for (var p in presets) {
  var button = document.createElement('button');
  button.textContent = p;
  elements.presets.appendChild(button);

  ((p2) => {
    button.onclick = () => {
      applySettingsToControls(presets[p2]);
      saveSettings();
    }
  })(p);
}

function applySettingsToControls(settings) {
  for (var s in settings) {
    if (s == 'enabled') {
      elements.enabled.checked = settings[s];
    }
    else {
      elements.compressorControls[s].value = elements.compressorControls[s + 'Number'].value = settings[s];
    }
  }
}

elements.currentSite.onchange = () => { onCurrentSiteChange(); };
elements.removeSite.onclick = () => { removeSite(); }

function createUrlSegment(text, clickable = false) {
  var element;
  if (clickable) {
    element = document.createElement('a');
  }
  else {
    element = document.createElement('span');
  }
  element.href = 'javascript:void(0)';

  element.textContent = text;
  element.addEventListener('mouseover', event => {
    event.target.classList.add('mouse-over');
    updateUrlSegments(event.target);
  });
  element.addEventListener('mouseout', event => {
    event.target.classList.remove('mouse-over');
    updateUrlSegments(event.target);
  });

  if (clickable) {
    element.addEventListener('click', event => {
      var url = '';
      for (var i = 0; i < urlSegments.length; i++) {
        url += urlSegments[i].textContent;
        if (urlSegments[i] == event.target) {
          setCurrentSite(url);
          return;
        }
      }
    });
  }

  elements.url.appendChild(element);
  urlSegments.push(element);
}

function updateUrlSegments(target) {
  var overAny = false;
  var index = 0;
  for (var i = 0; i < urlSegments.length; i++) {
    urlSegments[i].classList.remove('url-highlight');
    urlSegments[i].classList.remove('url-lowlight');

    if (urlSegments[i].classList.contains('mouse-over')) {
      overAny = true;
    }
    if (urlSegments[i] == target) {
      index = i;
    }
  }

  if (!overAny) {
    return;
  }

  if (index >= 2) {
    for (var i = 0; i < urlSegments.length; i++) {
      if (i <= index) {
        urlSegments[i].classList.add('url-highlight');
      }
      else {
        urlSegments[i].classList.add('url-lowlight');
      }
    }
  }
}

function sortSelect(selectElement) {
  var array = new Array();
  for (var i = 0; i < selectElement.options.length; i++) {
    array[i] = new Array();
    array[i][0] = selectElement.options[i].text;
    array[i][1] = selectElement.options[i].value;
  }
  array.sort();

  while (selectElement.options.length) {
    selectElement.options[0].remove();
  }

  for (var i = 0; i < array.length; i++) {
    var op = new Option(array[i][0], array[i][1]);
    selectElement.options[i] = op;
  }
}

function setCurrentSite(site) {
  if (prefs.sites[site] == null) {
    prefs.sites[site] = getCurrentCompressorSettings();
    var option = new Option(site, site);
    elements.currentSite.options[elements.currentSite.options.length] = option;
    saveSettings();
  }

  elements.currentSite.value = site;
  onCurrentSiteChange();
}

function onCurrentSiteChange() {
  currentSite = elements.currentSite.value;

  if (currentSite == 'default') {
    elements.removeSite.disabled = true;
  }
  else {
    elements.removeSite.disabled = false;
  }

  if (prefs.sites[currentSite] != null) {
    applySettingsToControls(prefs.sites[currentSite]);
  }
}

function removeSite() {
  if (elements.currentSite.selectedIndex < 0) {
    return;
  }
  var site = elements.currentSite.value;
  if (site == 'default') {
    return;
  }
  delete prefs.sites[site];
  elements.currentSite.options[elements.currentSite.selectedIndex].remove();
  elements.currentSite.value = 'default';
  onCurrentSiteChange();
  saveSettings();
}

function getCurrentCompressorSettings() {
  var settings = {};

  for (var s in defaultCompressorSettings) {
    if (s == 'enabled') {
      settings[s] = elements.enabled.checked;
    }
    else {
      settings[s] = elements.compressorControls[s].value;
    }
  }

  return settings;
}

function saveSettings() {
  //prefs.disableForCrossSiteElements = elements.disableForCrossSiteElements.checked;
  prefs.sites[currentSite] = getCurrentCompressorSettings();
  chrome.storage.local.set(prefs);
  console.log('saved', prefs);
}

if (isChrome) {
  chrome.tabs.query({ currentWindow: true, active: true }, queryTabsCallback);
}
else {
  chrome.tabs.query({ currentWindow: true, active: true }).then(queryTabsCallback, console.error);
}

function queryTabsCallback(tabs) {
  let tab = tabs[0]; // Safe to assume there will be one result

  elements.url.innerHTML = '';
  urlSegments = [];
  currentUrl = tab.url;

  var url = new URL(tab.url);
  var pathSplit = url.pathname.split('/');

  createUrlSegment(url.protocol);
  createUrlSegment('//');
  createUrlSegment(url.host, true);

  var first = true;
  for (var p of pathSplit) {
    if (!first) {
      createUrlSegment('/' + p, true);
    }
    first = false;
  }

  createUrlSegment(url.search, true);
  createUrlSegment(url.hash, true);

  loadSettings();
}

function loadSettings() {
  chrome.storage.local.get(prefs, results => {
    Object.assign(prefs, results);

    //elements.disableForCrossSiteElements.checked = prefs.disableForCrossSiteElements == true;

    var sortedList = [];
    for (var key in prefs.sites) {
      if (key == 'default') {
        continue;
      }
      sortedList.push(key);
    }
    sortedList = sortedList.sort((a, b) => a.localeCompare(b));

    for (var key of sortedList) {
      var option = new Option(key, key);
      elements.currentSite.options[elements.currentSite.options.length] = option;
    }

    if (prefs.sites.default == null) {
      prefs.sites.default = defaultCompressorSettings;
    }

    var bestSiteMatch = currentSite = 'default';
    var maxLength = 0;
    for (var s in prefs.sites) {
      if (s == 'default') {
        continue;
      }
      if (currentUrl.startsWith(s) && s.length > maxLength) {
        bestSiteMatch = s;
        maxLength = s.length
      }
    }

    elements.currentSite.value = currentSite = bestSiteMatch;
    onCurrentSiteChange();
  });
}

const commandName = 'toggle-enable';

if (isChrome) {
  document.querySelector('#shortcuts-link').style.display = "unset";
  document.querySelector('#shortcut').disabled = true;
}
else {
  document.querySelector('#shortcut-update').style.display = "unset";
  document.querySelector('#shortcut-reset').style.display = "unset";
}

/**
 * Update the UI: set the value of the shortcut textbox.
 */
async function updateUI() {
  let commands = await chrome.commands.getAll();
  for (let command of commands) {
    if (command.name === commandName) {
      document.querySelector('#shortcut').value = command.shortcut;
    }
  }
}

/**
 * Update the shortcut based on the value in the textbox.
 */
async function updateShortcut() {
  try {
    await chrome.commands.update({
      name: commandName,
      shortcut: document.querySelector('#shortcut').value
    });
    document.querySelector('#shortcut-message').textContent = "";
  }
  catch (exception) {
    document.querySelector('#shortcut-message').textContent = exception;
  }
}

/**
 * Reset the shortcut and update the textbox.
 */
async function resetShortcut() {
  await chrome.commands.reset(commandName);
  updateUI();
}

/**
 * Update the UI when the page loads.
 */
document.addEventListener('DOMContentLoaded', updateUI);

/**
 * Handle update and reset button clicks
 */
document.querySelector('#shortcut-update').addEventListener('click', updateShortcut)
document.querySelector('#shortcut-reset').addEventListener('click', resetShortcut)

document.getElementById("shortcuts-link").addEventListener('click', () => chrome.tabs.create({
  url: "chrome://extensions/shortcuts"
}));
