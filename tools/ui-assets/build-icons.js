// 生成界面图标（SVG，按颜色各一份）和简化肌肉图。
// 用法：node tools/ui-assets/build-icons.js
// 输出：images/icons/<name>-<color>.svg、images/muscles/<dark|light>/<key>.svg、tools/ui-assets/tab-icons.html（供 render-tab-icons 转 PNG）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ICON_DIR = path.join(ROOT, 'images', 'icons');
const MUSCLE_DIR = path.join(ROOT, 'images', 'muscles');

const COLORS = {
  ink: '#111517',
  white: '#FFFFFF',
  grey: '#8C8C88',
  muted: '#5D6366',
  lime: '#C8F76E'
};

// 线性图标：stroke 绘制；fill 图标在 name 后标注 filled
const LINE = {
  'chevron-right': '<path d="M9 5.5 15.5 12 9 18.5"/>',
  'chevron-left': '<path d="M15 5.5 8.5 12 15 18.5"/>',
  'chevron-down': '<path d="M6 9.5l6 6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5 16 16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  moon: '<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.8h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17.2h2"/>',
  stats: '<path d="M6.5 18v-6M11.5 18V6M16.5 18v-9M4 21h16"/>',
  trend: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7 15.5l3.2-4 3 2.4 4-5.2"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 9.5a5 5 0 0 1 8 0l-2.6 2.2a1.8 1.8 0 0 0-2.8 0z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9 1.65 1.65 0 0 0 20.83 10H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  dumbbell: '<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/>',
  fork: '<path d="M7 3v7.5M4.8 3v4.8a2.2 2.2 0 0 0 4.4 0V3M7 10.5V21M17 3c-2.2 0-3.4 2.8-3.4 7h3.4v11"/>',
  camera: '<path d="M4 8.2h3.2L9 5.5h6l1.8 2.7H20V19H4z"/><circle cx="12" cy="13.3" r="3.4"/>',
  album: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="8.7" cy="9.6" r="1.6"/><path d="M20.5 16l-5-5L6 19.5"/>',
  pencil: '<path d="M4.5 19.5h4L19 9l-4-4L4.5 15.5z"/><path d="M13.5 6.5l4 4"/>',
  copy: '<rect x="5.5" y="4" width="13" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 13.5h6M9 17h3.5"/>',
  bulb: '<path d="M9.2 18h5.6M10.2 21h3.6M12 3a6 6 0 0 0-3.6 10.8c.6.5.8 1.1.8 1.8V16h5.6v-.4c0-.7.2-1.3.8-1.8A6 6 0 0 0 12 3z"/>',
  leaf: '<path d="M5 19.5C5 11 10 5 20 4.5c0 10-6 15.2-15 15z"/><path d="M5 19.5l7.5-7.5"/>',
  drop: '<path d="M12 3.2s6.2 6.6 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"/>',
  veg: '<path d="M8 13.5 4 21l7.5-4M8 13.5l4.2-4.2a3.8 3.8 0 0 1 5.4 5.4L11.5 17M14 6.5c.3-1.8 1.5-3 3.5-3.3M17 9.5c1.6-.6 3.1-.3 4 .8"/>',
  sofa: '<path d="M5.5 11V8.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2V11"/><path d="M3.5 13a2 2 0 0 1 4 0v1.5h9V13a2 2 0 0 1 4 0v5H3.5zM6 18v2M18 18v2"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8.5 4v4.5h6V4M8.5 20v-5.5h7V20"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.9v.1"/>',
  'arrow-right': '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  'arrow-down': '<path d="M12 4.5v15M6 13.5l6 6 6-6"/>',
  'arrow-up': '<path d="M12 19.5v-15M6 10.5l6-6 6 6"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.3 14.2c2 2.3 5.4 2.3 7.4 0M9 9.7v.3M15 9.7v.3"/>',
  neutral: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7M9 9.7v.3M15 9.7v.3"/>',
  sad: '<circle cx="12" cy="12" r="9"/><path d="M8.5 16.2c2-2 5-2 7 0M8.6 9.8l1.6.8M15.4 9.8l-1.6.8"/>',
  grip: '<path d="M9 6v.1M15 6v.1M9 12v.1M15 12v.1M9 18v.1M15 18v.1"/>',
  more: '<path d="M5.5 12v.1M12 12v.1M18.5 12v.1"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 3.5M16 6h3.5A3 3 0 0 1 16 9.5M12 13v4M8.5 20.5h7M10 17h4"/>',
  plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>'
};

