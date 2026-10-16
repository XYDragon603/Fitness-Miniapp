// All functions consume records supplied by the caller and never access storage.
const setTypes = require('./set-types.js');
function number(value, allowEmpty) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return allowEmpty ? 0 : null;
  }
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundWeight(value) { return Math.round(value * 10) / 10; }

function completedSets(exercise, progressionOnly) {
  return (exercise && Array.isArray(exercise.sets) ? exercise.sets : [])
    .filter(set => progressionOnly ? setTypes.countsForProgression(set) : setTypes.countsForRecord(set))
    .map((set, index) => {
      if (!set || set.done !== true) return null;
      const weight = number(set.weight, true);
      const reps = number(set.reps, false);
      return weight !== null && reps !== null && reps > 0 && Number.isInteger(reps) && Number.isFinite(weight * reps)
        ? { index, weight, reps } : null;
    }).filter(Boolean);
}

function exerciseOf(entry) { return entry && (entry.exercise || entry); }
function sameOrArray(values) {
  return values.every(value => value === values[0]) ? values[0] : values;
}
function display(value) { return Array.isArray(value) ? value.join('、') : String(value); }
function none(message) { return { type: 'none', weight: null, reps: null, message }; }

/**
 * history accepts getPreviousExerciseRecords() entries or exercise records, newest first.
 * weight/reps give the first set target for simple consumers. weights/repsBySet retain
 * each plan set's target, including unfinished sets and pyramid prescriptions.
 */
function suggestNextTarget({ planReps, planSets, history, increment } = {}) {
  const result = buildSuggestion({ planReps, planSets, history, increment });
  const latest = exerciseOf(Array.isArray(history) ? history[0] : null);
  const count = Number.isInteger(Number(planSets)) && Number(planSets) > 0
    ? Number(planSets) : (latest && Array.isArray(latest.sets) ? latest.sets.filter(setTypes.countsForProgression).length : 0);
  const weights = result.weight === null ? [] : (Array.isArray(result.weight) ? result.weight : Array(count).fill(result.weight));
  const repsBySet = result.reps === null ? [] : (Array.isArray(result.reps) ? result.reps : Array(count).fill(result.reps));
  return { ...result, weight: weights.length ? weights[0] : null, reps: repsBySet.length ? repsBySet[0] : null, weights, repsBySet };
}

function buildSuggestion({ planReps, planSets, history, increment }) {
  const records = Array.isArray(history) ? history : [];
  const latest = exerciseOf(records[0]);
  const sets = completedSets(latest, true);
  if (!sets.length) return none('还没有已完成的训练组，先按计划完成一次训练。');
  const countValue = number(planSets, false);
  const count = countValue && Number.isInteger(countValue) ? countValue : latest.sets.filter(setTypes.countsForProgression).length;
  // Lazy import also allows util's legacy adapter to call this module without a cycle.
  const meta = require('./util.js').parsePlanRepsMeta(planReps, count);
  if (!meta.options.length || !count) return none('当前次数计划无法计算建议，请先填写明确的次数目标。');
  const perSet = meta.suggestedBySet.some(Boolean);
  const lower = perSet ? meta.suggestedBySet.map(Number) : Array(count).fill(Number(meta.options[0]));
  const upper = perSet ? lower.slice() : Array(count).fill(Number(meta.options[meta.options.length - 1]));
  if (lower.some(value => !Number.isFinite(value) || value <= 0)) return none('请先填写有效的次数目标。');
  const relevant = sets.filter(set => set.index < count);
  if (!relevant.length) return none('还没有与计划对应的已完成训练组。');

  const byIndex = {};
  relevant.forEach(set => { byIndex[set.index] = set; });
  // Missing set weights use the last valid working weight only as a fill-in suggestion.
  const weights = Array.from({ length: count }, (_, index) => byIndex[index]
    ? byIndex[index].weight : relevant[relevant.length - 1].weight);
  const weight = sameOrArray(weights);
  const bodyweight = relevant.every(set => set.weight === 0);
  const allDone = relevant.length === count;
  const atUpper = allDone && relevant.every(set => set.reps >= upper[set.index]);
  const atLower = relevant.every(set => set.reps >= lower[set.index]);
  const belowLower = entry => completedSets(exerciseOf(entry), true)
    .some(set => set.index < count && set.reps < lower[set.index]);
  const failuresTwice = records.length >= 2 && belowLower(records[0]) && belowLower(records[1]);

  if (bodyweight) {
    const reps = sameOrArray(lower.map((target, index) => byIndex[index] ? byIndex[index].reps + 1 : target));
    if (failuresTwice || !atLower) {
      return { type: 'reps', weight: 0, reps: sameOrArray(lower), message: `自重动作先稳定完成计划次数 ${display(sameOrArray(lower))} 次，再逐步增加次数。` };
    }
    return { type: 'reps', weight: 0, reps, message: `自重动作保持动作标准，这次尝试 ${display(reps)} 次。` };
  }

  if (failuresTwice) {
    const nextWeight = sameOrArray(weights.map(value => Math.round(value * 0.9 * 2) / 2));
    const reps = sameOrArray(lower);
    return { type: 'deload', weight: nextWeight, reps,
      message: `连续两次有组未达到计划下限，建议降重约 10% 至 ${display(nextWeight)}kg，先稳定完成 ${display(reps)} 次。` };
  }

  if (atUpper) {
    const step = number(increment, false);
    const nextWeight = sameOrArray(weights.map(value => value === 0 ? 0 : roundWeight(value + (step > 0 ? step : 2.5))));
    const reps = sameOrArray(lower);
    return { type: 'increase', weight: nextWeight, reps,
      message: `上次每组都达到 ${display(sameOrArray(upper))} 次目标，这次试试 ${display(nextWeight)}kg × ${display(reps)}。` };
  }

  const reps = sameOrArray(lower.map((target, index) => byIndex[index] && atLower
    ? Math.min(upper[index], byIndex[index].reps + 1) : target));
  return { type: 'hold', weight, reps, message: atLower
    ? `保持 ${display(weight)}kg，已完成的组各争取多做 1 次，目标 ${display(reps)} 次；先完成全部计划组。`
    : `保持 ${display(weight)}kg，先稳定完成每组 ${display(sameOrArray(lower))} 次。` };
}

