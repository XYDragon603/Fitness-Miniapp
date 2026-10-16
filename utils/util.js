const { calculateNutritionTargets } = require('./mvp-core.js');

const NUTRITION_GOAL_PROFILE_KEY = 'nutrition_goal_profile';
const FAT_LOSS_PROFILE_KEY = 'fat_loss_profile';
const FAT_LOSS_WEIGHT_RECORDS_KEY = 'fat_loss_weight_records';

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateCN(dateStr) {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}月${day}日 ${weekDays[date.getDay()]}`;
}

function getToday() {
  return formatDate(new Date());
}

function isRestDay(day) {
  return !!(day && day.type === 'rest');
}

function isRestRecord(record) {
  return !!(record && record.type === 'rest');
}

function getRecordType(record) {
  return isRestRecord(record) ? 'rest' : 'training';
}

function getRecentDays(count) {
  const days = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(formatDate(date));
  }
  return days;
}

function saveTrainingRecord(dateOrRecord, maybeRecord) {
  const record = maybeRecord || dateOrRecord;
  const date = maybeRecord ? dateOrRecord : (record && record.date);

  if (!date || !record) {
    return;
  }

  const key = `training_${date}`;
  wx.setStorageSync(key, record);

  const dates = getTrainingDates();
  if (!dates.includes(date)) {
    dates.unshift(date);
    dates.sort((a, b) => b.localeCompare(a));
    wx.setStorageSync('training_dates', dates);
  }
}

function getTrainingRecord(date) {
  return wx.getStorageSync(`training_${date}`) || null;
}

function getTrainingRecordByDate(date) {
  return date ? getTrainingRecord(date) : null;
}

function getTrainingDates() {
  return wx.getStorageSync('training_dates') || [];
}

function getRecordDayId(record) {
  return record && (record.dayId || record.dayType) ? (record.dayId || record.dayType) : '';
}

function createRestRecord(day, plan, date, formData) {
  return {
    date,
    type: 'rest',
    planId: plan && plan.id ? plan.id : '',
    planName: plan && plan.title ? plan.title : '',
    planTitle: plan && plan.title ? plan.title : '',
    dayId: day && day.id ? day.id : '',
    dayType: 'rest',
    dayName: day && day.name ? day.name : '休息日',
    dayColor: day && day.color ? day.color : '#5F9A88',
    restCompleted: formData ? formData.restCompleted !== false : true,
    feeling: formData && formData.feeling ? formData.feeling : '',
    note: formData && formData.note ? formData.note : '',
    createdAt: new Date().toISOString()
  };
}

function getPreviousExerciseRecords(exerciseId, beforeDate, limit, libraryId) {
  if (!exerciseId) {
    return [];
  }

  const maxCount = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 2;
  const matches = [];
  const dates = getTrainingDates();

  for (let i = 0; i < dates.length; i += 1) {
    const date = dates[i];
    if (beforeDate && date >= beforeDate) {
      continue;
    }

    const record = getTrainingRecord(date);
    if (!record || !Array.isArray(record.exercises)) {
      continue;
    }

    const exercise = record.exercises.find(item => item && (libraryId
      ? (item.libraryId === libraryId || (!item.libraryId && item.id === exerciseId))
      : item.id === exerciseId));
    if (!exercise) {
      continue;
    }

    matches.push({
      date,
      dayType: record.dayType || '',
      dayName: record.dayName || '',
      week: record.week || 1,
      exercise
    });

    if (matches.length >= maxCount) {
      break;
    }
  }

  return matches;
}

function getPreviousExerciseRecord(exerciseId, beforeDate) {
  return getPreviousExerciseRecords(exerciseId, beforeDate, 1)[0] || null;
}

function copyWeightTemplateFromRecord(previousExercise, currentSetCount) {
  const total = Number.isFinite(currentSetCount) && currentSetCount > 0 ? Math.floor(currentSetCount) : 0;
  const sets = previousExercise && Array.isArray(previousExercise.sets) ? previousExercise.sets : [];

  return Array.from({ length: total }).map((_, index) => {
    const set = sets[index];
    return set && set.weight !== undefined && set.weight !== null ? String(set.weight) : '';
  });
}

function deleteTrainingRecord(date) {
  wx.removeStorageSync(`training_${date}`);
  const dates = getTrainingDates().filter(item => item !== date);
  wx.setStorageSync('training_dates', dates);
}

function saveNutritionRecords(date, records) {
  wx.setStorageSync(`nutrition_${date}`, records);

  const dates = getNutritionDates();
  if (!dates.includes(date)) {
    dates.unshift(date);
    dates.sort((a, b) => b.localeCompare(a));
    wx.setStorageSync('nutrition_dates', dates);
  }
}

function getNutritionRecords(date) {
  return wx.getStorageSync(`nutrition_${date}`) || [];
}

function getNutritionDates() {
  return wx.getStorageSync('nutrition_dates') || [];
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function roundInt(value) {
  return Math.round(Number(value) || 0);
}

function extractNutritionTotal(record) {
  if (!record) {
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  }

  if (record.total && typeof record.total === 'object') {
    return {
      calories: Math.round(Number(record.total.calories) || 0),
      protein: round1(record.total.protein),
      fat: round1(record.total.fat),
      carbs: round1(record.total.carbs)
    };
  }

  if (Array.isArray(record.foods)) {
    return record.foods.reduce((sum, item) => ({
      calories: sum.calories + (Number(item && item.calories) || 0),
      protein: round1(sum.protein + (Number(item && item.protein) || 0)),
      fat: round1(sum.fat + (Number(item && item.fat) || 0)),
      carbs: round1(sum.carbs + (Number(item && item.carbs) || 0))
    }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
  }

  return {
    calories: Math.round(Number(record.calories) || 0),
    protein: round1(record.protein),
    fat: round1(record.fat),
    carbs: round1(record.carbs)
  };
}

function calcCompletionRate(record) {
  if (!record || !Array.isArray(record.exercises) || record.exercises.length === 0) {
    return 0;
  }

  const completed = record.exercises.filter(item => item && item.completed).length;
  return Math.round((completed / record.exercises.length) * 100);
}

function calcDailyNutrition(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  }

  return records.reduce((sum, item) => {
    const total = extractNutritionTotal(item);
    return {
      calories: sum.calories + total.calories,
      protein: round1(sum.protein + total.protein),
      fat: round1(sum.fat + total.fat),
      carbs: round1(sum.carbs + total.carbs)
    };
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });
}

function getFallbackDayColor(dayKey, index) {
  const palette = {
    day1: '#C96565',
    day2: '#4F9CC4',
    day3: '#4EAE7D',
    rest: '#5F9A88'
  };

  if (dayKey && palette[dayKey]) {
    return palette[dayKey];
  }

  const extraPalette = ['#C96565', '#4F9CC4', '#4EAE7D', '#C89155', '#7286DA'];
  return extraPalette[index % extraPalette.length];
}

function getCalendarRecordType(record) {
  if (isRestRecord(record)) {
    return 'rest';
  }

  return getRecordDayId(record) || record.dayType || 'training';
}

function parsePlanRepsMeta(planReps, setCount) {
  const raw = String(planReps || '').trim();
  const totalSets = Number.isFinite(setCount) && setCount > 0 ? Math.floor(setCount) : 0;

  if (!raw) {
    return {
      options: [],
      suggestedBySet: Array.from({ length: totalSets }).map(() => '')
    };
  }

  const commaValues = raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (commaValues.length > 1 && commaValues.every(item => /^\d+$/.test(item))) {
    return {
      options: commaValues,
      suggestedBySet: Array.from({ length: totalSets }).map((_, index) => commaValues[index] || commaValues[commaValues.length - 1] || '')
    };
  }

  const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const lower = Math.min(start, end);
    const upper = Math.max(start, end);
    const options = [];

    for (let value = lower; value <= upper; value += 1) {
      options.push(String(value));
    }

    return {
      options,
      suggestedBySet: Array.from({ length: totalSets }).map(() => '')
    };
  }

  if (/^\d+$/.test(raw)) {
    return {
      options: [raw],
      suggestedBySet: Array.from({ length: totalSets }).map(() => raw)
    };
  }

  return {
    options: [],
    suggestedBySet: Array.from({ length: totalSets }).map(() => '')
  };
}

function buildWeightOptions(referenceWeight) {
  const options = [];

  for (let value = 0; value <= 100; value += 5) {
    options.push(String(value));
  }

  return options;
}

function getTrainingCount(records) {
  return (Array.isArray(records) ? records : []).filter(record => !isRestRecord(record)).length;
}

function getRestDayCount(records) {
  return (Array.isArray(records) ? records : []).filter(record => isRestRecord(record)).length;
}

function getTrainingStats() {
  const dates = getTrainingDates();
  const dayTypeCount = { day1: 0, day2: 0, day3: 0 };
  const distributionMap = {};
  const records = [];
  let totalExercises = 0;
  let completedExercises = 0;
  let restDays = 0;

  dates.forEach(date => {
    const record = getTrainingRecord(date);
    if (!record) {
      return;
    }

    records.push(record);

    const restRecord = isRestRecord(record);
    const distributionKey = restRecord
      ? 'rest'
      : (record.dayId || record.dayType || record.dayName || 'unknown');

    if (!distributionMap[distributionKey]) {
      distributionMap[distributionKey] = {
        key: distributionKey,
        name: restRecord ? (record.dayName || '休息日') : (record.dayName || record.dayId || '训练记录'),
        color: record.dayColor || getFallbackDayColor(restRecord ? 'rest' : (record.dayType || record.dayId), Object.keys(distributionMap).length),
        count: 0
      };
    }
    distributionMap[distributionKey].count += 1;

    if (restRecord) {
      restDays += 1;
      return;
    }

    if (!Array.isArray(record.exercises)) {
      return;
    }

    record.exercises.forEach(item => {
      totalExercises += 1;
      if (item && item.completed) {
        completedExercises += 1;
      }
    });

    if (record.dayType && dayTypeCount[record.dayType] !== undefined) {
      dayTypeCount[record.dayType] += 1;
    }
  });

  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    if (dates.includes(dateStr)) {
      streak += 1;
    } else if (i > 0) {
      break;
    }
  }

  const distributionGroups = Object.values(distributionMap)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.name.localeCompare(right.name, 'zh-Hans-CN');
    });

  const totalDays = getTrainingCount(records);

  return {
    totalDays,
    restDays,
    planRecordedDays: totalDays + getRestDayCount(records),
    totalExercises,
    completedExercises,
    completionRate: totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0,
    streak,
    dayTypeCount,
    distributionGroups
  };
}

function isExerciseStable(exercise) {
  if (!exercise || !Array.isArray(exercise.sets) || exercise.sets.length === 0) {
    return false;
  }

  if (exercise.completed) {
    return true;
  }

  const doneCount = exercise.sets.filter(set => {
    if (!set) {
      return false;
    }

    if (set.done) {
      return true;
    }

    if (typeof set.reps === 'number') {
      return set.reps > 0;
    }

    if (typeof set.reps === 'string') {
      return set.reps.trim().length > 0;
    }

    return false;
  }).length;

  return doneCount >= Math.max(1, exercise.sets.length - 1);
}

function getProgressiveOverloadSuggestion(exerciseId, beforeDate) {
  const records = getPreviousExerciseRecords(exerciseId, beforeDate, 2);
  if (!records.length) {
    return { show: false, message: '' };
  }
  const previous = records[0].exercise;
  const suggestion = require('./progression.js').suggestNextTarget({
    planReps: previous.planReps,
    planSets: previous.planSets || (previous.sets || []).length,
    history: records
  });
  return { ...suggestion, show: suggestion.type !== 'none' };
}

function getTrainingCalendarData(year, month) {
  const fallback = new Date();
  const firstDay = new Date(
    Number.isFinite(year) ? Math.floor(year) : fallback.getFullYear(),
    Number.isFinite(month) ? Math.floor(month) - 1 : fallback.getMonth(),
    1
  );
  const normalizedYear = firstDay.getFullYear();
  const normalizedMonth = firstDay.getMonth() + 1;
  const lastDate = new Date(normalizedYear, normalizedMonth, 0).getDate();
  const startWeekDay = firstDay.getDay();
  const weeks = [];
  let currentWeek = [];

  for (let i = 0; i < startWeekDay; i += 1) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const date = formatDate(new Date(normalizedYear, normalizedMonth - 1, day));
    const record = getTrainingRecord(date);
    const recordType = getRecordType(record);
    const dayType = record ? getCalendarRecordType(record) : '';

    currentWeek.push({
      day,
      date,
      hasRecord: !!record,
      dayType,
      dayName: record && record.dayName ? record.dayName : '',
      recordType: record ? recordType : '',
      color: record ? (record.dayColor || getFallbackDayColor(dayType, 0)) : ''
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push(null);
  }

  if (currentWeek.length === 7) {
    weeks.push(currentWeek);
  }

  return {
    year: normalizedYear,
    month: normalizedMonth,
    weeks
  };
}

function saveNutritionGoalProfile(profile) {
  wx.setStorageSync(NUTRITION_GOAL_PROFILE_KEY, profile || {});
}

function getNutritionGoalProfile() {
  return wx.getStorageSync(NUTRITION_GOAL_PROFILE_KEY) || null;
}

function getNutritionGoal() {
  const profile = getNutritionGoalProfile();
  if (!profile) {
    return null;
  }

  return calculateNutritionTargets(profile);
}

function saveFatLossProfile(profile) {
  wx.setStorageSync(FAT_LOSS_PROFILE_KEY, profile || null);
}

function getFatLossProfile() {
  return wx.getStorageSync(FAT_LOSS_PROFILE_KEY) || null;
}

function saveFatLossHabits(date, record) {
  if (!date) {
    return;
  }

  wx.setStorageSync(`fat_loss_habits_${date}`, record);

  const dates = getFatLossHabitDates();
  if (!dates.includes(date)) {
    dates.unshift(date);
    dates.sort((a, b) => b.localeCompare(a));
    wx.setStorageSync('fat_loss_habit_dates', dates);
  }
}

function getFatLossHabits(date) {
  return wx.getStorageSync(`fat_loss_habits_${date}`) || null;
}

function getFatLossHabitDates() {
  return wx.getStorageSync('fat_loss_habit_dates') || [];
}

function saveFatLossWeightRecord(date, weight, note) {
  if (!date) {
    return;
  }

  const records = getFatLossWeightRecords().filter(item => item && item.date !== date);
  records.push({
    date,
    weight: Number(weight),
    note: note || '',
    time: new Date().toISOString()
  });
  records.sort((left, right) => left.date.localeCompare(right.date));
  wx.setStorageSync(FAT_LOSS_WEIGHT_RECORDS_KEY, records);
}

function getFatLossWeightRecords() {
  return wx.getStorageSync(FAT_LOSS_WEIGHT_RECORDS_KEY) || [];
}

function getFatLossWeeklySummary() {
  const recentDates = getRecentDays(7);
  const habitRecords = recentDates
    .map(date => getFatLossHabits(date))
    .filter(Boolean);
  const nutritionTotals = recentDates
    .map(date => calcDailyNutrition(getNutritionRecords(date)))
    .filter(item => item.calories > 0 || item.protein > 0 || item.fat > 0 || item.carbs > 0);
  const trainingRecords = recentDates
    .map(date => getTrainingRecord(date))
    .filter(Boolean);
  const totalHabitChecks = habitRecords.reduce((sum, item) => {
    return sum + Object.values(item && item.habits ? item.habits : {}).filter(Boolean).length;
  }, 0);

  return {
    trainingCount: getTrainingCount(trainingRecords),
    restDays: getRestDayCount(trainingRecords),
    avgCalories: nutritionTotals.length
      ? roundInt(nutritionTotals.reduce((sum, item) => sum + item.calories, 0) / nutritionTotals.length)
      : 0,
    avgProtein: nutritionTotals.length
      ? round1(nutritionTotals.reduce((sum, item) => sum + item.protein, 0) / nutritionTotals.length)
      : 0,
    habitCompletionRate: habitRecords.length
      ? roundInt((totalHabitChecks / (habitRecords.length * 7)) * 100)
      : 0,
    latestWeight: getFatLossWeightRecords().slice(-1)[0] || null
  };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

module.exports = {
  formatDate,
  formatDateCN,
  getToday,
  isRestDay,
  isRestRecord,
  getRecentDays,
  saveTrainingRecord,
  getTrainingRecord,
  getTrainingRecordByDate,
  getTrainingDates,
  createRestRecord,
  getPreviousExerciseRecords,
  getPreviousExerciseRecord,
  copyWeightTemplateFromRecord,
  deleteTrainingRecord,
  saveNutritionRecords,
  getNutritionRecords,
  getNutritionDates,
  calcCompletionRate,
  calcDailyNutrition,
  getTrainingCount,
  getRestDayCount,
  getTrainingStats,
  getProgressiveOverloadSuggestion,
  getTrainingCalendarData,
  getCalendarRecordType,
  parsePlanRepsMeta,
  buildWeightOptions,
  getRecordDayId,
  saveNutritionGoalProfile,
  getNutritionGoalProfile,
  getNutritionGoal,
  saveFatLossProfile,
  getFatLossProfile,
  saveFatLossHabits,
  getFatLossHabits,
  getFatLossHabitDates,
  saveFatLossWeightRecord,
  getFatLossWeightRecords,
  getFatLossWeeklySummary,
  generateId
};
