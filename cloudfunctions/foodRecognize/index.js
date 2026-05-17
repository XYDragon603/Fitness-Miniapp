const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const DEFAULT_NOTE = 'AI识别结果仅供记录参考，请根据实际份量自行调整。';
const LOW_CONFIDENCE_NOTE = '识别结果可能不完整，请根据实际菜品手动调整。';
const COMPLEX_FOOD_NOTE = '如果是火锅、麻辣烫、自助餐、拼盘、盖饭或便当等复杂混合食物，建议优先确认主要食材和份量。';
const DEFAULT_MODEL = 'Qwen/Qwen3-Omni-30B-A3B-Instruct';
const DEFAULT_HOST = 'api.siliconflow.cn';
const RECOGNIZE_UNAVAILABLE_MESSAGE = '识别暂时不可用，请稍后重试或手动添加。';
const REQUEST_TIMEOUT_MS = 25000;
const DEVELOPMENT_MODE = process.env.NODE_ENV === 'development';
const SOURCE_SILICONFLOW = 'siliconflow';
const SOURCE_FALLBACK = 'fallback';

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function roundInt(value) {
  return Math.round(Number(value) || 0);
}

function buildFallbackResult() {
  return {
    foods: [
      {
        name: '番茄炒蛋',
        estimatedWeight: 220,
        calories: 268,
        protein: 13.8,
        fat: 17.2,
        carbs: 11.4,
        confidence: 0.56
      }
    ],
    total: {
      calories: 268,
      protein: 13.8,
      fat: 17.2,
      carbs: 11.4
    },
    note: `${DEFAULT_NOTE}${LOW_CONFIDENCE_NOTE}${COMPLEX_FOOD_NOTE}`
  };
}

function parseJsonFromText(content) {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (nestedError) {
      return null;
    }
  }
}

function normalizeFood(food, index) {
  return {
    id: `scan_food_${index + 1}`,
    name: food && food.name ? String(food.name).trim() : `识别项 ${index + 1}`,
    estimatedWeight: Math.max(1, roundInt(food && food.estimatedWeight) || 100),
    calories: Math.max(0, roundInt(food && food.calories)),
    protein: Math.max(0, round1(food && food.protein)),
    fat: Math.max(0, round1(food && food.fat)),
    carbs: Math.max(0, round1(food && food.carbs)),
    confidence: Math.max(0, Math.min(1, Number(food && food.confidence) || 0.5))
  };
}

function mergeNote(baseNote, extraNotes) {
  const parts = [];
  const seen = new Set();

  [baseNote].concat(extraNotes || []).forEach((item) => {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) {
      return;
    }

    seen.add(value);
    parts.push(value);
  });

  return parts.join('');
}

function normalizeResult(payload, allowFallback) {
  const foods = Array.isArray(payload && payload.foods) && payload.foods.length > 0
    ? payload.foods.map(normalizeFood)
    : (allowFallback ? buildFallbackResult().foods : []);

  if (!foods.length) {
    return null;
  }

  const total = foods.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    protein: round1(sum.protein + item.protein),
    fat: round1(sum.fat + item.fat),
    carbs: round1(sum.carbs + item.carbs)
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const hasLowConfidence = foods.some(item => item.confidence < 0.65);
  const note = mergeNote(
    payload && payload.note ? payload.note : DEFAULT_NOTE,
    [
      hasLowConfidence ? LOW_CONFIDENCE_NOTE : '',
      foods.length > 1 ? '' : COMPLEX_FOOD_NOTE
    ]
  );

  return {
    foods,
    total,
    note
  };
}

