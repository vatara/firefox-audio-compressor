'use strict';

var webNavigation = {
  observe(details) {
    if (details.url.startsWith('http')) {
      const { frameId, tabId } = details;
      chrome.tabs.executeScript(tabId, {
        file: 'data/inject.js',
        runAt: 'document_start',
        matchAboutBlank: true,
        frameId
      });
    }
  },
  install() {
    chrome.webNavigation.onCommitted.removeListener(webNavigation.observe);
    chrome.webNavigation.onCommitted.addListener(webNavigation.observe);
  },
  remove() {
    chrome.webNavigation.onCommitted.removeListener(webNavigation.observe);
  }
};
webNavigation.install();


let memoize = function (factory, ctx) {
  var cache = {};
  return function (key) {
    if (!(key in cache)) {
      cache[key] = factory.call(ctx, key);
    }
    return cache[key];
  };
};

let colorToRGBA = (function () {
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  var ctx = canvas.getContext('2d');

  return memoize(function (col) {
    ctx.clearRect(0, 0, 1, 1);
    // In order to detect invalid values,
    // we can't rely on col being in the same format as what fillStyle is computed as,
    // but we can ask it to implicitly compute a normalized value twice and compare.
    ctx.fillStyle = '#000';
    ctx.fillStyle = col;
    var computed = ctx.fillStyle;
    ctx.fillStyle = '#fff';
    ctx.fillStyle = col;
    if (computed !== ctx.fillStyle) {
      return; // invalid color
    }
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  });
})();

var currentTheme;

function isThemeDark() {
  if (currentTheme == null || currentTheme.colors == null || currentTheme.colors.toolbar == null) {
    return false;
  }
  var color = colorToRGBA(currentTheme.colors.toolbar);
  return color[0] + color[1] + color[2] < 384;
}

browser.theme.getCurrent().then((theme) => {
  currentTheme = theme;
  updateBrowserActionIcon();
});

browser.theme.onUpdated.addListener(({ theme }) => {
  currentTheme = theme;
  updateBrowserActionIcon();
});

browser.runtime.onMessage.addListener((message) => {
  updateBrowserActionIcon(message.active);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  updateBrowserActionIcon(false);

  var url = tab.url.toString().toLowerCase();
  if (url.startsWith('http')) {
    browser.tabs.sendMessage(tabId, null).then(response => {
      updateBrowserActionIcon(response.active);
    })
      .catch((error) => { });
  }
});

function updateBrowserActionIcon(active) {
  var dark = !isThemeDark();

  var iconUrl = 'data/icons/logo-'
    + (dark ? 'dark' : 'light')
    + (active ? '-active' : '') + '.svg';

  browser.browserAction.setIcon({ path: iconUrl });
}