const FILLED = {
  play: '<path d="M8 5.2v13.6L18.8 12z"/>',
  skip: '<path d="M3.5 6.2 11.5 12l-8 5.8zM12 6.2 20 12l-8 5.8z"/>',
  flame: '<path d="M12.6 2.5c.6 3.6 5.4 5.3 5.4 10.6A6 6 0 0 1 6 13.4c0-2.4 1.1-4 2.4-5.1.1 2.1 1 3.2 2.3 3.4-.5-3 .1-6.6 1.9-9.2z"/>',
  bars: '<rect x="4" y="13" width="3.6" height="7" rx="1"/><rect x="10.2" y="8.5" width="3.6" height="11.5" rx="1"/><rect x="16.4" y="4" width="3.6" height="16" rx="1"/>',
  crown: '<path d="M3 7.5l4.8 4.3L12 4.5l4.2 7.3L21 7.5l-2.2 10.5H5.2zM5.2 19.5h13.6v1.5H5.2z"/>',
  'clear-circle': '<path fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm-3.2 4.6-1.2 1.2L10.8 12l-3.2 3.2 1.2 1.2 3.2-3.2 3.2 3.2 1.2-1.2-3.2-3.2 3.2-3.2-1.2-1.2-3.2 3.2z"/>',
  dot: '<circle cx="12" cy="12" r="5"/>'
};

// 图标的组合版本（圆底 + 符号）
const COMPOSITE = {
  'check-circle-lime': '<circle cx="12" cy="12" r="11" fill="#C8F76E"/><path d="M6.8 12.4l3.4 3.4 7-7.2" fill="none" stroke="#111517" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  'check-circle-ink': '<circle cx="12" cy="12" r="11" fill="#111517"/><path d="M6.8 12.4l3.4 3.4 7-7.2" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  'check-circle-ink-lime': '<circle cx="12" cy="12" r="11" fill="#111517"/><path d="M6.8 12.4l3.4 3.4 7-7.2" fill="none" stroke="#C8F76E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  'plus-circle-ink': '<circle cx="12" cy="12" r="11" fill="#111517"/><path d="M12 7v10M7 12h10" stroke="#C8F76E" stroke-width="2.4" stroke-linecap="round"/>',
  'play-circle-white': '<circle cx="12" cy="12" r="11" fill="#FFFFFF"/><path d="M10 7.8v8.4l6.6-4.2z" fill="#111517"/>',
  'star-lime': '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="#C8F76E"/>'
};

function svg(content, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size || 48}" height="${size || 48}">${content}</svg>`;
}

function lineIcon(body, color, width) {
  return svg(`<g fill="none" stroke="${color}" stroke-width="${width || 1.8}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`);
}

function filledIcon(body, color) {
  return svg(`<g fill="${color}">${body}</g>`);
}

// ---------- 肌肉图 ----------
// 简化人体，正面 / 背面，viewBox 120x220。所有肌肉块先画底色，再给目标肌群上荧光绿。
const MUSCLE_THEME = {
  dark: { body: '#1E272A', outline: '#3A4549', muscle: '#2D383B', line: '#46535A' },
  light: { body: '#E9E6E0', outline: '#CFCBC3', muscle: '#DCD8D0', line: '#C3BEB5' }
};
const LIME = '#C8F76E';

