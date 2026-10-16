// “我的 / 历史 / 统计 / 体重”页面共用的视图数据。纯函数，不读写 storage。
const progression = require('./progression.js');
const setTypes = require('./set-types.js');

const MEALS = [
  { key: 'breakfast', label: '早餐', from: 4 * 60, to: 10 * 60 + 30, image: '/images/meal/breakfast.jpg' },
  { key: 'lunch', label: '午餐', from: 10 * 60 + 30, to: 14 * 60 + 30, image: '/images/meal/lunch.jpg' },
  { key: 'snack', label: '加餐', from: 14 * 60 + 30, to: 17 * 60, image: '/images/meal/snack.jpg' },
  { key: 'dinner', label: '晚餐', from: 17 * 60, to: 21 * 60 + 30, image: '/images/meal/dinner.jpg' },
  { key: 'late', label: '加餐', from: 0, to: 24 * 60, image: '/images/meal/snack.jpg' }
];
const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`);
}

function addDays(dateStr, offset) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + offset);
  return formatDate(date);
}

function mondayOf(dateStr) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return formatDate(date);
}

function clockOf(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || isNaN(date.getTime())) return null;
  return { minutes: date.getHours() * 60 + date.getMinutes(), label: `${pad2(date.getHours())}:${pad2(date.getMinutes())}` };
}

// ---------- 饮食：按记录时间归到一餐 ----------
function buildMealGroups(foods) {
  const groups = [];
  (foods || []).forEach((food, index) => {
    const clock = clockOf(food && food.time);
    const minutes = clock ? clock.minutes : 12 * 60;
    const meal = MEALS.find(item => minutes >= item.from && minutes < item.to) || MEALS[MEALS.length - 1];
    let group = groups.find(item => item.key === meal.key);
    if (!group) {
      group = { key: meal.key, label: meal.label, time: clock ? clock.label : '', minutes, calories: 0, items: [], image: '' };
      groups.push(group);
    }
    group.calories += Number(food.calories) || 0;
    group.items.push({
      index,
      name: food.name,
      calories: Math.round(Number(food.calories) || 0),
      weight: food.estimatedWeight ? `${food.estimatedWeight} g` : ''
    });
    if (!group.image && food.imagePath) group.image = food.imagePath;
    if (minutes < group.minutes) {
      group.minutes = minutes;
      if (clock) group.time = clock.label;
    }
  });
  return groups
    .sort((a, b) => a.minutes - b.minutes)
    .map(group => ({
      ...group,
      calories: Math.round(group.calories),
      names: group.items.map(item => item.name).join(' · '),
      image: group.image || (MEALS.find(item => item.key === group.key) || MEALS[0]).image
    }));
}

// ---------- 训练：本周每天次数（周一开始） ----------
function weekTrainingCounts(recordsByDate, today) {
  const start = mondayOf(today);
  const days = WEEK_NAMES.map((label, index) => {
    const date = addDays(start, index);
    const record = recordsByDate[date];
    const count = record && record.type !== 'rest' ? 1 : 0;
    return { date, label, count, isToday: date === today, isRest: !!(record && record.type === 'rest') };
  });
  const max = Math.max(1, ...days.map(day => day.count));
  return days.map(day => ({ ...day, height: Math.round((day.count / max) * 100) }));
}

// ---------- 月历（周一开始） ----------
function calendarMonth(year, month, recordsByDate, today) {
  const first = new Date(year, month - 1, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - offset, 12);
  const weeks = [];
  for (let week = 0; week < 6; week += 1) {
    const cells = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + day);
      const key = formatDate(date);
      const record = recordsByDate[key];
      cells.push({
        date: key,
        day: date.getDate(),
        inMonth: date.getMonth() === month - 1,
        isToday: key === today,
        type: !record ? '' : (record.type === 'rest' ? 'rest' : 'training')
      });
    }
    // 最后一行全是下个月的就不显示
    if (week > 3 && cells.every(cell => !cell.inMonth)) break;
    weeks.push(cells);
  }
  return { title: `${year}年${month}月`, weeks };
}

// ---------- 单日训练详情 ----------
function doneSets(exercise) {
  return (exercise && Array.isArray(exercise.sets) ? exercise.sets : [])
    .map((set, index) => ({ index, weight: Number(set && set.weight) || 0, reps: Number(set && set.reps) || 0, done: !!(set && set.done) }))
    .filter(set => set.done && set.reps > 0 && setTypes.countsForRecord((exercise.sets || [])[set.index]));
}

function trainingDaySummary(record, allRecords) {
  if (!record || record.type === 'rest') return null;
  const exercises = Array.isArray(record.exercises) ? record.exercises : [];
  let volume = 0;
  let setCount = 0;
  const items = exercises.map((exercise, position) => {
    const sets = doneSets(exercise);
    setCount += sets.length;
    sets.forEach(set => { volume += set.weight * set.reps; });
    const prs = progression.findPersonalRecords(allRecords || [], exercise.libraryId || exercise.id);
    const best = prs.bestWeight;
    const isPRDay = !!(best && best.date === record.date);
    return {
      key: `${exercise.id || position}`,
      libraryId: exercise.libraryId || '',
      name: exercise.name || `动作 ${position + 1}`,
      meta: `${(exercise.sets || []).length} 组${exercise.targetPart ? ' · ' + exercise.targetPart : ''}`,
      isPR: isPRDay,
      sets: (exercise.sets || []).map((set, index) => ({
        label: `${setTypes.LABELS[setTypes.typeOf(set)]} ${index + 1}`,
        value: !(set && set.done) ? '未完成' : `${Number(set.weight) ? set.weight + ' kg' : '自重'} × ${set.reps || 0}`,
        done: !!(set && set.done),
        isPR: isPRDay && best && setTypes.countsForRecord(set) && Number(set && set.weight) === best.weight && Number(set && set.reps) === best.reps && !!(set && set.done)
      }))
    };
  });
  const completed = exercises.filter(exercise => exercise.completed || (exercise.sets || []).length > 0 && exercise.sets.every(set => set && set.done)).length;
  return {
    durationMin: Number(record.durationMin) || 0,
    volume: Math.round(volume),
    setCount,
    exerciseCount: exercises.length,
    completed,
    items
  };
}

// ---------- 体重 ----------
function weightSeries(records, rangeDays, today) {
  const from = addDays(today, -(rangeDays - 1));
  const list = (records || []).filter(item => item && item.date >= from && item.date <= today && Number(item.weight) > 0)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const latest = (records || []).slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0] || null;
  const first = list[0];
  const change = latest && first && list.length > 1 ? Math.round((Number(latest.weight) - Number(first.weight)) * 10) / 10 : 0;
  return { points: list.map(item => ({ date: item.date, weight: Number(item.weight) })), latest, change };
}

// 折线图 SVG（data URI），宽高为 viewBox 单位
function lineChartSvg(points, options) {
  const width = (options && options.width) || 640;
  const height = (options && options.height) || 300;
  const pad = { left: 56, right: 24, top: 28, bottom: 44 };
  if (!points || points.length === 0) return '';
  const values = points.map(point => point.weight);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) { min -= 0.5; max += 0.5; }
  min = Math.floor(min * 2) / 2;
  max = Math.ceil(max * 2) / 2;
  const x = index => pad.left + (points.length === 1 ? (width - pad.left - pad.right) / 2 : index * (width - pad.left - pad.right) / (points.length - 1));
  const y = value => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
  const grid = [max, (max + min) / 2, min].map(value => `<line x1='${pad.left}' x2='${width - pad.right}' y1='${y(value).toFixed(1)}' y2='${y(value).toFixed(1)}' stroke='%23E4E2DC' stroke-dasharray='4 6'/>`
    + `<text x='${pad.left - 10}' y='${(y(value) + 5).toFixed(1)}' font-size='16' text-anchor='end' fill='%239A9A95'>${value.toFixed(1)}</text>`).join('');
  const line = points.map((point, index) => `${x(index).toFixed(1)},${y(point.weight).toFixed(1)}`).join(' ');
  const area = `${pad.left},${height - pad.bottom} ${line} ${x(points.length - 1).toFixed(1)},${height - pad.bottom}`;
  const step = Math.max(1, Math.ceil(points.length / 5));
  const dots = points.map((point, index) => {
    const label = index % step === 0 || index === points.length - 1;
    return `<circle cx='${x(index).toFixed(1)}' cy='${y(point.weight).toFixed(1)}' r='6' fill='%23C8F76E' stroke='%23FFFFFF' stroke-width='2'/>`
      + (label ? `<text x='${x(index).toFixed(1)}' y='${(y(point.weight) - 14).toFixed(1)}' font-size='16' text-anchor='middle' fill='%23111517'>${point.weight}</text>`
        + `<text x='${x(index).toFixed(1)}' y='${height - 14}' font-size='15' text-anchor='middle' fill='%239A9A95'>${point.date.slice(5).replace('-', '/')}</text>` : '');
  }).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'>${grid}`
    + `<polygon points='${area}' fill='%23C8F76E' fill-opacity='0.18'/>`
    + `<polyline points='${line}' fill='none' stroke='%23B6E65A' stroke-width='4' stroke-linejoin='round' stroke-linecap='round'/>${dots}</svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
}

// 环形进度 SVG（data URI）
function ringSvg(percent, dark) {
  const c = 2 * Math.PI * 52;
  const p = Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
  const track = dark ? '%23333C41' : '%23E4E2DC';
  return 'data:image/svg+xml;utf8,'
    + `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><circle cx='60' cy='60' r='52' fill='none' stroke='${track}' stroke-width='10'/>`
    + `<circle cx='60' cy='60' r='52' fill='none' stroke='%23C8F76E' stroke-width='10' stroke-linecap='round' stroke-dasharray='${c.toFixed(2)}' stroke-dashoffset='${(c * (1 - p)).toFixed(2)}' transform='rotate(-90 60 60)'/></svg>`;
}

module.exports = {
  WEEK_NAMES,
  addDays,
  mondayOf,
  buildMealGroups,
  weekTrainingCounts,
  calendarMonth,
  trainingDaySummary,
  weightSeries,
  lineChartSvg,
  ringSvg
};
