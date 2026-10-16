// 界面展示用的纯函数：器械插图、肌肉图、训练日简称、时长估算、数字格式。

const EQUIPMENT_RULES = [
  [/双杠|引体|俯卧撑|悬垂|深蹲|蹲|架/, 'rack'],
  [/下拉|绳索|龙门|面拉|夹胸|下压|器械|坐姿划船|拉力/, 'pulldown'],
  [/上斜|下斜|凳上/, 'incline'],
  [/哑铃|壶铃/, 'dumbbell'],
  [/卧推|飞鸟|推举|臂屈伸|仰卧/, 'bench'],
  [/杠铃|硬拉|弯举|划船|奥杆|曲杆|六角/, 'barbell']
];

const EQUIPMENT_GROUP_IMAGE = {
  bodyweight: 'rack',
  dumbbell: 'dumbbell',
  barbell: 'barbell',
  cable: 'pulldown',
  machine: 'pulldown',
  kettlebell: 'dumbbell',
  band: 'pulldown',
  other: 'bench'
};

function equipmentImage(name, equipmentGroup) {
  const text = String(name || '');
  const rule = EQUIPMENT_RULES.find(([pattern]) => pattern.test(text));
  const key = rule ? rule[1] : (EQUIPMENT_GROUP_IMAGE[equipmentGroup] || 'bench');
  return `/images/equipment/${key}.png`;
}

// ---------- 动作图片（exercises-dataset，图片 © Gym visual） ----------
// 换成自己的对象存储时只改这一行；目录结构保持 images/ 与 videos/。
const MEDIA_BASE_URL = 'https://fastly.jsdelivr.net/gh/XYDragon603/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd';
const MEDIA_ATTRIBUTION = '动作图片 © Gym visual';

// 内置计划里的动作没有 libraryId，按名称对应到数据集
const BUILTIN_MEDIA_NAMES = {
  '杠铃卧推': '0025', '哑铃上斜卧推': '0314', '双杠臂屈伸': '0251', '绳索下压': '0201', '哑铃侧平举': '0334',
  '高位下拉': '0150', '坐姿划船': '0180', '单臂哑铃划船': '0292', '面拉': '0203', '哑铃弯举': '0294',
  '杯式深蹲': '1760', '高脚杯深蹲': '1760', '罗马尼亚硬拉': '0085', '哑铃罗马尼亚硬拉': '1459',
  '保加利亚分腿蹲': '0410', '臀桥': '3013', '提踵': '1373', '俯卧撑': '0662', '哑铃肩推': '0405'
};

let mediaMap = null;
function getMediaMap() {
  if (!mediaMap) mediaMap = require('./exercise-media.js');
  return mediaMap;
}

// 传 libraryId，或带 name / libraryId 的动作对象；找不到返回 null
function exerciseMedia(source) {
  const libraryId = typeof source === 'string' ? source : (source && (source.libraryId || BUILTIN_MEDIA_NAMES[String(source.name || '').trim()]));
  const mediaId = libraryId ? getMediaMap()[libraryId] : '';
  if (!mediaId) return null;
  return {
    thumb: `${MEDIA_BASE_URL}/images/${libraryId}-${mediaId}.jpg`,
    gif: `${MEDIA_BASE_URL}/videos/${libraryId}-${mediaId}.gif`
  };
}

const MUSCLE_RULES = [
  [/有氧|心肺|cardio/i, 'cardio'],
  [/三头|triceps/i, 'triceps'],
  [/二头|肱肌|biceps|brachialis/i, 'biceps'],
  [/上臂|upper arms/i, 'arms'],
  [/前臂|握力|腕|forearm|wrist|grip/i, 'forearms'],
  [/斜方|颈|traps|trapezius|levator|neck/i, 'traps'],
  [/竖脊|下背|腰背|spine|lower back/i, 'lowerback'],
  [/背|阔|菱形|lats|latissimus|upper back|rhomboid|back/i, 'back'],
  [/胸|pector|chest|serratus/i, 'chest'],
  [/肩|三角|delt|shoulder|rotator/i, 'shoulders'],
  [/腹|核心|abs|abdominal|core|oblique|waist/i, 'abs'],
  [/臀|外展|glute|abductor|hip/i, 'glutes'],
  [/腘绳|大腿后|hamstring/i, 'hamstrings'],
  [/小腿|比目鱼|calves|calf|soleus|lower legs|shin/i, 'calves'],
  [/股四|大腿|腿|内收|quad|adductor|upper legs|legs/i, 'quads']
];