function estimateOneRepMax(weight, reps) {
  const w = number(weight, false);
  const r = number(reps, false);
  if (!(w > 0) || !(r > 0) || !Number.isInteger(r) || r > 12) return null;
  const result = roundWeight(w * (1 + r / 30));
  return Number.isFinite(result) ? result : null;
}

function recordsForExercise(records, key, knownExercises) {
  const result = [];
  const aliases = Object.create(null);
  const all = [];
  (Array.isArray(records) ? records : []).forEach(record => {
    if (!record || record.type === 'rest') return;
    const exercises = Array.isArray(record.exercises) ? record.exercises : [exerciseOf(record)];
    exercises.forEach(exercise => {
      if (exercise) all.push({ date: record.date || exercise.date || '', exercise });
    });
  });
  all.map(entry => entry.exercise).concat(knownExercises || []).forEach(exercise => {
    if (!exercise || !exercise.id || !exercise.libraryId) return;
    if (!Object.prototype.hasOwnProperty.call(aliases, exercise.id)) aliases[exercise.id] = exercise.libraryId;
    else if (aliases[exercise.id] !== exercise.libraryId) aliases[exercise.id] = null;
  });
  all.forEach(entry => {
    const exercise = entry.exercise;
    // A unique id/library relationship can identify legacy results without rewriting them.
    if ((exercise.libraryId || aliases[exercise.id] || exercise.id) === key) result.push(entry);
  });
  return result;
}

function resolveExerciseKey(exercise, knownExercises) {
  if (!exercise) return '';
  if (exercise.libraryId) return exercise.libraryId;
  const ids = [...new Set((knownExercises || []).filter(item => item && item.id === exercise.id && item.libraryId).map(item => item.libraryId))];
  return ids.length === 1 ? ids[0] : exercise.id;
}
function findPersonalRecords(records, key, knownExercises) {
  const best = { bestWeight: null, bestE1RM: null, bestVolume: null };
  if (!key) return best;
  recordsForExercise(records, key, knownExercises).forEach(({ date, exercise }) => {
    const sets = completedSets(exercise);
    let volume = 0;
    sets.forEach(set => {
      if (set.weight > 0 && (!best.bestWeight || set.weight > best.bestWeight.weight)) {
        best.bestWeight = { weight: set.weight, reps: set.reps, date };
      }
      const e1rm = estimateOneRepMax(set.weight, set.reps);
      if (e1rm !== null && (!best.bestE1RM || e1rm > best.bestE1RM.e1rm)) {
        best.bestE1RM = { weight: set.weight, reps: set.reps, e1rm, date };
      }
      volume += set.weight * set.reps;
    });
    volume = roundWeight(volume);
    if (Number.isFinite(volume) && volume > 0 && (!best.bestVolume || volume > best.bestVolume.volume)) best.bestVolume = { volume, date };
  });
  return best;
}

// Each item contains type ('bestWeight' / 'bestE1RM' / 'bestVolume') and PR fields.
function detectNewRecords(todayExercise, previousPRs) {
  const exercise = exerciseOf(todayExercise);
  if (!exercise) return [];
  const key = exercise.libraryId || exercise.id;
  const current = findPersonalRecords([todayExercise], key);
  const previous = previousPRs || {};
  const metrics = { bestWeight: 'weight', bestE1RM: 'e1rm', bestVolume: 'volume' };
  // The first recorded workout establishes a baseline instead of showing three PRs.
  if (!Object.keys(metrics).some(type => previous[type])) return [];
  return Object.keys(metrics).filter(type => current[type] && (!previous[type]
    || current[type][metrics[type]] > previous[type][metrics[type]]))
    .map(type => ({ type, ...current[type] }));
}

module.exports = { suggestNextTarget, estimateOneRepMax, findPersonalRecords, detectNewRecords, recordsForExercise, completedSets, resolveExerciseKey };
