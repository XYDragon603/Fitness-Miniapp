const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
};

const PORTION_PRESETS = {
  small: 0.8,
  standard: 1,
  large: 1.25
};

const ALLOWED_GUIDE_HOSTS = [
  'bilibili.com',
  'b23.tv',
  'douyin.com',
  'iesdouyin.com',
  'xiaohongshu.com',
  'xhslink.com'
];

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function roundInt(value) {
  return Math.round(Number(value) || 0);
}

function calculateBmr(profile) {
  const weight = Number(profile.weight) || 0;
  const height = Number(profile.height) || 0;
  const age = Number(profile.age) || 0;
  const gender = profile.gender === 'female' ? 'female' : 'male';
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'female' ? base - 161 : base + 5;
}

function calculateNutritionTargets(profile) {
  const activityFactor = ACTIVITY_FACTORS[profile.activityLevel] || ACTIVITY_FACTORS.light;
  const weight = Number(profile.weight) || 0;
  const age = Number(profile.age) || 0;
  const goal = profile.goal || 'maintain';
  const bmr = calculateBmr(profile);
  const tdee = roundInt(bmr * activityFactor);
  const dailyCalories = goal === 'custom'
    ? roundInt(profile.dailyCalories)
    : roundInt(tdee * (goal === 'muscle_gain' ? 1.08 : 1));
  const proteinTarget = round1(weight * (goal === 'muscle_gain' ? 1.6 : 1.4));
  const fatRange = {
    min: round1((dailyCalories * 0.2) / 9),
    max: round1((dailyCalories * 0.35) / 9)
  };
  const fatReference = round1((dailyCalories * 0.26) / 9);
  const carbTarget = roundInt(
    Math.max(0, dailyCalories - proteinTarget * 4 - fatReference * 9) / 4
  );

  return {
    bmr: roundInt(bmr),
    tdee,
    dailyCalories,
    proteinTarget,
    fatRange,
    fatReference,
    carbTarget,
    isMinor: age > 0 && age < 18,
    guidanceMode: age > 0 && age < 18 ? 'gentle' : 'standard'
  };
}

function getPortionMultiplier(portionKey, customGrams, baseWeight) {
  if (portionKey === 'custom') {
    const customWeight = Number(customGrams) || 0;
    const originalWeight = Number(baseWeight) || 0;
    if (customWeight > 0 && originalWeight > 0) {
      return customWeight / originalWeight;
    }
    return 1;
  }

  return PORTION_PRESETS[portionKey] || PORTION_PRESETS.standard;
}

function createPortionAdjustedFood(food, options) {
  const baseWeight = Number(food.baseWeight || food.estimatedWeight) || 100;
  const portionKey = options && options.portionKey ? options.portionKey : 'standard';
  const customGrams = options ? options.customGrams : '';
  const multiplier = getPortionMultiplier(portionKey, customGrams, baseWeight);
  const estimatedWeight = portionKey === 'custom'
    ? roundInt(customGrams || baseWeight)
    : roundInt(baseWeight * multiplier);

  return {
    ...food,
    baseWeight,
    portionKey,
    customGrams: portionKey === 'custom' ? String(customGrams || estimatedWeight) : '',
    portionMultiplier: round1(multiplier),
    estimatedWeight,
    calories: roundInt((Number(food.baseCalories || food.calories) || 0) * multiplier),
    protein: round1((Number(food.baseProtein || food.protein) || 0) * multiplier),
    fat: round1((Number(food.baseFat || food.fat) || 0) * multiplier),
    carbs: round1((Number(food.baseCarbs || food.carbs) || 0) * multiplier)
  };
}

function sanitizeGuideUrl(url) {
  if (!url) {
    return '';
  }

  const value = String(url).trim();
  if (!value) {
    return '';
  }

  try {
    const hostMatch = value.match(/^https?:\/\/([^\/?#]+)/i);
    if (!hostMatch || !hostMatch[1]) {
      return '';
    }

    const host = hostMatch[1].replace(/^www\./i, '').toLowerCase();
    return ALLOWED_GUIDE_HOSTS.some(item => host === item || host.endsWith(`.${item}`))
      ? value
      : '';
  } catch (error) {
    return '';
  }
}

module.exports = {
  ACTIVITY_FACTORS,
  PORTION_PRESETS,
  calculateNutritionTargets,
  createPortionAdjustedFood,
  sanitizeGuideUrl
};