function muscleKey(text) {
  const value = String(text || '');
  const rule = MUSCLE_RULES.find(([pattern]) => pattern.test(value));
  return rule ? rule[1] : 'chest';
}

function muscleImage(text, theme) {
  // 肌群图在动作分包里（主包只留动作库首页用的 6 张深色图）
  return `/packageExercise/images/muscles/${theme === 'dark' ? 'dark' : 'light'}/${muscleKey(text)}.png`;
}

// "胸 · 三角肌中束 · 三头" -> "胸"；"腿臀日" -> "腿臀"；休息日 -> "休息"
function dayFocus(day) {
  if (!day) {
    return '';
  }
  if (day.type === 'rest' || day.isRest) {
    return '休息';
  }
  const first = String(day.name || '').split(/[·・,，/\s]+/).filter(Boolean)[0] || '';
  return first.replace(/日$/, '').replace(/^练/, '') || '训练';
}

// 首页标题：“胸” -> “今天，练胸”；“力量训练” / “轻有氧” 这类本身是活动名的不再加“练”
function todayTitle(day) {
  if (!day) return '今天，动起来';
  if (day.type === 'rest' || day.isRest) return '今天，认真恢复';
  const focus = dayFocus(day);
  return /训练|练|有氧|活动|拉伸|跑|走/.test(focus) ? `今天，${focus}` : `今天，练${focus}`;
}

// 计划日格子里的短名："胸 · 三角肌中束 · 三头" -> "胸与三头"；本来就短的保持原样
function compactDayName(day) {
  if (!day) return '';
  if (day.type === 'rest' || day.isRest) return day.name || '休息日';
  const name = String(day.name || '').trim();
  const parts = name.split(/\s*[·・/]\s*/).filter(Boolean);
  if (name.length <= 5 || parts.length < 2) return name || '训练';
  const joined = `${parts[0]}与${parts[parts.length - 1]}`;
  return joined.length <= 5 ? joined : parts[0];
}

// 本周节奏格子里的短标签，最多 3 个字
function shortFocus(day) {
  const focus = dayFocus(day).replace(/训练$/, '') || '训练';
  return focus.length > 3 ? focus.slice(0, 3) : focus;
}

// 每组约 40 秒动作 + 默认休息，按 5 分钟取整
function estimateMinutes(exercises, restSec) {
  const rest = Number(restSec) > 0 ? Number(restSec) : 90;
  const sets = (Array.isArray(exercises) ? exercises : []).reduce((sum, exercise) => {
    const plan = exercise && exercise.weeks && exercise.weeks[1] ? exercise.weeks[1] : exercise || {};
    return sum + (Number(plan.sets) || Number(exercise && exercise.sets) || 3);
  }, 0);
  if (!sets) {
    return 0;
  }
  return Math.max(5, Math.round((sets * (40 + rest)) / 60 / 5) * 5);
}

function formatThousands(value) {
  const num = Number(value) || 0;
  const rounded = Math.round(num);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function percent(value, target) {
  const v = Number(value) || 0;
  const t = Number(target) || 0;
  if (t <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((v / t) * 100)));
}

function formatRestLabel(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function parseDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`);
}

function monthDay(dateStr) {
  const date = parseDate(dateStr);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function weekdayLabel(dateStr) {
  return WEEK_LABELS[parseDate(dateStr).getDay()];
}

function dateTitle(dateStr) {
  const date = parseDate(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

module.exports = {
  exerciseKey: source => source && (source.libraryId || BUILTIN_MEDIA_NAMES[String(source.name || '').trim()] || source.id) || '',
  MEDIA_BASE_URL,
  MEDIA_ATTRIBUTION,
  exerciseMedia,
  equipmentImage,
  muscleKey,
  muscleImage,
  dayFocus,
  todayTitle,
  compactDayName,
  shortFocus,
  estimateMinutes,
  formatThousands,
  percent,
  formatRestLabel,
  monthDay,
  weekdayLabel,
  dateTitle
};
