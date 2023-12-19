function parseColor(input) {
  let div = document.createElement('div');
  div.style.color = input;
  let m = getComputedStyle(div).color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (m) {
    return [m[1], m[2], m[3]];
  }
  return null;
}

export function isThemeDark(theme) {
  if (matchMedia('(prefers-color-scheme: dark)').matches) {
    return true;
  }
  if (typeof theme == 'undefined' || theme == null || theme.colors == null || theme.colors.toolbar == null) {
    return false;
  }
  var color = parseColor(theme.colors.toolbar);
  return color[0] + color[1] + color[2] < 384;
}