function buildRequestPrompt(splitMode) {
  const preferDetailed = splitMode !== 'dish_first';

  return {
    system: [
      '你是营养记录助手，负责识别餐食图片并返回估算值。',
      '优先识别常见中餐菜品、主食和混合餐。',
      preferDetailed
        ? '请识别图片中的主要食物组成，不要只返回一个笼统菜名。'
        : '优先返回更稳定的整体菜名；只有在明显分开摆放时再拆分。',
      preferDetailed
        ? '如果看到米饭和配菜分开摆放，应尽量拆分为白米饭、虾仁或肉类、蔬菜、酱汁等独立 foods 项。'
        : '如果米饭和配菜虽然同框但边界不清，可以优先返回整体菜品估算。',
      '如果无法确认具体食材，请使用“疑似xx”或“配菜”“酱汁”等更稳妥的描述。',
      '重量按熟食可食部分估算，单位是克，营养信息必须是估算值。',
      '如果是火锅、麻辣烫、自助餐、拼盘、盖饭、拌饭、便当等复杂混合食物，请在 note 中提醒用户确认主要食材和份量。',
      '如果画面模糊、遮挡严重、角度不完整、餐具挡住主体或菜品边界不清，请降低 confidence。',
      'confidence 范围是 0 到 1。',
      '只返回 JSON，不要返回 markdown，不要返回解释，不要返回代码块。',
      '固定 JSON 结构：{"foods":[{"name":"","estimatedWeight":0,"calories":0,"protein":0,"fat":0,"carbs":0,"confidence":0}],"total":{"calories":0,"protein":0,"fat":0,"carbs":0},"note":""}'
    ].join(' '),
    user: [
      '请识别图片中的食物。',
      '优先识别常见中餐菜品，例如番茄炒蛋、青椒肉丝、宫保鸡丁、炒饭、牛肉面、麻辣烫、盖浇饭、便当等。',
      '如果不能可靠拆分，请返回整体估算并在 note 中说明。',
      preferDetailed
        ? '如果米饭、主菜、蔬菜、酱汁是分开摆放的，请尽量分别列出，不要只写一个笼统菜名。'
        : '如果菜品组合较复杂，请优先返回整体菜名，必要时再补充配菜说明。',
      '如果某一项看不清，请用“疑似xx”或“配菜”“酱汁”描述。',
      '如果置信度低，请在 note 中加入“识别结果可能不完整，请根据实际菜品手动调整。”',
      '请只返回 JSON。'
    ].join(' ')
  };
}

function extractMessageContent(message) {
  if (!message) {
    return '';
  }

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message)) {
    return message
      .map((item) => {
        if (!item) {
          return '';
        }
        if (typeof item === 'string') {
          return item;
        }
        if (typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof message.text === 'string') {
    return message.text;
  }

  return '';
}

function requestSiliconFlow(apiKey, model, imageBase64, host, splitMode, imageDetail) {
  const prompt = buildRequestPrompt(splitMode);
  const preferDetailed = splitMode !== 'dish_first';
  const compositionHint = [
    '补充规则：优先识别主要食物组成。',
    '只要主食、主菜、蔬菜、酱汁边界清楚，就分别列出，不要只返回“盖浇饭”“便当”“拼盘”这类总称。',
    '如果看到白米饭与配菜分开摆放，优先拆分为白米饭、肉类或虾仁、蔬菜、酱汁。',
    '如果有明显酱汁、汤汁、蘸料，请尽量单独列一项。',
    '如果无法确定具体食材，请使用“疑似xx”“配菜”“酱汁”等描述。'
  ].join(' ');
  const requestBody = JSON.stringify({
    model,
    stream: false,
    temperature: preferDetailed ? 0.1 : 0.05,
    max_tokens: preferDetailed ? 1100 : 700,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `${prompt.system} ${compositionHint}`
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: imageDetail || (preferDetailed ? 'high' : 'low')
            }
          },
          {
            type: 'text',
            text: `${prompt.user} ${compositionHint}`
          }
        ]
      }
    ]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host || DEFAULT_HOST,
      path: '/v1/chat/completions',
      method: 'POST',
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        Authorization: `Bearer ${apiKey}`
      }
    }, (res) => {
      let raw = '';

      res.on('data', chunk => {
        raw += chunk;
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`SiliconFlow ${res.statusCode}: ${raw}`));
          return;
        }

        try {
          const parsed = JSON.parse(raw);
          const content = extractMessageContent(
            parsed &&
            parsed.choices &&
            parsed.choices[0] &&
            parsed.choices[0].message &&
            parsed.choices[0].message.content
          );

          if (!content) {
            reject(new Error('empty_ai_content'));
            return;
          }

          resolve(content);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('request_timeout'));
    });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function buildSuccessResponse(source, data, extras = {}) {
  return {
    success: true,
    source,
    data,
    ...extras
  };
}

