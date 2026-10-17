const util = require('../../utils/util.js');
const {
  calculateFatLossTargets,
  calculateNutritionTargets,
  createPortionAdjustedFood
} = require('../../utils/mvp-core.js');
const ui = require('../../utils/ui-helpers.js');
const { buildMealGroups } = require('../../utils/records-view.js');
const foodSuggest = require('../../utils/food-suggest.js');
const {
  buildRecognizeFlowPlan,
  getRecognizeRequestStrategy,
  shouldSuggestDetailedSplit
} = require('../../utils/food-scan.js');
const app = getApp();

const DEFAULT_COMPRESS_OPTIONS = {
  maxSide: 640,
  quality: 58
};

const RETRY_COMPRESS_OPTIONS = {
  maxSide: 960,
  quality: 72
};

const FALLBACK_COMPRESS_OPTIONS = [
  { maxSide: 640, quality: 48 },
  { maxSide: 640, quality: 38 }
];

const MAX_CLOUD_BASE64_LENGTH = 760000;

const IMAGE_PROCESS_FAILED_MESSAGE = '图片处理失败，请重新选择图片或手动添加。';

const PORTION_OPTIONS = [
  { key: 'half', label: '半份' },
  { key: 'standard', label: '一份' },
  { key: 'custom', label: '自定义' }
];

function macroItem(label, value, target, unit) {
  return {
    label,
    value: Math.round(Number(value) || 0),
    target: target ? Math.round(target) : 0,
    percent: ui.percent(value, target),
    unit: unit || 'g'
  };
}

function buildIntakeView(dailyTotal, targets) {
  const calories = Number(dailyTotal.calories) || 0;
  const target = targets && targets.calories ? targets.calories : 0;
  return {
    calories: ui.formatThousands(calories),
    targetText: targets && targets.caloriesText ? targets.caloriesText : '',
    percent: ui.percent(calories, target),
    macros: [
      macroItem('蛋白质', dailyTotal.protein, targets && targets.protein),
      macroItem('碳水', dailyTotal.carbs, targets && targets.carbs),
      macroItem('脂肪', dailyTotal.fat, targets && targets.fat)
    ]
  };
}

function buildGoalPreview(form) {
  const profile = {
    height: Number(form.height),
    weight: Number(form.weight),
    age: Number(form.age),
    gender: form.gender,
    activityLevel: form.activityLevel,
    goal: form.goal,
    dailyCalories: Number(form.dailyCalories)
  };
  if (!profile.height || !profile.weight || !profile.age) return null;
  let target = null;
  let caloriesText = '';
  try {
    if (profile.goal === 'fat_loss') {
      const fatLoss = calculateFatLossTargets(profile);
      if (!fatLoss.isMinor) {
        target = { dailyCalories: fatLoss.calorieRange.max, proteinTarget: fatLoss.proteinTarget, carbTarget: fatLoss.carbTarget, fatRange: fatLoss.fatRange };
        caloriesText = `${ui.formatThousands(fatLoss.calorieRange.min)}-${ui.formatThousands(fatLoss.calorieRange.max)}`;
      }
    } else {
      target = calculateNutritionTargets(profile);
    }
  } catch (error) {
    target = null;
  }
  if (!target || !target.dailyCalories || target.isMinor) return null;
  const calories = target.dailyCalories;
  const fat = target.fatRange ? Math.round((target.fatRange.min + target.fatRange.max) / 2) : 0;
  const share = (grams, kcalPerGram) => Math.round((grams * kcalPerGram / calories) * 100);
  return {
    calories: caloriesText || ui.formatThousands(calories),
    macros: [
      { label: '蛋白质', value: Math.round(target.proteinTarget), percent: share(target.proteinTarget, 4) },
      { label: '碳水', value: Math.round(target.carbTarget), percent: share(target.carbTarget, 4) },
      { label: '脂肪', value: fat, percent: share(fat, 9) }
    ]
  };
}

function createEmptyManualForm() {
  return {
    name: '',
    estimatedWeight: '',
    calories: '',
    protein: '',
    fat: '',
    carbs: ''
  };
}

const SCAN_MODE_OPTIONS = [
  { key: 'detailed', label: '精细拆分优先', desc: '优先拆成米饭、主菜、蔬菜、酱汁' },
  { key: 'dish_first', label: '整道菜优先', desc: '优先返回整体菜名，适合复杂混合餐' }
];

const DEBUG_RECOGNIZE_PREFIX = '[nutrition-recognize]';

function buildRecognizeUploadPath() {
  return `food-scan/${Date.now()}-${util.generateId()}.jpg`;
}

function createGoalForm(profile) {
  return {
    height: profile && profile.height ? String(profile.height) : '',
    weight: profile && profile.weight ? String(profile.weight) : '',
    age: profile && profile.age ? String(profile.age) : '',
    gender: profile && profile.gender ? profile.gender : 'male',
    activityLevel: profile && profile.activityLevel ? profile.activityLevel : 'light',
    goal: profile && profile.goal ? profile.goal : 'maintain',
    dailyCalories: profile && profile.dailyCalories ? String(profile.dailyCalories) : ''
  };
}

