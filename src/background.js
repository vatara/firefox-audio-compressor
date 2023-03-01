'use strict';

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
  if (matchMedia('(prefers-color-scheme: dark)').matches) {
    return true;
  }
  if (typeof currentTheme == 'undefined' || currentTheme == null || currentTheme.colors == null || currentTheme.colors.toolbar == null) {
    return false;
  }
  var color = colorToRGBA(currentTheme.colors.toolbar);
  return color[0] + color[1] + color[2] < 384;
}

window.isChrome = typeof browser === 'undefined';
if (isChrome) {
  window.browser = chrome;
}

if (typeof browser.theme !== 'undefined') {
  browser.theme.getCurrent().then((theme) => {
    currentTheme = theme;
    updateBrowserActionIcon();
  });

  browser.theme.onUpdated.addListener(({ theme }) => {
    currentTheme = theme;
    updateBrowserActionIcon();
  });
}

browser.runtime.onMessage.addListener((message) => {
  if (message != null) {
    updateBrowserActionIcon(message.active);
  }
});

function updateIconStatus(tab) {
  updateBrowserActionIcon(false);

  var url = tab.url.toString().toLowerCase();
  if (!url.startsWith('http')) {
    return;
  }
  if (isChrome) {
    try {
      browser.tabs.sendMessage(tab.id, {}, null, (message) => {
        if (message == null) {
          // if you don't check this value chrome logs an error
          var discardError = chrome.runtime.lastError;
        }
        else {
          updateBrowserActionIcon(message.active);
        }
      });
    }
    catch (error) { }
  }
  else {
    browser.tabs.sendMessage(tab.id, null).then(response => {
      updateBrowserActionIcon(response.active);
    })
      .catch((error) => { });
  }
}

browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId, (tab) => {
    updateIconStatus(tab);
  });
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  updateIconStatus(tab);
});

var chromeIcons = {
  inactive: {
    '16': 'data/icons/logo-mid-16.png',
    '32': 'data/icons/logo-mid-32.png',
    '48': 'data/icons/logo-mid-48.png',
    '64': 'data/icons/logo-mid-64.png',
    '128': 'data/icons/logo-mid-128.png'
  },
  active: {
    '16': 'data/icons/logo-mid-active-16.png',
    '32': 'data/icons/logo-mid-active-32.png',
    '48': 'data/icons/logo-mid-active-48.png',
    '64': 'data/icons/logo-mid-active-64.png',
    '128': 'data/icons/logo-mid-active-128.png'
  }
};

function updateBrowserActionIcon(active) {
  if (isChrome) {
    browser.action.setIcon({ path: active ? chromeIcons.active : chromeIcons.inactive });
  }
  else {
    var dark = !isThemeDark();

    var iconUrl = 'data/icons/logo-'
      + (dark ? 'dark' : 'light')
      + (active ? '-active' : '') + '.svg';

    browser.action.setIcon({ path: iconUrl });
  }
}
