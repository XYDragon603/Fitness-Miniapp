const DEFAULT_REST_SEC = 90;
const REST_PRESETS = [60, 90, 120, 180];

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function createTimer(durationSec, startedAt) {
  const duration = Math.max(0, finiteNumber(durationSec, DEFAULT_REST_SEC));
  const start = finiteNumber(startedAt, 0);
  return { durationSec: duration, startedAt: start, endsAt: start + duration * 1000 };
}

function getRemaining(timer, now) {
  if (!timer || !Number.isFinite(timer.endsAt)) return 0;
  return Math.max(0, Math.ceil((timer.endsAt - finiteNumber(now, timer.startedAt)) / 1000));
}

// Pass now when adjusting a running timer; the two-argument form adjusts its full duration.
function adjust(timer, deltaSec, now) {
  if (!timer) return null;
  const reference = finiteNumber(now, timer.startedAt);
  const endsAt = Math.max(reference, timer.endsAt + finiteNumber(deltaSec, 0) * 1000);
  return { ...timer, durationSec: Math.max(0, (endsAt - timer.startedAt) / 1000), endsAt };
}

function isFinished(timer, now) {
  return getRemaining(timer, now) === 0;
}

module.exports = { DEFAULT_REST_SEC, REST_PRESETS, createTimer, getRemaining, adjust, isFinished };