function buildFailureResponse(error, message, extras = {}) {
  return {
    success: false,
    error,
    message,
    ...extras
  };
}

function maskKeyPreview(apiKey) {
  const value = String(apiKey || '').trim();
  if (!value) {
    return {
      length: 0,
      prefix: '',
      suffix: ''
    };
  }

  return {
    length: value.length,
    prefix: value.slice(0, 6),
    suffix: value.slice(-4)
  };
}

function buildDebugPayload(host, model, apiKey, imageBase64) {
  return {
    host: host || DEFAULT_HOST,
    model: model || DEFAULT_MODEL,
    keyPreview: maskKeyPreview(apiKey),
    imageBase64Length: imageBase64 ? imageBase64.length : 0
  };
}

async function getImageBase64FromFileID(fileID) {
  const result = await cloud.downloadFile({
    fileID
  });

  if (!result || !result.fileContent) {
    return '';
  }

  return Buffer.from(result.fileContent).toString('base64');
}

exports.main = async (event) => {
  const fileID = event && event.fileID ? String(event.fileID) : '';
  let imageBase64 = event && event.imageBase64 ? String(event.imageBase64) : '';
  const apiKey = process.env.SILICONFLOW_API_KEY || '';
  const model = process.env.SILICONFLOW_MODEL || DEFAULT_MODEL;
  const host = process.env.SILICONFLOW_HOST || DEFAULT_HOST;
  const splitMode = event && event.splitMode === 'dish_first' ? 'dish_first' : 'detailed';
  const imageDetail = event && event.imageDetail === 'high' ? 'high' : 'low';
  if (!imageBase64 && fileID) {
    try {
      imageBase64 = await getImageBase64FromFileID(fileID);
    } catch (error) {
      return buildFailureResponse('download_failed', RECOGNIZE_UNAVAILABLE_MESSAGE, {
        warning: error.message,
        debug: buildDebugPayload(host, model, apiKey, '')
      });
    }
  }

  const debug = buildDebugPayload(host, model, apiKey, imageBase64);

  console.log('[foodRecognize] runtime config', {
    ...debug
  });

  if (!imageBase64) {
    return buildFailureResponse('missing_image', RECOGNIZE_UNAVAILABLE_MESSAGE, {
      debug
    });
  }

  if (!apiKey) {
    if (DEVELOPMENT_MODE) {
      return buildSuccessResponse(SOURCE_FALLBACK, buildFallbackResult(), {
        isMock: true,
        warning: 'missing_api_key',
        debug
      });
    }

    return buildFailureResponse('missing_api_key', RECOGNIZE_UNAVAILABLE_MESSAGE, {
      debug
    });
  }

  try {
    const content = await requestSiliconFlow(apiKey, model, imageBase64, host, splitMode, imageDetail);
    const payload = parseJsonFromText(content);
    const normalized = normalizeResult(payload, false);

    if (!normalized) {
      if (DEVELOPMENT_MODE) {
        return buildSuccessResponse(SOURCE_FALLBACK, buildFallbackResult(), {
          isMock: true,
          warning: 'invalid_ai_response',
          debug
        });
      }

      return buildFailureResponse('invalid_ai_response', RECOGNIZE_UNAVAILABLE_MESSAGE, {
        debug
      });
    }

    return buildSuccessResponse(SOURCE_SILICONFLOW, normalized, {
      debug
    });
  } catch (error) {
    if (DEVELOPMENT_MODE) {
      return buildSuccessResponse(SOURCE_FALLBACK, buildFallbackResult(), {
        isMock: true,
        warning: error.message,
        debug
      });
    }

    return buildFailureResponse('recognize_failed', RECOGNIZE_UNAVAILABLE_MESSAGE, {
      warning: error.message,
      debug
    });
  }
};