function sumFoods(foods) {
  return (foods || []).reduce((sum, item) => ({
    calories: sum.calories + (Number(item.calories) || 0),
    protein: Math.round((sum.protein + (Number(item.protein) || 0)) * 10) / 10,
    fat: Math.round((sum.fat + (Number(item.fat) || 0)) * 10) / 10,
    carbs: Math.round((sum.carbs + (Number(item.carbs) || 0)) * 10) / 10
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
}

function normalizeScanFood(food, index) {
  const normalized = createPortionAdjustedFood({
    id: food.id || `scan_food_${index + 1}`,
    name: food.name || `识别项 ${index + 1}`,
    baseWeight: Number(food.estimatedWeight) || 100,
    estimatedWeight: Number(food.estimatedWeight) || 100,
    baseCalories: Number(food.calories) || 0,
    calories: Number(food.calories) || 0,
    baseProtein: Number(food.protein) || 0,
    protein: Number(food.protein) || 0,
    baseFat: Number(food.fat) || 0,
    fat: Number(food.fat) || 0,
    baseCarbs: Number(food.carbs) || 0,
    carbs: Number(food.carbs) || 0,
    confidence: Number(food.confidence) || 0.6
  }, {
    portionKey: 'standard'
  });

  return {
    ...normalized,
    confidencePercent: Math.round((normalized.confidence || 0) * 100)
  };
}

function normalizeScanResult(payload) {
  const foods = Array.isArray(payload && payload.foods) ? payload.foods.map(normalizeScanFood) : [];
  const total = sumFoods(foods);
  const lowConfidence = foods.some(item => item.confidence < 0.65);
  return {
    foods,
    total,
    note: payload && payload.note
      ? payload.note
      : 'AI识别结果仅供记录参考，请根据实际份量自行调整。',
    lowConfidence,
    source: payload && payload.source ? payload.source : '',
    isMock: !!(payload && payload.isMock)
  };
}

function inferRecognizeErrorCode(reason, debugText = '') {
  const raw = `${reason || ''}\n${debugText || ''}`.toLowerCase();

  if (raw.indexOf('missing_api_key') >= 0) return 'missing_api_key';
  if (raw.indexOf('cloud_unavailable') >= 0) return 'cloud_unavailable';
  if (raw.indexOf('compress_failed') >= 0) return 'compress_failed';
  if (raw.indexOf('missing_image') >= 0) return 'missing_image';
  if (raw.indexOf('empty_base64') >= 0) return 'empty_base64';
  if (raw.indexOf('image_too_large') >= 0 || raw.indexOf('data exceed max size') >= 0) return 'image_too_large';
  if (raw.indexOf('timeout') >= 0 || raw.indexOf('request_timeout') >= 0) return 'request_timeout';
  if (raw.indexOf('empty_ai_content') >= 0 || raw.indexOf('empty_result') >= 0) return 'empty_ai_content';
  if (raw.indexOf('cloud_call_failed') >= 0) return 'cloud_call_failed';
  return reason || 'recognize_failed';
}

function getRecognizeErrorMessage(errorCode) {
  switch (errorCode) {
    case 'missing_image':
      return '图片读取失败，请重新选择图片后再试。';
    case 'empty_base64':
      return '图片内容读取失败，请重新选择图片后再试。';
    case 'cloud_unavailable':
      return '当前环境未连接云开发，请检查微信云开发配置。';
    case 'missing_api_key':
      return '云函数未配置识别服务密钥，请先检查环境变量。';
    case 'request_timeout':
      return '识别请求超时，请稍后重试。';
    case 'image_too_large':
      return '图片体积偏大，请换一张更清晰或更小的图片，也可以直接手动记录。';
    case 'empty_ai_content':
      return '识别结果返回不完整，请尝试换一张角度更清晰的照片，或点击重新细分。';
    case 'cloud_call_failed':
      return '云端识别调用未完成，请稍后重试。';
    case 'compress_failed':
      return '图片处理失败，请重新选择图片或手动添加。';
    default:
      return '识别暂时不可用，请稍后重试或手动添加。';
  }
}

function buildRecognizeDebugSummary(result) {
  if (!result || !result.debug) {
    return '';
  }

  const debug = result.debug;
  const keyPreview = debug.keyPreview || {};
  const hasKeyPreview = keyPreview.prefix || keyPreview.suffix || keyPreview.length;
  const lines = [
    `host: ${debug.host || ''}`,
    `model: ${debug.model || ''}`,
    `img: ${debug.imageBase64Length || 0}`
  ];

  if (hasKeyPreview) {
    lines.splice(2, 0, `key: ${keyPreview.prefix || ''}...${keyPreview.suffix || ''} (${keyPreview.length || 0})`);
  }

  if (result.error) {
    lines.push(`error: ${result.error}`);
  }

  if (result.warning) {
    lines.push(`warning: ${result.warning}`);
  }

  return lines.join('\n');
}

function buildRecognizeDebugLines(debugText) {
  return debugText
    ? `识别配置检查\n${debugText}`
    : '';
}

function buildCallFunctionDebug(error) {
  const envId = app && app.globalData && app.globalData.cloudEnvId
    ? app.globalData.cloudEnvId
    : 'unknown';
  const errMsg = error && error.errMsg ? error.errMsg : '';
  const errorMessage = error && error.message ? error.message : '';

  return [
    `env: ${envId}`,
    'fn: foodRecognize',
    `err: ${errMsg || errorMessage || 'unknown'}`
  ].join('\n');
}

function getRecognizePhaseMeta(phase) {
  switch (phase) {
    case 'refining':
      return {
        loadingTitle: '细分中',
        phaseText: '正在细分餐食...'
      };
    case 'retry_refining':
      return {
        loadingTitle: '重细分中',
        phaseText: '正在重新细分餐食...'
      };
    case 'recognizing':
    default:
      return {
        loadingTitle: '识别中',
        phaseText: '正在识别餐食...'
      };
  }
}

function buildBodyTypeSummary(profile) {
  const heightCm = Number(profile && profile.height) || 0;
  const weightKg = Number(profile && profile.weight) || 0;

  if (!heightCm || !weightKg) {
    return {
      bmiText: '--',
      statusText: '待填写',
      noteText: '仅基于身高和体重做简单参考，不代表体脂率或健康诊断。'
    };
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let statusText = '正常范围';

  if (bmi < 18.5) {
    statusText = '偏瘦';
  } else if (bmi >= 24) {
    statusText = '偏胖';
  }

  return {
    bmiText: bmi.toFixed(1),
    statusText,
    noteText: '仅基于身高和体重做简单参考，不代表体脂率或健康诊断。'
  };
}

Page({
  onShareAppMessage() { return require('../../utils/app-sharing.js').home(); },
  onShareTimeline() { return { title: '练迹记录 · 饮食记录', query: '' }; },
  onAddToFavorites() { return require('../../utils/app-sharing.js').favorite(); },
  data: {
    todayCN: '',
    todayStr: '',
    dailyTotal: {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0
    },
    goalSummary: {
      caloriesText: '--',
      proteinText: '--',
      fatText: '--',
      carbsText: '--',
      bmiText: '--',
      bodyTypeText: '待填写',
      bodyTypeNote: '仅基于身高和体重做简单参考，不代表体脂率或健康诊断。',
      noteText: '设置每日参考热量和营养参考目标后，会在这里持续对照今天的记录。',
      hasGoal: false
    },
    fatLossSummary: {
      enabled: false,
      subtitle: '点击开启健康减脂参考，查看每日参考热量区间和长期趋势。',
      rangeText: '--',
      proteinText: '--',
      weeklyHabitRate: 0
    },
    todayFoods: [],
    scanResult: null,
    scanImagePath: '',
    scanCompressedPath: '',
    showDetailedRescanHint: false,
    recognizePhase: '',
    recognizePhaseText: '',
    isRecognizeRefining: false,
    recognizeNotice: '',
    showManualForm: false,
    isEditingScanResult: false,
    editingScanFoodIndex: -1,
    manualForm: createEmptyManualForm(),
    showGoalForm: false,
    showEntrySheet: false,
    goalForm: createGoalForm(),
    portionOptions: PORTION_OPTIONS,
    scanMode: 'dish_first',
    scanModeOptions: SCAN_MODE_OPTIONS,
    activityOptions: [
      { key: 'light', label: '轻度活动' },
      { key: 'moderate', label: '中等活动' },
      { key: 'active', label: '高强度' }
    ],
    goalOptions: [
      { key: 'maintain', label: '保持体重' },
      { key: 'fat_loss', label: '温和减脂' },
      { key: 'muscle_gain', label: '增肌' },
      { key: 'custom', label: '自定义' }
    ],
    intake: buildIntakeView({ calories: 0, protein: 0, fat: 0, carbs: 0 }, null),
    mealGroups: [],
    mealSheet: null,
    frequentFoods: [],
    foodSuggestions: [],
    goalPreview: null,
    subpageOn: true
  },

  onShow() {
    this.syncCustomTabBar();
    this.initPage();
    // 从“健康减脂参考”跳过来填写基本信息
    if (app && app.globalData && app.globalData.openGoalForm) {
      app.globalData.openGoalForm = false;
      this.openGoalForm();
    }
  },

  syncCustomTabBar() {
    if (typeof this.getTabBar !== 'function') {
      return;
    }

    const tabBar = this.getTabBar();
    if (!tabBar) {
      return;
    }

    tabBar.setData({
      selected: 3,
      hidden: false
    });
  },

  setCustomTabBarHidden(hidden) {
    if (typeof this.getTabBar !== 'function') {
      return;
    }

    const tabBar = this.getTabBar();
    if (!tabBar) {
      return;
    }

    tabBar.setData({
      hidden: !!hidden
    });
  },

  initPage() {
    const today = util.getToday();
    this.setData({
      todayCN: util.formatDateCN(today),
      todayStr: today
    });
    this.loadTodayRecords();
    this.loadGoalSummary();
    this.loadFatLossSummary();
  },

  loadTodayRecords() {
    const foods = util.getNutritionRecords(this.data.todayStr);
    const dailyTotal = util.calcDailyNutrition(foods);
    this.setData({
      todayFoods: foods,
      dailyTotal,
      mealGroups: buildMealGroups(foods),
      frequentFoods: this.loadFrequentFoods()
    }, () => {
      this.loadGoalSummary();
      this.loadFatLossSummary();
      this.loadIntakeView();
    });
  },

  loadGoalSummary() {
    const profile = util.getNutritionGoalProfile();
    const goal = util.getNutritionGoal();
    const { dailyTotal } = this.data;
    const bodyType = buildBodyTypeSummary(profile);

    if (!profile || !goal) {
      this.setData({
        goalSummary: {
          caloriesText: `${dailyTotal.calories} / -- kcal`,
          proteinText: `${dailyTotal.protein} / -- g`,
          fatText: `${dailyTotal.fat} / -- g`,
          carbsText: `${dailyTotal.carbs} / -- g`,
          bmiText: bodyType.bmiText,
          bodyTypeText: bodyType.statusText,
          bodyTypeNote: bodyType.noteText,
          noteText: '设置每日参考热量和营养参考目标后，会在这里持续对照今天的记录。',
          hasGoal: false
        },
        goalForm: createGoalForm(profile)
      });
      return;
    }

    if (profile.goal === 'fat_loss') {
      const fatLossTarget = calculateFatLossTargets(profile);

      if (fatLossTarget.isMinor) {
        this.setData({
          goalSummary: {
            caloriesText: `${dailyTotal.calories} kcal`,
            proteinText: `${dailyTotal.protein} g`,
            fatText: `${dailyTotal.fat} g`,
            carbsText: `${dailyTotal.carbs} g`,
            bmiText: bodyType.bmiText,
            bodyTypeText: bodyType.statusText,
            bodyTypeNote: bodyType.noteText,
            noteText: fatLossTarget.note,
            hasGoal: true
          },
          goalForm: createGoalForm(profile)
        });
        return;
      }

      this.setData({
        goalSummary: {
          caloriesText: `${dailyTotal.calories} / ${fatLossTarget.calorieRange.min}-${fatLossTarget.calorieRange.max} kcal`,
          proteinText: `${dailyTotal.protein} / ${fatLossTarget.proteinTarget} g`,
          fatText: `${dailyTotal.fat} / ${fatLossTarget.fatRange.min}-${fatLossTarget.fatRange.max} g`,
          carbsText: `${dailyTotal.carbs} / ${fatLossTarget.carbTarget} g`,
          bmiText: bodyType.bmiText,
          bodyTypeText: bodyType.statusText,
          bodyTypeNote: bodyType.noteText,
          noteText: '健康减脂参考 · 以每日参考热量区间和营养参考目标为主，关注长期趋势，不做强制限制。',
          hasGoal: true
        },
        goalForm: createGoalForm(profile)
      });
      return;
    }

    if (goal.isMinor) {
      this.setData({
        goalSummary: {
          caloriesText: `${dailyTotal.calories} kcal`,
          proteinText: `${dailyTotal.protein} g`,
          fatText: `${dailyTotal.fat} g`,
          carbsText: `${dailyTotal.carbs} g`,
          bmiText: bodyType.bmiText,
          bodyTypeText: bodyType.statusText,
          bodyTypeNote: bodyType.noteText,
          noteText: '成长阶段能量需求差异较大，当前结果仅用于饮食记录参考，如需调整饮食建议咨询家长或专业人士。',
          hasGoal: true
        },
        goalForm: createGoalForm(profile)
      });
      return;
    }

    const goalLabel = profile.goal === 'custom'
      ? '自定义目标'
      : (profile.goal === 'muscle_gain'
        ? '增肌训练参考'
        : (profile.goal === 'fat_loss' ? '健康减脂参考' : '保持健康记录'));
    const noteText = `${goalLabel} · 以每日参考热量和营养参考目标为主，不做强制限制。`;

    this.setData({
      goalSummary: {
        caloriesText: `${dailyTotal.calories} / ${goal.dailyCalories} kcal`,
        proteinText: `${dailyTotal.protein} / ${goal.proteinTarget} g`,
        fatText: `${dailyTotal.fat} / ${goal.fatRange.min}-${goal.fatRange.max} g`,
        carbsText: `${dailyTotal.carbs} / ${goal.carbTarget} g`,
        bmiText: bodyType.bmiText,
        bodyTypeText: bodyType.statusText,
        bodyTypeNote: bodyType.noteText,
        noteText,
        hasGoal: true
      },
      goalForm: createGoalForm(profile)
    });
  },

  loadFatLossSummary() {
    const profile = util.getFatLossProfile();
    const summary = util.getFatLossWeeklySummary();

    if (!profile) {
      this.setData({
        fatLossSummary: {
          enabled: false,
          subtitle: '点击开启健康减脂参考，查看每日参考热量区间和长期趋势。',
          rangeText: '--',
          proteinText: '--',
          weeklyHabitRate: 0
        }
      });
      return;
    }

    const target = calculateFatLossTargets(profile);

    if (target.isMinor) {
      this.setData({
        fatLossSummary: {
          enabled: true,
          subtitle: target.note,
          rangeText: '温和记录参考',
          proteinText: '--',
          weeklyHabitRate: summary.habitCompletionRate
        }
      });
      return;
    }

    this.setData({
      fatLossSummary: {
        enabled: true,
        subtitle: '以每日参考热量区间和长期趋势为主，不做强制限制。',
        rangeText: `${target.calorieRange.min}-${target.calorieRange.max} kcal`,
        proteinText: `${target.proteinTarget} g`,
        weeklyHabitRate: summary.habitCompletionRate
      }
    });
  },

  getNumericTargets() {
    const profile = util.getNutritionGoalProfile();
    const goal = util.getNutritionGoal();
    if (!profile || !goal) return null;
    if (profile.goal === 'fat_loss') {
      const target = calculateFatLossTargets(profile);
      if (target.isMinor) return null;
      return {
        calories: target.calorieRange.max,
        caloriesText: `${ui.formatThousands(target.calorieRange.min)}-${ui.formatThousands(target.calorieRange.max)} kcal`,
        protein: target.proteinTarget,
        carbs: target.carbTarget,
        fat: target.fatRange.max
      };
    }
    if (goal.isMinor) return null;
    return {
      calories: goal.dailyCalories,
      caloriesText: `${ui.formatThousands(goal.dailyCalories)} kcal`,
      protein: goal.proteinTarget,
      carbs: goal.carbTarget,
      fat: goal.fatRange ? goal.fatRange.max : 0
    };
  },

  loadIntakeView() {
    this.setData({ intake: buildIntakeView(this.data.dailyTotal, this.getNumericTargets()) });
  },

  refreshGoalPreview() {
    this.setData({ goalPreview: buildGoalPreview(this.data.goalForm) });
  },

  refreshTabBarVisibility() {
    const d = this.data;
    this.setCustomTabBarHidden(!!(d.scanResult || d.showManualForm || d.showGoalForm || d.showEntrySheet || d.mealSheet));
  },

  // page-container 被返回手势关闭：关掉最上层，下面还有子页就重新显示
  onSubpageLeave() {
    const d = this.data;
    if (!(d.scanResult || d.showManualForm || d.showGoalForm)) return;
    if (d.showManualForm && this.isManualDirty()) {
      this.setData({ subpageOn: false });
      this.confirmDiscardManual(() => this.setData({ subpageOn: true }));
      return;
    }
    if (d.showManualForm) this.closeManualForm();
    else if (d.showGoalForm) this.closeGoalForm();
    else if (d.scanResult) this.clearScanResult();
    const still = this.data.scanResult || this.data.showManualForm || this.data.showGoalForm;
    if (still) this.setData({ subpageOn: false }, () => this.setData({ subpageOn: true }));
  },

  openMealSheet(e) {
    const group = this.data.mealGroups[Number(e.currentTarget.dataset.index)];
    if (!group) return;
    const favorites = wx.getStorageSync('favorite_foods') || [];
    this.setData({ mealSheet: { ...group, items: group.items.map(item => ({ ...item, favorite: favorites.some(food => food.name === item.name) })) } });
    this.refreshTabBarVisibility();
  },

  closeMealSheet() {
    this.setData({ mealSheet: null });
    this.refreshTabBarVisibility();
  },

  deleteMealItem(e) {
    this.setData({ mealSheet: null });
    this.refreshTabBarVisibility();
    this.deleteFood(e);
  },

  openFatLossPage() {
    wx.navigateTo({
      url: '/pages/fatloss/fatloss'
    });
  },

  openGoalForm() {
    this.setData({
      showGoalForm: true,
      goalForm: createGoalForm(util.getNutritionGoalProfile())
    });
    this.setCustomTabBarHidden(true);
    this.refreshGoalPreview();
  },

  closeGoalForm() {
    this.setData({
      showGoalForm: false
    });
    this.refreshTabBarVisibility();
  },

  openEntrySheet() {
    this.setData({
      showEntrySheet: true
    });
    this.setCustomTabBarHidden(true);
  },

  closeEntrySheet() {
    this.setData({
      showEntrySheet: false
    });
    this.refreshTabBarVisibility();
  },

  onGoalInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`goalForm.${field}`]: e.detail.value
    });
    this.refreshGoalPreview();
  },

  selectGoalGender(e) {
    this.setData({
      'goalForm.gender': e.currentTarget.dataset.value
    });
    this.refreshGoalPreview();
  },

  selectGoalActivity(e) {
    this.setData({
      'goalForm.activityLevel': e.currentTarget.dataset.value
    });
    this.refreshGoalPreview();
  },

  selectGoalType(e) {
    this.setData({
      'goalForm.goal': e.currentTarget.dataset.value
    });
    this.refreshGoalPreview();
  },

  submitGoalForm() {
    const form = this.data.goalForm;
    const profile = {
      height: Number(form.height) || 0,
      weight: Number(form.weight) || 0,
      age: Number(form.age) || 0,
      gender: form.gender,
      activityLevel: form.activityLevel,
      goal: form.goal,
      dailyCalories: Number(form.dailyCalories) || 0
    };

    if (!profile.height || !profile.weight || !profile.age) {
      wx.showToast({
        title: '请先补充身高、体重和年龄',
        icon: 'none'
      });
      return;
    }

    if (profile.goal === 'custom' && !profile.dailyCalories) {
      wx.showToast({
        title: '自定义目标需要填写参考热量',
        icon: 'none'
      });
      return;
    }

    util.saveNutritionGoalProfile(profile);
    if (profile.goal === 'fat_loss') {
      util.saveFatLossProfile({
        ...profile,
        enabled: true,
        updatedAt: new Date().toISOString()
      });
    }
    this.setData({
      showGoalForm: false
    });
    this.refreshTabBarVisibility();
    this.loadGoalSummary();
    this.loadFatLossSummary();

    wx.showToast({
      title: '参考目标已保存',
      icon: 'success'
    });
  },

  takePhoto() {
    this.closeEntrySheet();
    this.chooseFoodImage('camera');
  },

  chooseFromAlbum() {
    this.closeEntrySheet();
    this.chooseFoodImage('album');
  },

  chooseFoodImage(sourceType) {
    const source = sourceType === 'camera' ? ['camera'] : ['album'];

    if (wx.chooseImage) {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: source,
        success: (res) => {
          const imagePath = res && Array.isArray(res.tempFilePaths) ? res.tempFilePaths[0] : '';
          if (imagePath) {
            this.startRecognizeFlow(imagePath);
          }
        }
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: source,
      success: (res) => {
        const imagePath = res && res.tempFiles && res.tempFiles[0] ? res.tempFiles[0].tempFilePath : '';
        if (imagePath) {
          this.startRecognizeFlow(imagePath);
        }
      }
    });
  },

  compressFoodImage(imagePath, options = {}) {
    const compressOptions = {
      ...DEFAULT_COMPRESS_OPTIONS,
      ...options
    };

    return new Promise((resolve, reject) => {
      if (!wx.compressImage) {
        resolve(imagePath);
        return;
      }

      // WeChat first-party compression currently handles quality more reliably than size;
      // keep maxSide in the signature so we can add dimension resize later without changing callers.
      wx.compressImage({
        src: imagePath,
        quality: compressOptions.quality,
        success: (res) => {
          const nextPath = res.tempFilePath || imagePath;
          console.log(DEBUG_RECOGNIZE_PREFIX, 'compress success', {
            originalPath: imagePath,
            compressedPath: nextPath,
            quality: compressOptions.quality
          });
          resolve(nextPath);
        },
        fail: (error) => {
          console.error(DEBUG_RECOGNIZE_PREFIX, 'compress failed', {
            imagePath,
            quality: compressOptions.quality,
            error
          });
          reject(new Error('compress_failed'));
        }
      });
    });
  },

  readFileAsBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          const base64 = res && res.data ? String(res.data) : '';
          console.log(DEBUG_RECOGNIZE_PREFIX, 'read base64', {
            filePath,
            base64Length: base64.length
          });
          resolve(base64);
        },
        fail: (error) => {
          console.error(DEBUG_RECOGNIZE_PREFIX, 'read base64 failed', {
            filePath,
            error
          });
          reject(error);
        }
      });
    });
  },

  uploadRecognizeImage(filePath) {
    return new Promise((resolve, reject) => {
      if (!wx.cloud || !wx.cloud.uploadFile) {
        reject(new Error('cloud_unavailable'));
        return;
      }

      wx.cloud.uploadFile({
        cloudPath: buildRecognizeUploadPath(),
        filePath,
        success: (res) => {
          resolve(res && res.fileID ? res.fileID : '');
        },
        fail: reject
      });
    });
  },

  deleteRecognizeUpload(fileID) {
    if (!fileID || !wx.cloud || !wx.cloud.deleteFile) {
      return;
    }

    wx.cloud.deleteFile({
      fileList: [fileID]
    });
  },

  async prepareRecognizeImage(imagePath, options = {}) {
    const primaryOptions = options.preset === 'retry'
      ? RETRY_COMPRESS_OPTIONS
      : DEFAULT_COMPRESS_OPTIONS;
    const candidates = [primaryOptions].concat(FALLBACK_COMPRESS_OPTIONS);
    let lastBase64 = '';
    let lastCompressedPath = imagePath;
    let lastRequestStrategy = getRecognizeRequestStrategy({
      imageBase64Length: 0,
      maxInlineBase64Length: MAX_CLOUD_BASE64_LENGTH
    });

    for (let i = 0; i < candidates.length; i += 1) {
      const compressOptions = candidates[i];
      const compressedPath = await this.compressFoodImage(imagePath, compressOptions);
      if (!compressedPath) {
        throw new Error('missing_image');
      }
      const imageBase64 = await this.readFileAsBase64(compressedPath);
      if (!imageBase64) {
        throw new Error('empty_base64');
      }

      console.log(DEBUG_RECOGNIZE_PREFIX, 'prepared candidate', {
        step: i + 1,
        quality: compressOptions.quality,
        maxSide: compressOptions.maxSide,
        compressedPath,
        base64Length: imageBase64.length
      });

      lastBase64 = imageBase64;
      lastCompressedPath = compressedPath;
      lastRequestStrategy = getRecognizeRequestStrategy({
        imageBase64Length: imageBase64.length,
        maxInlineBase64Length: MAX_CLOUD_BASE64_LENGTH
      });

      if (!lastRequestStrategy.shouldUploadToCloud || i === 0) {
        return {
          compressedPath,
          imageBase64,
          requestStrategy: lastRequestStrategy,
          compressOptions,
          downgraded: i > 0
        };
      }
    }

    return {
      compressedPath: lastCompressedPath,
      imageBase64: lastBase64,
      requestStrategy: lastRequestStrategy,
      compressOptions: candidates[candidates.length - 1],
      downgraded: candidates.length > 1
    };
  },

  callFoodRecognize(payload, options = {}) {
    return new Promise((resolve, reject) => {
      if (!wx.cloud || !wx.cloud.callFunction) {
        reject(new Error('cloud_unavailable'));
        return;
      }

      wx.cloud.callFunction({
        name: 'foodRecognize',
        data: {
          fileID: payload && payload.fileID ? payload.fileID : '',
          imageBase64: payload && payload.imageBase64 ? payload.imageBase64 : '',
          recognizeProfile: payload && payload.recognizeProfile ? payload.recognizeProfile : 'balanced',
          splitMode: payload && payload.splitMode ? payload.splitMode : (this.data.scanMode || 'dish_first'),
          imageDetail: options && options.preset === 'retry'
            ? 'high'
            : (this.data.scanMode === 'detailed' ? 'high' : 'low')
        },
        success: (res) => {
          console.log(DEBUG_RECOGNIZE_PREFIX, 'cloud function result', res && res.result ? {
            success: res.result.success,
            error: res.result.error,
            source: res.result.source,
            hasData: !!res.result.data
          } : { empty: true });
          resolve(res.result || {});
        },
        fail: (error) => {
          console.error(DEBUG_RECOGNIZE_PREFIX, 'cloud function call failed', error);
          const errMsg = error && error.errMsg ? error.errMsg : '';
          const failure = new Error(
            errMsg && errMsg.indexOf('data exceed max size') >= 0
              ? 'image_too_large'
              : (errMsg || 'cloud_call_failed')
          );
          failure.debugText = buildCallFunctionDebug(error);
          failure.errMsg = errMsg;
          reject(failure);
        }
      });
    });
  },

  async uploadRecognizeFallbackIfNeeded(prepared, requestStrategy, error) {
    const isInlinePayload = !requestStrategy.shouldUploadToCloud;
    const isPayloadLimitError = error && error.message === 'image_too_large';

    if (!isInlinePayload || !isPayloadLimitError) {
      throw error;
    }

    if (!prepared.uploadedFileId) {
      prepared.uploadedFileId = await this.uploadRecognizeImage(prepared.compressedPath);
    }

    return prepared.uploadedFileId;
  },

  setRecognizeProgress(phase, notice = '') {
    const meta = getRecognizePhaseMeta(phase);
    this.setData({
      recognizePhase: phase,
      recognizePhaseText: meta.phaseText,
      isRecognizeRefining: phase === 'refining' || phase === 'retry_refining',
      recognizeNotice: notice
    });
    wx.showLoading({
      title: meta.loadingTitle
    });
  },

  applyRecognizeResult(scanResult, imagePath, compressedPath, extraState = {}) {
    this.setData({
      scanResult,
      scanImagePath: imagePath,
      scanCompressedPath: compressedPath,
      showDetailedRescanHint: shouldSuggestDetailedSplit(scanResult),
      showManualForm: false,
      isEditingScanResult: false,
      editingScanFoodIndex: -1,
      ...extraState
    });
    this.refreshTabBarVisibility();
  },

  async requestRecognizePass(imagePath, prepared, options = {}, passOptions = {}) {
    const compressedPath = prepared.compressedPath;
    const imageBase64 = prepared.imageBase64;
    const requestStrategy = prepared.requestStrategy || getRecognizeRequestStrategy({
      imageBase64Length: imageBase64 ? imageBase64.length : 0,
      maxInlineBase64Length: MAX_CLOUD_BASE64_LENGTH
    });
    const recognizeProfile = passOptions.recognizeProfile || 'balanced';
    const splitMode = passOptions.splitMode || this.data.scanMode || 'dish_first';

    console.log(DEBUG_RECOGNIZE_PREFIX, 'before call cloud function', {
      imagePath,
      compressedPath,
      base64Length: imageBase64.length,
      preset: options.preset || 'default',
      recognizeProfile,
      payloadGuard: MAX_CLOUD_BASE64_LENGTH,
      requestMode: requestStrategy.mode,
      shouldUploadToCloud: requestStrategy.shouldUploadToCloud,
      uploadedFileId: prepared.uploadedFileId || ''
    });

    let result;

    try {
      result = await this.callFoodRecognize({
        fileID: requestStrategy.shouldUploadToCloud ? (prepared.uploadedFileId || '') : '',
        imageBase64: requestStrategy.shouldUploadToCloud ? '' : imageBase64,
        recognizeProfile,
        splitMode
      }, options);
    } catch (error) {
      const fallbackFileId = await this.uploadRecognizeFallbackIfNeeded(prepared, requestStrategy, error);

      console.warn(DEBUG_RECOGNIZE_PREFIX, 'retry with uploaded file after inline payload limit', {
        imagePath,
        compressedPath,
        recognizeProfile,
        splitMode,
        fallbackFileId
      });

      result = await this.callFoodRecognize({
        fileID: fallbackFileId,
        imageBase64: '',
        recognizeProfile,
        splitMode
      }, options);
    }

    const debugText = buildRecognizeDebugSummary(result);

    if (!result || result.success === false) {
      const failure = new Error(result && result.error ? result.error : 'recognize_failed');
      failure.debugText = debugText;
      failure.errorCode = result && result.error ? result.error : 'recognize_failed';
      failure.warning = result && result.warning ? result.warning : '';
      throw failure;
    }

    if (result.source === 'fallback' || result.isMock) {
      throw new Error('mock_result');
    }

    const scanResult = normalizeScanResult({
      ...(result.data || result),
      source: result.source,
      isMock: result.isMock
    });

    if (!scanResult.foods.length) {
      throw new Error('empty_result');
    }

    return scanResult;
  },

  handleRecognizeRefineFailure(imagePath, options = {}, error, fallbackNotice) {
    const reason = error && error.message ? error.message : 'recognize_failed';
    const debugText = error && error.debugText
      ? error.debugText
      : [`reason: ${reason}`, error && error.warning ? `warning: ${error.warning}` : '', error && error.errMsg ? `err: ${error.errMsg}` : '']
        .filter(Boolean)
        .join('\n');

    console.error(DEBUG_RECOGNIZE_PREFIX, 'refine failed', {
      reason,
      errorCode: error && error.errorCode ? error.errorCode : '',
      warning: error && error.warning ? error.warning : '',
      debugText,
      imagePath,
      preset: options.preset || 'default'
    });

    this.setData({
      recognizePhase: '',
      recognizePhaseText: '',
      isRecognizeRefining: false,
      recognizeNotice: fallbackNotice
    });
  },

  showImageProcessUnavailable() {
    wx.showModal({
      title: '图片处理失败',
      content: IMAGE_PROCESS_FAILED_MESSAGE,
      confirmText: '手动添加',
      cancelText: '重新选择',
      success: (res) => {
        if (res.confirm) {
          this.manualAdd();
        }
      }
    });
  },

  selectScanMode(e) {
    const value = e.currentTarget.dataset.value;
    if (!value || value === this.data.scanMode) {
      return;
    }

    this.setData({
      scanMode: value
    });
  },

  showRecognizeUnavailable(imagePath, options = {}, reason = '', debugText = '') {
    const isRetryFlow = options.preset === 'retry';
    const normalizedErrorCode = inferRecognizeErrorCode(reason, debugText);
    const debugLines = buildRecognizeDebugLines(debugText);
    if (debugLines) {
      wx.showModal({
        title: '识别配置检查',
        content: debugLines,
        showCancel: false,
        confirmText: '继续',
        success: () => {
          this.showRecognizeUnavailable(imagePath, options, reason, '');
        }
      });
      return;
    }

    const message = debugText
      ? `${getRecognizeErrorMessage(normalizedErrorCode)}\n\n${debugText}`
      : getRecognizeErrorMessage(normalizedErrorCode);

    wx.showModal({
      title: '识别暂时不可用',
      content: message,
      confirmText: isRetryFlow ? '手动添加' : '高清重试',
      cancelText: isRetryFlow ? '关闭' : '手动添加',
      success: (res) => {
        if (isRetryFlow) {
          if (res.confirm) {
            this.manualAdd();
          }
          return;
        }

        if (res.confirm) {
          this.startRecognizeFlow(imagePath, { preset: 'retry' });
          return;
        }

        if (res.cancel) {
          this.manualAdd();
        }
      }
    });
  },

  startRecognizeFlow(imagePath, options = {}) {
    return this.runAnalyzeFood(imagePath, options);
  },

  async runAnalyzeFood(imagePath, options = {}) {
    const isDetailedOnly = options && options.recognizeProfile === 'detailed';
    let uploadedFileId = '';
    let preparedRequest = null;

    try {
      this.setRecognizeProgress(isDetailedOnly ? 'retry_refining' : 'recognizing');
      const prepared = await this.prepareRecognizeImage(imagePath, options);
      const compressedPath = prepared.compressedPath;
      const imageBase64 = prepared.imageBase64;
      const requestStrategy = prepared.requestStrategy || getRecognizeRequestStrategy({
        imageBase64Length: imageBase64 ? imageBase64.length : 0,
        maxInlineBase64Length: MAX_CLOUD_BASE64_LENGTH
      });

      if (requestStrategy.shouldUploadToCloud) {
        uploadedFileId = await this.uploadRecognizeImage(compressedPath);
      }

      preparedRequest = {
        ...prepared,
        uploadedFileId,
        requestStrategy,
        imageBase64
      };

      if (isDetailedOnly) {
        const detailedResult = await this.requestRecognizePass(imagePath, preparedRequest, options, {
          recognizeProfile: 'detailed',
          splitMode: 'detailed'
        });
        uploadedFileId = preparedRequest.uploadedFileId || uploadedFileId;
        this.applyRecognizeResult(detailedResult, imagePath, compressedPath, {
          recognizePhase: '',
          recognizePhaseText: '',
          isRecognizeRefining: false,
          recognizeNotice: ''
        });
        return;
      }

      const firstPassResult = await this.requestRecognizePass(imagePath, preparedRequest, options, {
        recognizeProfile: 'balanced',
        splitMode: this.data.scanMode || 'dish_first'
      });
      uploadedFileId = preparedRequest.uploadedFileId || uploadedFileId;
      const flowPlan = buildRecognizeFlowPlan(firstPassResult);

      this.applyRecognizeResult(firstPassResult, imagePath, compressedPath, {
        recognizePhase: flowPlan.shouldAutoRefine ? 'refining' : '',
        recognizePhaseText: flowPlan.shouldAutoRefine ? getRecognizePhaseMeta('refining').phaseText : '',
        isRecognizeRefining: !!flowPlan.shouldAutoRefine,
        recognizeNotice: ''
      });

      if (!flowPlan.shouldAutoRefine) {
        return;
      }

      this.setRecognizeProgress('refining');

      try {
        const refinedResult = await this.requestRecognizePass(imagePath, preparedRequest, options, {
          recognizeProfile: 'detailed',
          splitMode: 'detailed'
        });
        uploadedFileId = preparedRequest.uploadedFileId || uploadedFileId;
        this.applyRecognizeResult(refinedResult, imagePath, compressedPath, {
          recognizePhase: '',
          recognizePhaseText: '',
          isRecognizeRefining: false,
          recognizeNotice: ''
        });
      } catch (refineError) {
        if (!flowPlan.preserveFirstPassOnRefineFailure) {
          throw refineError;
        }

        this.handleRecognizeRefineFailure(
          imagePath,
          options,
          refineError,
          '首轮识别已保留，重新细分暂时失败，可稍后再试。'
        );
      }
    } catch (error) {
      if (isDetailedOnly && this.data.scanResult) {
        this.handleRecognizeRefineFailure(
          imagePath,
          options,
          error,
          '当前识别结果已保留，重新细分暂时失败，可稍后再试。'
        );
        return;
      }

      const reason = error && error.message ? error.message : 'recognize_failed';
      const debugText = error && error.debugText
        ? error.debugText
        : [`reason: ${reason}`, error && error.warning ? `warning: ${error.warning}` : '', error && error.errMsg ? `err: ${error.errMsg}` : '']
          .filter(Boolean)
          .join('\n');
      console.error(DEBUG_RECOGNIZE_PREFIX, 'analyze failed', {
        reason,
        errorCode: error && error.errorCode ? error.errorCode : '',
        warning: error && error.warning ? error.warning : '',
        debugText,
        imagePath,
        preset: options.preset || 'default'
      });

      if (error && (error.message === 'compress_failed' || error.message === 'image_too_large')) {
        this.showImageProcessUnavailable();
      } else {
        this.showRecognizeUnavailable(imagePath, options, reason, debugText);
      }
    } finally {
      this.deleteRecognizeUpload((preparedRequest && preparedRequest.uploadedFileId) || uploadedFileId);
      wx.hideLoading();
    }
  },

  async analyzeFood(imagePath, options = {}) {
    return this.runAnalyzeFood(imagePath, options);
  },

  recalculateScanResult(foods) {
    const nextFoods = foods.map((item, index) => ({
      ...item,
      id: item.id || `scan_food_${index + 1}`
    }));
    const total = sumFoods(nextFoods);
    this.setData({
      scanResult: {
        ...this.data.scanResult,
        foods: nextFoods,
        total,
        lowConfidence: nextFoods.some(item => item.confidence < 0.65)
      },
      showDetailedRescanHint: shouldSuggestDetailedSplit({
        ...this.data.scanResult,
        foods: nextFoods,
        total,
        lowConfidence: nextFoods.some(item => item.confidence < 0.65)
      })
    });
  },

  clearScanResult() {
    this.setData({
      scanResult: null,
      scanImagePath: '',
      scanCompressedPath: '',
      showDetailedRescanHint: false,
      recognizePhase: '',
      recognizePhaseText: '',
      isRecognizeRefining: false,
      recognizeNotice: '',
      isEditingScanResult: false,
      editingScanFoodIndex: -1
    });
    this.refreshTabBarVisibility();
  },

  retryDetailedRecognize() {
    if (!this.data.scanImagePath) {
      return;
    }

    this.runAnalyzeFood(this.data.scanImagePath, {
      preset: 'retry',
      recognizeProfile: 'detailed',
      splitMode: 'detailed'
    });
  },

  changePortion(e) {
    const index = Number(e.currentTarget.dataset.index);
    const portionKey = e.currentTarget.dataset.portionKey;
    const foods = this.data.scanResult.foods.slice();
    const food = foods[index];

    if (portionKey === 'custom') {
      foods[index] = {
        ...food,
        portionKey,
        customGrams: food.customGrams || String(food.estimatedWeight)
      };
      this.recalculateScanResult(foods);
      return;
    }

    foods[index] = createPortionAdjustedFood(food, { portionKey });
    this.recalculateScanResult(foods);
  },

  onCustomGramsInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = e.detail.value;
    const foods = this.data.scanResult.foods.slice();
    foods[index] = createPortionAdjustedFood(foods[index], {
      portionKey: 'custom',
      customGrams: value
    });
    this.recalculateScanResult(foods);
  },

  addToDaily() {
    const { scanResult, scanImagePath, todayStr } = this.data;
    if (!scanResult || !Array.isArray(scanResult.foods) || scanResult.foods.length === 0) {
      return;
    }

    if (scanResult.isMock || scanResult.source === 'fallback') {
      wx.showToast({
        title: '开发演示结果不能直接保存',
        icon: 'none'
      });
      return;
    }

    const groupId = util.generateId();
    const foods = util.getNutritionRecords(todayStr);
    const time = new Date().toISOString();

    scanResult.foods.forEach(item => {
      foods.push({
        id: util.generateId(),
        groupId,
        name: item.name,
        estimatedWeight: item.estimatedWeight,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        confidence: item.confidence,
        estimateTag: '估算值',
        source: 'ai_scan',
        note: scanResult.note,
        imagePath: scanImagePath,
        time
      });
    });

    util.saveNutritionRecords(todayStr, foods);
    this.clearScanResult();
    this.loadTodayRecords();

    wx.showToast({
      title: '已添加到今日记录',
      icon: 'success'
    });
    wx.vibrateShort({ type: 'light' });
  },

  manualAdd() {
    this.setData({
      showEntrySheet: false,
      showManualForm: true,
      isEditingScanResult: false,
      editingScanFoodIndex: -1,
      scanResult: null,
      scanImagePath: '',
      scanCompressedPath: '',
      recognizePhase: '',
      recognizePhaseText: '',
      isRecognizeRefining: false,
      recognizeNotice: '',
      foodSuggestions: [],
      manualForm: createEmptyManualForm()
    });
    this._manualBase = null;
    this.setCustomTabBarHidden(true);
  },

  editScanResult() {
    if (!this.data.scanResult || !this.data.scanResult.foods.length) {
      return;
    }

    this.editScanFood({
      currentTarget: {
        dataset: {
          index: 0
        }
      }
    });
  },

  editScanFood(e) {
    const index = Number(e.currentTarget.dataset.index);
    const food = this.data.scanResult.foods[index];
    if (!food) {
      return;
    }

    this.setData({
      showManualForm: true,
      isEditingScanResult: true,
      editingScanFoodIndex: index,
      manualForm: {
        name: food.name || '',
        estimatedWeight: food.estimatedWeight !== undefined ? String(food.estimatedWeight) : '',
        calories: food.calories !== undefined ? String(food.calories) : '',
        protein: food.protein !== undefined ? String(food.protein) : '',
        fat: food.fat !== undefined ? String(food.fat) : '',
        carbs: food.carbs !== undefined ? String(food.carbs) : ''
      }
    });
    this.setCustomTabBarHidden(true);
  },

  closeManualForm() {
    this.setData({
      showManualForm: false,
      isEditingScanResult: false,
      editingScanFoodIndex: -1
    });
    this.refreshTabBarVisibility();
  },

  // 手动填写：填了内容再返回时先确认
  isManualDirty() {
    const form = this.data.manualForm || {};
    return !!this.data.showManualForm && !this.data.isEditingScanResult
      && ['name', 'estimatedWeight', 'calories', 'protein', 'fat', 'carbs'].some(key => String(form[key] || '').trim());
  },

  confirmDiscardManual(onKeep) {
    wx.showModal({
      title: '放弃这条记录？',
      content: '填写的内容还没有添加。',
      confirmText: '放弃',
      confirmColor: '#E06A5F',
      cancelText: '继续填写',
      success: result => {
        if (result.confirm) {
          this.closeManualForm();
          if (this.data.scanResult) this.setData({ subpageOn: false }, () => this.setData({ subpageOn: true }));
          else this.setData({ subpageOn: true });
        } else if (onKeep) onKeep();
      },
      fail: () => { if (onKeep) onKeep(); }
    });
  },

  requestCloseManual() {
    if (this.isManualDirty()) this.confirmDiscardManual();
    else this.closeManualForm();
  },

  clearManualName() {
    this.setData({ 'manualForm.name': '' });
  },

  onManualInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const update = { [`manualForm.${field}`]: value };
    if (field === 'name') {
      // 改了名字：之前选中的参考值失效，重新给候选
      this._manualBase = null;
      update.foodSuggestions = foodSuggest.suggestFoods(value, this._frequentRaw || []);
    } else if (field === 'estimatedWeight' && this._manualBase && Number(value) > 0) {
      // 选过候选后改重量：营养值按比例重新算
      const filled = foodSuggest.applySuggestion(this._manualBase, Number(value));
      ['calories', 'protein', 'fat', 'carbs'].forEach(key => { update[`manualForm.${key}`] = filled[key]; });
    } else if (['calories', 'protein', 'fat', 'carbs'].includes(field)) {
      // 手动改了营养值，以用户填写为准
      this._manualBase = null;
    }
    this.setData(update);
  },

  // 最近 60 天里常吃的食物
  loadFrequentFoods() {
    const dates = util.getNutritionDates().slice().sort().reverse().slice(0, 60);
    const recordsByDate = {};
    dates.forEach(date => { recordsByDate[date] = util.getNutritionRecords(date); });
    this._frequentRaw = require('../../utils/food-shortcuts.js').combine(wx.getStorageSync('favorite_foods') || [], foodSuggest.frequentFoods(recordsByDate, 12), 12);
    return this._frequentRaw.map(item => ({ name: item.name, calories: item.calories, weight: item.estimatedWeight }));
  },

  toggleFavorite(e) {
    const food = util.getNutritionRecords(this.data.todayStr)[Number(e.currentTarget.dataset.index)];
    if (!food) return;
    const favorites = wx.getStorageSync('favorite_foods') || [];
    const found = favorites.some(item => item.name === food.name);
    wx.setStorageSync('favorite_foods', found ? favorites.filter(item => item.name !== food.name)
      : [require('../../utils/food-shortcuts.js').favorite(food)].concat(favorites).slice(0, 50));
    this.setData({ frequentFoods: this.loadFrequentFoods() });
    this.openMealSheet({ currentTarget: { dataset: { index: this.data.mealGroups.findIndex(group => group.key === this.data.mealSheet.key) } } });
    wx.showToast({ title: found ? '已移出常吃' : '已加入常吃', icon: 'none' });
  },
  copyYesterday() {
    const today = this.data.todayStr;
    const yesterday = require('../../utils/schedule.js').addDays(today, -1);
    const foods = util.getNutritionRecords(yesterday);
    const groups = require('../../utils/records-view.js').buildMealGroups(foods);
    if (!groups.length) { wx.showToast({ title: '昨天没有饮食记录', icon: 'none' }); return; }
    wx.showActionSheet({ itemList: groups.map(group => `${group.label} · ${group.items.length} 项 · ${group.calories} kcal`), success: result => {
      const group = groups[result.tapIndex]; if (!group) return;
      const copies = require('../../utils/food-shortcuts.js').copyMeal(foods, group.items.map(item => item.index), today, util.generateId);
      util.saveNutritionRecords(today, util.getNutritionRecords(today).concat(copies));
      this.loadTodayRecords(); wx.showToast({ title: `已复制昨天的${group.label}`, icon: 'none' });
    } });
  },
  pickFoodSuggestion(e) {
    const suggestion = this.data.foodSuggestions[Number(e.currentTarget.dataset.index)];
    if (!suggestion) return;
    this._manualBase = suggestion.per100 ? suggestion : null;
    this.setData({ manualForm: foodSuggest.applySuggestion(suggestion), foodSuggestions: [] });
  },

  // 弹层里的“常吃的”：一键按上次的份量加到今天
  quickAddFrequent(e) {
    const item = (this._frequentRaw || [])[Number(e.currentTarget.dataset.index)];
    if (!item) return;
    const foods = util.getNutritionRecords(this.data.todayStr);
    foods.push({
      id: util.generateId(),
      name: item.name,
      estimatedWeight: item.estimatedWeight || '',
      calories: item.calories,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      imagePath: '',
      source: 'frequent',
      time: new Date().toISOString()
    });
    util.saveNutritionRecords(this.data.todayStr, foods);
    this.closeEntrySheet();
    this.loadTodayRecords();
    wx.showToast({ title: `已添加${item.name}`, icon: 'success' });
  },

  submitManualForm() {
    const { manualForm, todayStr, isEditingScanResult, editingScanFoodIndex, scanResult } = this.data;
    const name = manualForm.name.trim();

    if (!name) {
      wx.showToast({
        title: '请输入食物名称',
        icon: 'none'
      });
      return;
    }

    const manualFood = {
      id: util.generateId(),
      name,
      estimatedWeight: Number(manualForm.estimatedWeight) || 0,
      calories: Number(manualForm.calories) || 0,
      protein: Number(manualForm.protein) || 0,
      fat: Number(manualForm.fat) || 0,
      carbs: Number(manualForm.carbs) || 0
    };

    if (isEditingScanResult && scanResult && scanResult.foods[editingScanFoodIndex]) {
      const currentFood = scanResult.foods[editingScanFoodIndex];
      const foods = scanResult.foods.slice();
      foods[editingScanFoodIndex] = createPortionAdjustedFood({
        ...currentFood,
        id: currentFood.id,
        name: manualFood.name,
        baseWeight: manualFood.estimatedWeight || currentFood.baseWeight || 100,
        estimatedWeight: manualFood.estimatedWeight || currentFood.estimatedWeight,
        baseCalories: manualFood.calories,
        calories: manualFood.calories,
        baseProtein: manualFood.protein,
        protein: manualFood.protein,
        baseFat: manualFood.fat,
        fat: manualFood.fat,
        baseCarbs: manualFood.carbs,
        carbs: manualFood.carbs,
        confidence: currentFood.confidence
      }, {
        portionKey: 'standard'
      });

      this.recalculateScanResult(foods);
      this.setData({
        showManualForm: false,
        isEditingScanResult: false,
        editingScanFoodIndex: -1,
        manualForm: createEmptyManualForm()
      });
      this.refreshTabBarVisibility();
      wx.showToast({
        title: '识别结果已更新',
        icon: 'success'
      });
      return;
    }

    const foods = util.getNutritionRecords(todayStr);
    foods.push({
      id: util.generateId(),
      name: manualFood.name,
      estimatedWeight: manualFood.estimatedWeight,
      calories: manualFood.calories,
      protein: manualFood.protein,
      fat: manualFood.fat,
      carbs: manualFood.carbs,
      imagePath: '',
      source: 'manual',
      time: new Date().toISOString()
    });
    util.saveNutritionRecords(todayStr, foods);

    this.setData({
      showManualForm: false,
      isEditingScanResult: false,
      editingScanFoodIndex: -1,
      manualForm: createEmptyManualForm()
    });
    this.refreshTabBarVisibility();
    this.loadTodayRecords();

    wx.showToast({
      title: '已添加',
      icon: 'success'
    });
  },

  deleteFood(e) {
    const index = Number(e.currentTarget.dataset.index);
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条饮食记录吗？',
      confirmColor: '#C96565',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const foods = this.data.todayFoods.slice();
        foods.splice(index, 1);
        util.saveNutritionRecords(this.data.todayStr, foods);
        this.loadTodayRecords();
        wx.showToast({
          title: '已删除',
          icon: 'success'
        });
      }
    });
  },

  noop() {}
});