function mirror(d) {
  // 只用于 x 坐标镜像的简单路径：把 "x y" 数对的 x 变成 120 - x
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(120 - Number(x)).toFixed(1)} ${y}`);
}

const SILHOUETTE = [
  '<ellipse cx="60" cy="19" rx="11" ry="13"/>',
  '<path d="M54 30 L66 30 L67 41 L53 41 Z"/>',
  '<path d="M37 45 Q60 37 83 45 L87 72 Q85 100 79 118 L41 118 Q35 100 33 72 Z"/>',
  '<ellipse cx="36" cy="51" rx="10" ry="11"/>', '<ellipse cx="84" cy="51" rx="10" ry="11"/>',
  '<ellipse cx="30" cy="75" rx="7.5" ry="19" transform="rotate(10 30 75)"/>', '<ellipse cx="90" cy="75" rx="7.5" ry="19" transform="rotate(-10 90 75)"/>',
  '<ellipse cx="24.5" cy="109" rx="6.2" ry="17" transform="rotate(12 24.5 109)"/>', '<ellipse cx="95.5" cy="109" rx="6.2" ry="17" transform="rotate(-12 95.5 109)"/>',
  '<circle cx="20.5" cy="130" r="5"/>', '<circle cx="99.5" cy="130" r="5"/>',
  '<path d="M41 114 L79 114 L78 134 L60 142 L42 134 Z"/>',
  '<ellipse cx="48.5" cy="162" rx="12" ry="29"/>', '<ellipse cx="71.5" cy="162" rx="12" ry="29"/>',
  '<ellipse cx="47.5" cy="203" rx="8.5" ry="18"/>', '<ellipse cx="72.5" cy="203" rx="8.5" ry="18"/>'
];

const PEC = 'M43 53 Q55 47 59 51 L59 66 Q50 71 41 65 Z';
const LAT = 'M41 58 L57 66 L57 98 L46 92 Q39 78 41 58 Z';
const TRAP = 'M47 42 L60 37 L73 42 L67 58 L60 63 L53 58 Z';

const FRONT_MUSCLES = {
  chest: [`<path d="${PEC}"/>`, `<path d="${mirror(PEC)}"/>`],
  shoulders: ['<ellipse cx="36" cy="51" rx="8" ry="9"/>', '<ellipse cx="84" cy="51" rx="8" ry="9"/>'],
  biceps: ['<ellipse cx="30.5" cy="74" rx="5" ry="12.5" transform="rotate(10 30.5 74)"/>', '<ellipse cx="89.5" cy="74" rx="5" ry="12.5" transform="rotate(-10 89.5 74)"/>'],
  forearms: ['<ellipse cx="24.5" cy="108" rx="4.6" ry="13" transform="rotate(12 24.5 108)"/>', '<ellipse cx="95.5" cy="108" rx="4.6" ry="13" transform="rotate(-12 95.5 108)"/>'],
  abs: [52, 61].flatMap(x => [74, 87, 100].map(y => `<rect x="${x}" y="${y}" width="7" height="11" rx="2.5"/>`))
    .concat(['<path d="M44 74 Q48 90 47 108 L43 104 Q40 88 44 74 Z"/>', `<path d="${mirror('M44 74 Q48 90 47 108 L43 104 Q40 88 44 74 Z')}"/>`]),
  quads: ['<ellipse cx="49" cy="160" rx="9.5" ry="23"/>', '<ellipse cx="71" cy="160" rx="9.5" ry="23"/>'],
  calves: ['<ellipse cx="47.5" cy="201" rx="6" ry="13"/>', '<ellipse cx="72.5" cy="201" rx="6" ry="13"/>']
};

const BACK_MUSCLES = {
  traps: [`<path d="${TRAP}"/>`],
  back: [`<path d="${LAT}"/>`, `<path d="${mirror(LAT)}"/>`],
  lowerback: ['<rect x="53.5" y="98" width="13" height="16" rx="4"/>'],
  shoulders: ['<ellipse cx="36" cy="51" rx="8" ry="9"/>', '<ellipse cx="84" cy="51" rx="8" ry="9"/>'],
  triceps: ['<ellipse cx="29.5" cy="76" rx="5" ry="12.5" transform="rotate(10 29.5 76)"/>', '<ellipse cx="90.5" cy="76" rx="5" ry="12.5" transform="rotate(-10 90.5 76)"/>'],
  glutes: ['<ellipse cx="51" cy="128" rx="9.5" ry="10"/>', '<ellipse cx="69" cy="128" rx="9.5" ry="10"/>'],
  hamstrings: ['<ellipse cx="49" cy="165" rx="8.5" ry="21"/>', '<ellipse cx="71" cy="165" rx="8.5" ry="21"/>'],
  calves: ['<ellipse cx="47.5" cy="199" rx="7" ry="14"/>', '<ellipse cx="72.5" cy="199" rx="7" ry="14"/>']
};

// key -> 视图与高亮肌群
const MUSCLE_FIGURES = {
  chest: { view: 'front', on: ['chest'] },
  shoulders: { view: 'front', on: ['shoulders'] },
  biceps: { view: 'front', on: ['biceps'] },
  arms: { view: 'front', on: ['biceps', 'forearms'] },
  forearms: { view: 'front', on: ['forearms'] },
  abs: { view: 'front', on: ['abs'] },
  quads: { view: 'front', on: ['quads'] },
  legs: { view: 'front', on: ['quads', 'calves'] },
  cardio: { view: 'front', on: ['chest', 'abs', 'quads', 'calves', 'shoulders'] },
  back: { view: 'back', on: ['back', 'traps'] },
  traps: { view: 'back', on: ['traps'] },
  lowerback: { view: 'back', on: ['lowerback'] },
  triceps: { view: 'back', on: ['triceps'] },
  glutes: { view: 'back', on: ['glutes'] },
  hamstrings: { view: 'back', on: ['hamstrings'] },
  calves: { view: 'back', on: ['calves'] }
};

function muscleSvg(key, themeName) {
  const theme = MUSCLE_THEME[themeName];
  const figure = MUSCLE_FIGURES[key];
  const groups = figure.view === 'front' ? FRONT_MUSCLES : BACK_MUSCLES;
  const base = Object.keys(groups).filter(name => !figure.on.includes(name)).flatMap(name => groups[name]).join('');
  const lit = figure.on.flatMap(name => groups[name] || []).join('');
  const spine = figure.view === 'back' ? `<path d="M60 40 V114" stroke="${theme.line}" stroke-width="1" fill="none"/>` : `<path d="M60 52 V112" stroke="${theme.line}" stroke-width="0.8" fill="none"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 225" width="240" height="450">`
    + `<g fill="${theme.body}" stroke="${theme.outline}" stroke-width="1.2">${SILHOUETTE.join('')}</g>`
    + spine
    + `<g fill="${theme.muscle}" stroke="${theme.line}" stroke-width="0.8">${base}</g>`
    + `<g fill="${LIME}" stroke="${LIME}" stroke-width="0.8">${lit}</g>`
    + '</svg>';
}

