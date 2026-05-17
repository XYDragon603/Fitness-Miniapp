const { sanitizeGuideUrl } = require('./mvp-core.js');

const WORKOUT_PLANS_KEY = 'workout_plans';
const ACTIVE_PLAN_ID_KEY = 'active_plan_id';
const MAX_CUSTOM_DAYS = Number.MAX_SAFE_INTEGER;
const BUILTIN_SPLIT_VIDEO_URL = 'https://v.douyin.com/B434DIjlBVI/';
const DEFAULT_REST_DAY_COLOR = '#5F9A88';
const TRAINING_DAY_COLORS = ['#C96565', '#4F9CC4', '#4EAE7D', '#C89155', '#7286DA', '#5FA396'];
const TRAINING_DAY_ICONS = ['🏋️', '💪', '🔥', '🏃', '🏆', '⚡'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createGuide(guide) {
  const safeUrl = sanitizeGuideUrl(guide && guide.videoUrl ? guide.videoUrl : '');

  return {
    summary: guide && guide.summary ? guide.summary : '训练动作说明会结合计划持续补充，先按稳定动作质量完成记录。',
    targetMuscles: Array.isArray(guide && guide.targetMuscles) ? guide.targetMuscles : [],
    commonMistakes: Array.isArray(guide && guide.commonMistakes) ? guide.commonMistakes : [],
    tips: Array.isArray(guide && guide.tips) ? guide.tips : [],
    videoTitle: safeUrl ? (guide.videoTitle || '查看教学链接') : '教学内容稍后补充',
    videoUrl: safeUrl
  };
}

function createExercise(id, name, targetPart, sets, reps, note, guide) {
  const builtinGuide = /^day\d+_ex\d+$/.test(id)
    ? {
        ...(guide || {}),
        videoTitle: guide && guide.videoTitle ? guide.videoTitle : '查看三分化训练教学',
        videoUrl: guide && guide.videoUrl ? guide.videoUrl : BUILTIN_SPLIT_VIDEO_URL
      }
    : guide;

  return {
    id,
    name,
    targetPart,
    weeks: {
      1: {
        sets,
        reps,
        note
      }
    },
    guide: createGuide(builtinGuide)
  };
}

function createRestDay(overrides) {
  return {
    id: 'day4_rest',
    type: 'rest',
    name: '休息日',
    icon: '🌿',
    color: DEFAULT_REST_DAY_COLOR,
    focus: '恢复 · 拉伸 · 放松',
    description: '恢复也是训练计划的一部分。今天可以轻松活动、拉伸或完全休息。',
    note: '今天可以散步、拉伸、早睡，帮助身体恢复。',
    exercises: [],
    ...(overrides || {})
  };
}

function buildDefaultPlan() {
  return {
    id: 'builtin_air_split_foundation',
    type: 'builtin',
    title: '凯圣王和谭成义三分化训练参考',
    notice: '以稳定动作质量和连续记录为优先。每组重量以可控、完整、不做过度代偿为参考，必要时主动降低难度。',
    days: [
      {
        id: 'day1',
        type: 'training',
        name: '胸 · 三角肌中束 · 三头',
        icon: '🏋️',
        color: '#C96565',
        exercises: [
          createExercise('day1_ex1', '杠铃卧推', '胸部', 4, '15, 12, 10, 8', '保持肩胛稳定，按自己能控制的重量完成。', {
            summary: '平板推举基础动作，重点照顾胸大肌和推的整体力量。',
            targetMuscles: ['胸大肌', '三角肌前束', '肱三头肌'],
            commonMistakes: ['肩膀前顶', '下放过快', '借桥过多'],
            tips: ['脚跟稳定踩地', '肩胛后缩下沉', '下放到胸中下部更稳定']
          }),
          createExercise('day1_ex2', '哑铃上斜卧推', '上胸', 4, '12', '优先保持上胸发力感和动作节奏。', {
            summary: '上斜推举更强调上胸和肩前束的参与。',
            targetMuscles: ['胸大肌上束', '三角肌前束'],
            commonMistakes: ['角度过高变成肩推', '手臂后折'],
            tips: ['凳面保持 30-45 度', '顶端不要完全撞铃']
          }),
          createExercise('day1_ex3', '双杠臂屈伸', '胸/三头', 3, '8-12', '做不到标准版时先用辅助版。', {
            summary: '利用自重训练胸部下束和肱三头肌。',
            targetMuscles: ['胸大肌下束', '肱三头肌'],
            commonMistakes: ['耸肩下沉过深', '摆动过大'],
            tips: ['先锁定肩胛', '动作全程保持控制']
          }),
          createExercise('day1_ex4', '绳索下压', '三头', 3, '12-15', '在推类动作后做补充训练。', {
            summary: '孤立刺激肱三头肌，帮助补足手臂推力。',
            targetMuscles: ['肱三头肌'],
            commonMistakes: ['上臂晃动太大'],
            tips: ['上臂贴近身体', '顶峰稍停']
          }),
          createExercise('day1_ex5', '哑铃侧平举', '三角肌中束', 3, '12-15', '重量宁轻勿重，优先找到肩部发力。', {
            summary: '用于补充三角肌中束，改善肩部宽度观感。',
            targetMuscles: ['三角肌中束'],
            commonMistakes: ['耸肩代偿', '借重摆'],
            tips: ['小拇指略高一点更容易找到中束']
          })
        ]
      },
      {
        id: 'day2',
        type: 'training',
        name: '背 · 三角肌后束 · 二头',
        icon: '💪',
        color: '#4F9CC4',
        exercises: [
          createExercise('day2_ex1', '高位下拉', '背部', 4, '12', '动作顶端主动拉长，底端停一下找背。', {
            summary: '建立背阔肌下拉发力感的经典动作。',
            targetMuscles: ['背阔肌', '大圆肌', '肱二头肌'],
            commonMistakes: ['只用手拉', '身体后仰过多'],
            tips: ['先沉肩再拉肘', '回程不要直接放掉']
          }),
          createExercise('day2_ex2', '坐姿划船', '中背', 4, '12', '注意肩胛前伸后缩的完整节奏。', {
            summary: '帮助增加中背厚度和肩胛控制。',
            targetMuscles: ['背阔肌', '菱形肌', '斜方肌中束'],
            commonMistakes: ['含胸划船', '身体晃动'],
            tips: ['肘部向后划向腰侧']
          }),
          createExercise('day2_ex3', '单臂哑铃划船', '背部', 3, '10-12', '单侧训练有助于左右侧控制。', {
            summary: '单侧划船更容易修正发力差异。',
            targetMuscles: ['背阔肌', '菱形肌'],
            commonMistakes: ['耸肩抢力', '扭转身体'],
            tips: ['胸口保持稳定，肘带动而不是手拽']
          }),
          createExercise('day2_ex4', '面拉', '后束', 3, '12-15', '轻重量慢节奏完成，重视肩胛稳定。', {
            summary: '改善肩后束和上背稳定，非常适合久坐人群。',
            targetMuscles: ['三角肌后束', '斜方肌中下束'],
            commonMistakes: ['拉到胸前就结束', '手肘下垂'],
            tips: ['绳索拉向眉眼位置']
          }),
          createExercise('day2_ex5', '哑铃弯举', '二头', 3, '10-12', '控制下放，不要靠腰部甩起来。', {
            summary: '基础二头训练动作，便于记录进步。',
            targetMuscles: ['肱二头肌'],
            commonMistakes: ['借腰摆动'],
            tips: ['上臂贴近身体两侧']
          })
        ]
      },
      {
        id: 'day3',
        type: 'training',
        name: '腿 · 臀 · 股四头肌',
        icon: '🔥',
        color: '#4EAE7D',
        exercises: [
          createExercise('day3_ex1', '杯式深蹲', '腿部', 4, '12', '先稳定下蹲路线，再逐步增加重量。', {
            summary: '适合作为第一版计划里的腿部基础动作。',
            targetMuscles: ['股四头肌', '臀大肌', '核心'],
            commonMistakes: ['塌腰', '膝盖内扣'],
            tips: ['脚掌稳定受力', '下蹲时膝盖跟脚尖同向']
          }),
          createExercise('day3_ex2', '罗马尼亚硬拉', '后链', 4, '10-12', '重视臀腿后侧拉伸感。', {
            summary: '后链基础动作，帮助建立臀腿后侧力量。',
            targetMuscles: ['臀大肌', '腘绳肌', '竖脊肌'],
            commonMistakes: ['下放时弯腰', '杠铃离腿太远'],
            tips: ['髋向后坐，背部保持中立']
          }),
          createExercise('day3_ex3', '保加利亚分腿蹲', '腿/臀', 3, '10-12', '左右侧分开记录更容易发现差异。', {
            summary: '兼顾稳定性和单腿力量的动作。',
            targetMuscles: ['股四头肌', '臀大肌'],
            commonMistakes: ['站距太窄', '身体晃动明显'],
            tips: ['重心放在前脚全脚掌上']
          }),
          createExercise('day3_ex4', '臀桥', '臀部', 3, '12-15', '顶峰位置稍停，感受臀部发力。', {
            summary: '适合补充臀部训练与髋伸控制。',
            targetMuscles: ['臀大肌', '腘绳肌'],
            commonMistakes: ['顶峰靠腰顶起'],
            tips: ['先收腹，再主动夹臀']
          }),
          createExercise('day3_ex5', '提踵', '小腿', 3, '15-20', '动作全程做满，底端停一下。', {
            summary: '轻量补充小腿训练，帮助下肢整体平衡。',
            targetMuscles: ['腓肠肌', '比目鱼肌'],
            commonMistakes: ['只做半程'],
            tips: ['顶峰稍停，底端拉长']
          })
        ]
      },
      createRestDay()
    ]
  };
}

function normalizeGuide(guide) {
  return createGuide(guide || {});
}

function normalizeExercise(exercise, exerciseIndex) {
  const weekPlan = exercise && exercise.weeks && exercise.weeks[1]
    ? exercise.weeks[1]
    : {};

  return {
    id: exercise && exercise.id ? exercise.id : `exercise_${exerciseIndex + 1}`,
    name: exercise && exercise.name ? exercise.name : `动作 ${exerciseIndex + 1}`,
    targetPart: exercise && exercise.targetPart ? exercise.targetPart : '',
    weeks: {
      1: {
        sets: Number(weekPlan.sets) || 3,
        reps: weekPlan.reps || '10-12',
        note: weekPlan.note || ''
      }
    },
    guide: normalizeGuide(exercise && exercise.guide)
  };
}

function normalizeDay(day, dayIndex) {
  const type = day && day.type === 'rest' ? 'rest' : 'training';
  const fallbackColor = type === 'rest'
    ? DEFAULT_REST_DAY_COLOR
    : TRAINING_DAY_COLORS[dayIndex % TRAINING_DAY_COLORS.length];
  const fallbackIcon = type === 'rest'
    ? '🌿'
    : TRAINING_DAY_ICONS[dayIndex % TRAINING_DAY_ICONS.length];

  return {
    id: day && day.id ? day.id : `${type}_day_${dayIndex + 1}`,
    type,
    name: day && day.name ? day.name : (type === 'rest' ? '休息日' : `训练日 ${dayIndex + 1}`),
    icon: day && day.icon ? day.icon : fallbackIcon,
    color: day && day.color ? day.color : fallbackColor,
    focus: day && day.focus ? day.focus : '',
    description: day && day.description ? day.description : '',
    note: day && day.note ? day.note : '',
    exercises: type === 'rest'
      ? []
      : (Array.isArray(day && day.exercises)
        ? day.exercises.map(normalizeExercise)
        : [])
  };
}

function normalizePlan(plan, planIndex) {
  const days = Array.isArray(plan && plan.days) ? plan.days : [];

  return {
    id: plan && plan.id ? plan.id : `plan_${planIndex + 1}`,
    type: plan && plan.type ? plan.type : 'custom',
    title: plan && plan.title ? plan.title : `自定义计划 ${planIndex + 1}`,
    notice: plan && plan.notice ? plan.notice : '按自己的节奏记录训练，保持动作规范和恢复节奏。',
    days: days.map(normalizeDay).filter(Boolean)
  };
}

function getBuiltinPlans() {
  return [buildDefaultPlan()];
}

function saveWorkoutPlans(plans) {
  wx.setStorageSync(
    WORKOUT_PLANS_KEY,
    Array.isArray(plans) ? plans.map(normalizePlan) : []
  );
}

function getWorkoutPlans() {
  const stored = wx.getStorageSync(WORKOUT_PLANS_KEY);
  if (!Array.isArray(stored) || stored.length === 0) {
    return getBuiltinPlans();
  }

  return stored.map(normalizePlan);
}

function setActivePlanId(planId) {
  wx.setStorageSync(ACTIVE_PLAN_ID_KEY, planId);
}

function getActivePlanId() {
  return wx.getStorageSync(ACTIVE_PLAN_ID_KEY) || '';
}

function ensureWorkoutPlanState() {
  const builtinPlans = getBuiltinPlans();
  const storedPlans = getWorkoutPlans();
  const customPlans = storedPlans.filter(plan => plan.type === 'custom');
  const plans = builtinPlans.concat(customPlans);
  const activePlanId = getActivePlanId();
  const resolvedActivePlanId = plans.some(plan => plan.id === activePlanId)
    ? activePlanId
    : plans[0].id;

  saveWorkoutPlans(plans);
  setActivePlanId(resolvedActivePlanId);

  return {
    plans,
    activePlanId: resolvedActivePlanId,
    activePlan: clone(plans.find(plan => plan.id === resolvedActivePlanId))
  };
}

function getPlanById(planId) {
  const plans = getWorkoutPlans();
  const matched = plans.find(plan => plan.id === planId);
  return matched ? clone(matched) : null;
}

function upsertCustomPlan(plan) {
  const nextPlan = normalizePlan({
    ...plan,
    type: 'custom'
  });
  const storedPlans = getWorkoutPlans();
  const builtinPlans = storedPlans.filter(item => item.type === 'builtin');
  const customPlans = storedPlans.filter(item => item.type === 'custom');
  const existingIndex = customPlans.findIndex(item => item.id === nextPlan.id);

  if (existingIndex >= 0) {
    customPlans.splice(existingIndex, 1, nextPlan);
  } else {
    customPlans.push(nextPlan);
  }

  const plans = builtinPlans.concat(customPlans);
  saveWorkoutPlans(plans);
  return nextPlan;
}

module.exports = {
  WORKOUT_PLANS_KEY,
  ACTIVE_PLAN_ID_KEY,
  MAX_CUSTOM_DAYS,
  DEFAULT_REST_DAY_COLOR,
  buildDefaultPlan,
  createRestDay,
  ensureWorkoutPlanState,
  getWorkoutPlans,
  getPlanById,
  getActivePlanId,
  normalizePlan,
  saveWorkoutPlans,
  setActivePlanId,
  upsertCustomPlan
};
