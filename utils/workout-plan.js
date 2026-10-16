const { sanitizeGuideUrl } = require('./mvp-core.js');
const schedule = require('./schedule.js');
const PLAN_SCHEDULES_KEY = 'training_plan_schedules';

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

function buildHealthyFatLossPlan() {
  return {
    id: 'builtin_healthy_fat_loss',
    type: 'builtin',
    title: '\u5065\u5eb7\u51cf\u8102\u8ba1\u5212',
    notice: '\u4ee5\u89c4\u5f8b\u529b\u91cf\u8bad\u7ec3\u3001\u8f7b\u6d3b\u52a8\u548c\u6062\u590d\u8282\u594f\u4e3a\u4e3b\uff0c\u5e2e\u52a9\u4f60\u7528\u66f4\u7a33\u5b9a\u3001\u66f4\u8f7b\u677e\u7684\u65b9\u5f0f\u79ef\u7d2f\u957f\u671f\u8bb0\u5f55\u3002',
    days: [
      {
        id: 'fatloss_day1',
        type: 'training',
        name: '\u529b\u91cf\u8bad\u7ec3 A',
        icon: '\ud83c\udfcb\ufe0f',
        color: '#C96565',
        exercises: [
          createExercise('fatloss_day1_ex1', '\u9ad8\u811a\u676f\u6df1\u8e72', '\u817f\u90e8 / \u81c0\u90e8', 4, '10-12', '\u5148\u4ee5\u52a8\u4f5c\u7a33\u5b9a\u4e3a\u4f18\u5148\uff0c\u80fd\u4ece\u5bb9\u5b8c\u6210\u5c31\u5f88\u597d\u3002'),
          createExercise('fatloss_day1_ex2', '\u4fef\u5367\u6491', '\u80f8\u90e8 / \u4e09\u5934', 4, '8-12', '\u6309\u81ea\u5df1\u53ef\u63a7\u7684\u5f3a\u5ea6\u5b8c\u6210\uff0c\u7559\u4e00\u70b9\u4f59\u529b\u4e5f\u53ef\u4ee5\u3002'),
          createExercise('fatloss_day1_ex3', '\u5750\u59ff\u5212\u8239', '\u80cc\u90e8', 4, '10-12', '\u4fdd\u6301\u8282\u594f\u7a33\u5b9a\uff0c\u5148\u5bfb\u627e\u80cc\u90e8\u53d1\u529b\u611f\u3002')
        ]
      },
      createRestDay({
        id: 'fatloss_day2',
        name: '\u8f7b\u6709\u6c27 / \u5feb\u8d70',
        icon: '\ud83d\udeb6',
        color: '#5F9A88',
        focus: '\u8f7b\u6d3b\u52a8',
        description: '\u4eca\u5929\u53ef\u4ee5\u4ee5\u8f7b\u6709\u6c27\u3001\u5feb\u8d70\u6216\u8212\u5c55\u6d3b\u52a8\u4e3a\u4e3b\uff0c\u7ed9\u8eab\u4f53\u4e00\u4e2a\u6e29\u548c\u7684\u63a8\u8fdb\u3002',
        note: '\u4fdd\u6301\u8282\u594f\u5c31\u5f88\u68d2\uff0c\u80fd\u6301\u7eed\u8bb0\u5f55\u6bd4\u4e00\u6b21\u505a\u5f88\u591a\u66f4\u91cd\u8981\u3002'
      }),
      {
        id: 'fatloss_day3',
        type: 'training',
        name: '\u529b\u91cf\u8bad\u7ec3 B',
        icon: '\ud83d\udd25',
        color: '#4F9CC4',
        exercises: [
          createExercise('fatloss_day3_ex1', '\u54d1\u94c3\u7f57\u9a6c\u5c3c\u4e9a\u786c\u62c9', '\u81c0\u90e8 / \u540e\u94fe', 4, '10-12', '\u4f18\u5148\u611f\u53d7\u81c0\u817f\u540e\u4fa7\u53d1\u529b\uff0c\u4e0d\u7528\u6025\u7740\u52a0\u91cd\u91cf\u3002'),
          createExercise('fatloss_day3_ex2', '\u54d1\u94c3\u4e0a\u659c\u5367\u63a8', '\u4e0a\u80f8', 4, '10-12', '\u52a8\u4f5c\u7a33\u5b9a\u4f18\u5148\uff0c\u4fdd\u6301\u8212\u9002\u7684\u63a8\u4e3e\u8def\u7ebf\u3002'),
          createExercise('fatloss_day3_ex3', '\u9ad8\u4f4d\u4e0b\u62c9', '\u80cc\u90e8', 4, '10-12', '\u4fdd\u6301\u5b8c\u6574\u884c\u7a0b\uff0c\u6bcf\u6b21\u90fd\u7a33\u7a33\u5b8c\u6210\u3002')
        ]
      },
      createRestDay({
        id: 'fatloss_day4',
        name: '\u4f11\u606f / \u62c9\u4f38',
        icon: '\ud83e\uddd8',
        color: '#5F9A88',
        focus: '\u6062\u590d',
        description: '\u4eca\u5929\u53ef\u4ee5\u8f7b\u677e\u62c9\u4f38\u3001\u6563\u6b65\uff0c\u6216\u8005\u5b89\u6392\u5b8c\u6574\u4f11\u606f\uff0c\u8ba9\u8eab\u4f53\u6162\u6162\u7f13\u8fc7\u6765\u3002',
        note: '\u597d\u597d\u6062\u590d\u4e5f\u662f\u8ba1\u5212\u7684\u4e00\u90e8\u5206\uff0c\u8fd9\u4f1a\u5e2e\u4f60\u66f4\u7a33\u5b9a\u5730\u8d70\u4e0b\u53bb\u3002'
      }),
      {
        id: 'fatloss_day5',
        type: 'training',
        name: '\u529b\u91cf\u8bad\u7ec3 C',
        icon: '\ud83d\udcaa',
        color: '#4EAE7D',
        exercises: [
          createExercise('fatloss_day5_ex1', '\u4fdd\u52a0\u5229\u4e9a\u5206\u817f\u8e72', '\u817f\u90e8 / \u81c0\u90e8', 3, '10-12', '\u5148\u6c42\u7a33\u518d\u6162\u6162\u63d0\u5347\uff0c\u5de6\u53f3\u4fa7\u90fd\u7ed9\u81ea\u5df1\u4e00\u70b9\u9002\u5e94\u65f6\u95f4\u3002'),
          createExercise('fatloss_day5_ex2', '\u54d1\u94c3\u80a9\u63a8', '\u80a9\u90e8', 3, '10-12', '\u4fdd\u6301\u80a9\u80db\u7a33\u5b9a\uff0c\u4e0d\u8ffd\u6c42\u51b2\u523a\u5f0f\u7684\u5b8c\u6210\u611f\u3002'),
          createExercise('fatloss_day5_ex3', '\u9762\u62c9', '\u540e\u675f / \u4e0a\u80cc', 3, '12-15', '\u7528\u8f7b\u91cd\u91cf\u914d\u5408\u6162\u8282\u594f\uff0c\u628a\u52a8\u4f5c\u505a\u5f97\u8212\u5c55\u5c31\u5f88\u597d\u3002')
        ]
      },
      createRestDay({
        id: 'fatloss_day6',
        name: '\u8f7b\u6d3b\u52a8',
        icon: '\ud83c\udf3f',
        color: '#6CA78F',
        focus: '\u6d3b\u52a8',
        description: '\u4eca\u5929\u53ef\u4ee5\u5b89\u6392\u8f7b\u677e\u6563\u6b65\u3001\u8212\u5c55\u6216\u6e29\u548c\u6d3b\u52a8\uff0c\u8ba9\u8eab\u4f53\u4fdd\u6301\u6d41\u52a8\u611f\u3002',
        note: '\u628a\u6d3b\u52a8\u53d8\u6210\u4e60\u60ef\uff0c\u4f1a\u6bd4\u5076\u5c14\u7279\u522b\u62fc\u66f4\u5bb9\u6613\u957f\u671f\u575a\u6301\u3002'
      }),
      createRestDay({
        id: 'fatloss_day7',
        name: '\u4f11\u606f\u65e5',
        icon: '\ud83d\udccc',
        color: '#5F9A88',
        focus: '\u6062\u590d',
        description: '\u4eca\u5929\u4ee5\u6062\u590d\u8282\u594f\u4e3a\u4e3b\uff0c\u7ed9\u81ea\u5df1\u4e00\u4e2a\u8f83\u4ece\u5bb9\u7684\u6536\u5c3e\u3002',
        note: '\u8bb0\u5f55\u4f11\u606f\u65e5\u4e5f\u5f88\u6709\u4ef7\u503c\uff0c\u80fd\u5e2e\u4f60\u66f4\u6e05\u695a\u5730\u770b\u5230\u6574\u4f53\u8282\u594f\u3002'
      })
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
    ...(exercise && typeof exercise.libraryId === 'string' && /^\d{4}$/.test(exercise.libraryId) ? { libraryId: exercise.libraryId } : {}),
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
  return [buildDefaultPlan(), buildHealthyFatLossPlan()];
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
  const schedules = wx.getStorageSync(PLAN_SCHEDULES_KEY) || {};
  const plans = builtinPlans.concat(customPlans).map(plan => ({ ...plan,
    ...(schedules[plan.id] ? { schedule: schedule.normalize(schedules[plan.id], plan.days) } : {}) }));
  const activePlanId = getActivePlanId();
  const resolvedActivePlanId = plans.some(plan => plan.id === activePlanId)
    ? activePlanId
    : plans[0].id;

  saveWorkoutPlans(plans);
  setActivePlanId(resolvedActivePlanId);

  return {
    plans,
    activePlanId: resolvedActivePlanId,
    activePlan: clone(schedule.withRestDay(plans.find(plan => plan.id === resolvedActivePlanId)))
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

function savePlanSchedule(planId, value) {
  const plan = getPlanById(planId);
  if (!plan) return null;
  const schedules = wx.getStorageSync(PLAN_SCHEDULES_KEY) || {};
  const normalized = schedule.normalize(value, plan.days);
  wx.setStorageSync(PLAN_SCHEDULES_KEY, { ...schedules, [planId]: normalized });
  return normalized;
}

function getPlanSchedule(planId) {
  const plan = getPlanById(planId);
  return schedule.normalize((wx.getStorageSync(PLAN_SCHEDULES_KEY) || {})[planId], plan && plan.days || []);
}

module.exports = {
  WORKOUT_PLANS_KEY,
  ACTIVE_PLAN_ID_KEY,
  MAX_CUSTOM_DAYS,
  DEFAULT_REST_DAY_COLOR,
  buildDefaultPlan,
  buildHealthyFatLossPlan,
  createRestDay,
  ensureWorkoutPlanState,
  getWorkoutPlans,
  getPlanById,
  getActivePlanId,
  normalizePlan,
  normalizeExercise,
  saveWorkoutPlans,
  setActivePlanId,
  upsertCustomPlan
  , savePlanSchedule, getPlanSchedule, PLAN_SCHEDULES_KEY
};