// ---------- tab 图标（交给 Chrome 渲染成 81x81 PNG） ----------
const TAB_ICONS = {
  today: {
    line: '<path d="M4.5 10.6 12 4.5l7.5 6.1V19a1.5 1.5 0 0 1-1.5 1.5h-3.5V15h-5v5.5H6A1.5 1.5 0 0 1 4.5 19z"/>',
    filled: '<path fill-rule="evenodd" d="M12 3.4l8.4 6.8V19a2.4 2.4 0 0 1-2.4 2.4h-3.6V15.5H9.6v5.9H6A2.4 2.4 0 0 1 3.6 19v-8.8z"/>'
  },
  library: {
    line: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    filled: '<rect x="4.6" y="5.6" width="4" height="12.8" rx="1.4"/><rect x="15.4" y="5.6" width="4" height="12.8" rx="1.4"/><rect x="1.6" y="8.6" width="2.6" height="6.8" rx="1"/><rect x="19.8" y="8.6" width="2.6" height="6.8" rx="1"/><rect x="8" y="10.6" width="8" height="2.8"/>'
  },
  plan: {
    line: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M8.8 10.5h6.4M8.8 14.5h6.4"/>',
    filled: '<path fill-rule="evenodd" d="M9 2.2h6a1 1 0 0 1 1 1V4h1.5A2.5 2.5 0 0 1 20 6.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-13A2.5 2.5 0 0 1 6.5 4H8v-.8a1 1 0 0 1 1-1zM8.6 9.6v1.8h6.8V9.6zm0 4v1.8h6.8v-1.8z"/>'
  },
  diet: {
    line: '<path d="M3.5 10.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M5.5 10.5c.4-2.6 3.4-4.5 6.5-4.5s6.1 1.9 6.5 4.5M8 20.5h8"/>',
    filled: '<path d="M2.8 9.8h18.4a9.2 9.2 0 0 1-18.4 0zM4.7 8.6C5.5 5.6 8.6 3.6 12 3.6s6.5 2 7.3 5zM7.6 19.8h8.8v1.8H7.6z"/>'
  },
  me: {
    line: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5z"/>',
    filled: '<circle cx="12" cy="7.6" r="4.6"/><path d="M3.6 21.4c0-4.8 3.8-7.6 8.4-7.6s8.4 2.8 8.4 7.6z"/>'
  }
};

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function main() {
  let count = 0;
  Object.entries(LINE).forEach(([name, body]) => {
    Object.entries(COLORS).forEach(([colorName, color]) => {
      writeFile(path.join(ICON_DIR, `${name}-${colorName}.svg`), lineIcon(body, color));
      count += 1;
    });
  });
  Object.entries(FILLED).forEach(([name, body]) => {
    Object.entries(COLORS).forEach(([colorName, color]) => {
      writeFile(path.join(ICON_DIR, `${name}-${colorName}.svg`), filledIcon(body, color));
      count += 1;
    });
  });
  Object.entries(COMPOSITE).forEach(([name, body]) => {
    writeFile(path.join(ICON_DIR, `${name}.svg`), svg(body));
    count += 1;
  });

  // 肌群图已换成 tools/ui-assets/muscles 产出的 PNG，这里不再生成 SVG 版本。
  if (process.argv.includes('--muscle-svg')) {
    Object.keys(MUSCLE_FIGURES).forEach(key => {
      ['dark', 'light'].forEach(theme => {
        writeFile(path.join(MUSCLE_DIR, theme, `${key}.svg`), muscleSvg(key, theme));
        count += 1;
      });
    });
  }

  // tab 图标：一行 10 个 81x81 格子，未选中灰色描线，选中黑色实心
  const cells = Object.entries(TAB_ICONS).flatMap(([name, icon]) => [
    { file: `tab-${name}.png`, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="81" height="81"><g fill="none" stroke="#5D6366" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icon.line}</g></svg>` },
    { file: `tab-${name}-active.png`, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="81" height="81"><g fill="#111517">${icon.filled}</g></svg>` }
  ]);
  const html = '<!doctype html><html><head><style>html,body{margin:0;background:transparent}div{display:flex}svg{display:block}</style></head><body><div>'
    + cells.map(cell => cell.svg).join('') + '</div></body></html>';
  writeFile(path.join(__dirname, 'tab-icons.html'), html);
  writeFile(path.join(__dirname, 'tab-icons.json'), JSON.stringify(cells.map(cell => cell.file)));

  console.log(`icons + muscles: ${count} files; tab cells: ${cells.length}`);
}

main();
