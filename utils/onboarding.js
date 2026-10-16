// 新用户引导：判断是否需要显示，以及根据选择推荐计划。纯函数。
const ONBOARDING_KEY = 'onboarding_done';

// 已经有任何记录或自建计划的老用户不再显示
function shouldShowOnboarding(state) {
  const s = state || {};
  if (s.done) return false;
  if ((s.trainingDates || []).length || (s.nutritionDates || []).length) return false;
  if ((s.plans || []).some(plan => plan && plan.type === 'custom')) return false;
  return true;
}

const GOALS = {
  muscle: { label: '增肌', profileGoal: 'muscle_gain' },
  fatloss: { label: '减脂', profileGoal: 'fat_loss' },
  health: { label: '保持健康', profileGoal: 'maintain' }
};

// 有基础且想增肌 -> 三分化；其他情况 -> 节奏更温和的健康减脂计划
function recommendPlan(goal, level) {
  if (goal === 'muscle' && level === 'experienced') {
    return { planId: 'builtin_air_split_foundation', reason: '你有训练基础，三分化能让每个部位练得更充分。' };
  }
  if (goal === 'muscle') {
    return { planId: 'builtin_healthy_fat_loss', reason: '先用全身力量训练打好基础，动作熟练后再换三分化。' };
  }
  if (goal === 'fatloss') {
    return { planId: 'builtin_healthy_fat_loss', reason: '力量训练 + 轻有氧 + 恢复，节奏温和、容易坚持。' };
  }
  return { planId: 'builtin_healthy_fat_loss', reason: '规律的力量训练和轻活动，适合长期保持健康。' };
}

// 基本信息填全才生成营养目标资料
function buildProfile(goal, info) {
  const height = Number(info && info.height);
  const weight = Number(info && info.weight);
  const age = Number(info && info.age);
  if (!(height > 80 && height < 250 && weight > 20 && weight < 300 && age >= 10 && age < 100)) return null;
  return {
    height,
    weight,
    age,
    gender: info.gender === 'female' ? 'female' : 'male',
    activityLevel: 'light',
    goal: (GOALS[goal] || GOALS.health).profileGoal
  };
}

module.exports = { ONBOARDING_KEY, GOALS, shouldShowOnboarding, recommendPlan, buildProfile };
