const util = require('../../utils/util.js');
const {
  createPortionAdjustedFood
} = require('../../utils/mvp-core.js');
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

const RECOGNIZE_UNAVAILABLE_MESSAGE = '识别暂时不可用，请稍后重试或手动添加。';
const IMAGE_PROCESS_FAILED_MESSAGE = '图片处理失败，请重新选择图片或手动添加。';

const PORTION_OPTIONS = [
  { key: 'small', label: '小份' },
  { key: 'standard', label: '标准份' },
  { key: 'large', label: '大份' },
  { key: 'custom', label: '自定义克数' }
];

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
const BROAD_DISH_KEYWORDS = ['盖浇饭', '便当', '拼盘', '套餐', '麻辣烫', '火锅', '炒饭', '拌饭', '盖饭', '沙拉碗'];

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

function shouldSuggestDetailedSplit(scanResult) {
  if (!scanResult || !Array.isArray(scanResult.foods) || scanResult.foods.length !== 1) {
    return false;
  }

  const name = String(scanResult.foods[0].name || '').trim();
  return !!name && BROAD_DISH_KEYWORDS.some(keyword => name.indexOf(keyword) >= 0);
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
  const lines = [
    `host: ${debug.host || ''}`,
    `model: ${debug.model || ''}`,
    `key: ${keyPreview.prefix || ''}...${keyPreview.suffix || ''} (${keyPreview.length || 0})`,
    `img: ${debug.imageBase64Length || 0}`
  ];

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
    todayFoods: [],
    scanResult: null,
    scanImagePath: '',
    scanCompressedPath: '',
    showDetailedRescanHint: false,
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
      { key: 'sedentary', label: '久坐 / 轻活动' },
      { key: 'light', label: '轻量活动' },
      { key: 'moderate', label: '中等活动' },
      { key: 'active', label: '较高活动' }
    ],
    goalOptions: [
      { key: 'maintain', label: '保持健康记录' },
      { key: 'muscle_gain', label: '增肌训练参考' },
      { key: 'custom', label: '自定义目标' }
    ]
  },

  onShow() {
    this.syncCustomTabBar();
    this.initPage();
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
      selected: 2,
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
  },

  loadTodayRecords() {
    const foods = util.getNutritionRecords(this.data.todayStr);
    const dailyTotal = util.calcDailyNutrition(foods);
    this.setData({
      todayFoods: foods,
      dailyTotal
    }, () => {
      this.loadGoalSummary();
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

    const noteText = `${profile.goal === 'custom' ? '自定义目标' : (profile.goal === 'muscle_gain' ? '增肌训练参考' : '保持健康记录')} · 以每日参考热量和营养参考目标为主，不做强制限制。`;

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

  openGoalForm() {
    this.setData({
      showGoalForm: true,
      goalForm: createGoalForm(util.getNutritionGoalProfile())
    });
    this.setCustomTabBarHidden(true);
  },

  closeGoalForm() {
    this.setData({
      showGoalForm: false
    });
    this.setCustomTabBarHidden(false);
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
    this.setCustomTabBarHidden(false);
  },

  onGoalInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`goalForm.${field}`]: e.detail.value
    });
  },

  selectGoalGender(e) {
    this.setData({
      'goalForm.gender': e.currentTarget.dataset.value
    });
  },

  selectGoalActivity(e) {
    this.setData({
      'goalForm.activityLevel': e.currentTarget.dataset.value
    });
  },

  selectGoalType(e) {
    this.setData({
      'goalForm.goal': e.currentTarget.dataset.value
    });
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
    this.setData({
      showGoalForm: false
    });
    this.setCustomTabBarHidden(false);
    this.loadGoalSummary();

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

  isBase64PayloadTooLarge(base64) {
    return !!(base64 && base64.length > MAX_CLOUD_BASE64_LENGTH);
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

      if (!this.isBase64PayloadTooLarge(imageBase64)) {
        return {
          compressedPath,
          imageBase64,
          compressOptions,
          downgraded: i > 0
        };
      }
    }

    const oversizeError = new Error('image_too_large');
    oversizeError.debugText = `img: ${lastBase64.length}`;
    oversizeError.compressedPath = lastCompressedPath;
    throw oversizeError;
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
          splitMode: this.data.scanMode || 'dish_first',
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
    wx.showLoading({
      title: '识别中...'
    });

    let uploadedFileId = '';

    try {
      const prepared = await this.prepareRecognizeImage(imagePath, options);
      const compressedPath = prepared.compressedPath;
      const imageBase64 = prepared.imageBase64;
      uploadedFileId = await this.uploadRecognizeImage(compressedPath);

      console.log(DEBUG_RECOGNIZE_PREFIX, 'before call cloud function', {
        imagePath,
        compressedPath,
        base64Length: imageBase64.length,
        preset: options.preset || 'default',
        payloadGuard: MAX_CLOUD_BASE64_LENGTH,
        uploadedFileId
      });

      const result = await this.callFoodRecognize({
        fileID: uploadedFileId,
        imageBase64: ''
      }, options);
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

      this.setData({
        scanResult,
        scanImagePath: imagePath,
        scanCompressedPath: compressedPath,
        showDetailedRescanHint: shouldSuggestDetailedSplit(scanResult),
        showManualForm: false,
        isEditingScanResult: false,
        editingScanFoodIndex: -1
      });
    } catch (error) {
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
      this.deleteRecognizeUpload(uploadedFileId);
      wx.hideLoading();
    }
  },

  async analyzeFoodLegacy(imagePath, options = {}) {
    return this.runAnalyzeFood(imagePath, options);
    wx.showLoading({
      title: '正在识别...'
    });

    try {
      const compressedPath = await this.compressFoodImage(imagePath, compressOptions);
      if (!compressedPath) {
        throw new Error('missing_image');
      }

      const imageBase64 = await this.readFileAsBase64(compressedPath);
      if (!imageBase64) {
        throw new Error('empty_base64');
      }

      console.log(DEBUG_RECOGNIZE_PREFIX, 'before call cloud function', {
        imagePath,
        compressedPath,
        base64Length: imageBase64.length,
        preset: options.preset || 'default',
        payloadGuard: MAX_CLOUD_BASE64_LENGTH
      });

      const result = await this.callFoodRecognize(imageBase64, options);
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

      this.setData({
        scanResult,
        scanImagePath: imagePath,
        scanCompressedPath: compressedPath,
        showManualForm: false,
        isEditingScanResult: false,
        editingScanFoodIndex: -1
      });
    } catch (error) {
      const reason = error && error.message ? error.message : 'recognize_failed';
      const debugText = error && error.debugText ? error.debugText : '';
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
        foods: nextFoods
      })
    });
  },

  clearScanResult() {
    this.setData({
      scanResult: null,
      scanImagePath: '',
      scanCompressedPath: '',
      showDetailedRescanHint: false,
      isEditingScanResult: false,
      editingScanFoodIndex: -1
    });
  },

  retryDetailedRecognize() {
    if (!this.data.scanImagePath) {
      return;
    }

    this.setData({
      scanMode: 'detailed'
    });
    this.runAnalyzeFood(this.data.scanImagePath, { preset: 'retry' });
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
      manualForm: createEmptyManualForm()
    });
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
    this.setCustomTabBarHidden(false);
  },

  onManualInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`manualForm.${field}`]: e.detail.value
    });
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
      this.setCustomTabBarHidden(false);
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
    this.setCustomTabBarHidden(false);
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
