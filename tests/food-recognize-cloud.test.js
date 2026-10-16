const assert = require('assert');
const { EventEmitter } = require('events');
const Module = require('module');

const originalLoad = Module._load;

Module._load = function mockWxServerSdk(request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return {
      DYNAMIC_CURRENT_ENV: Symbol('dynamic-current-env'),
      init() {},
      downloadFile: async () => ({ fileContent: Buffer.from('') })
    };
  }

  return originalLoad(request, parent, isMain);
};

const {
  main,
  pickRecognizeImageInput,
  getRecognizeProfileConfig
} = require('../cloudfunctions/foodRecognize/index.js');

Module._load = originalLoad;

function testPickRecognizeImageInputPrefersInlineBase64() {
  const input = pickRecognizeImageInput({
    imageBase64: 'inline-image',
    fileID: 'cloud://food-image'
  });

  assert.deepStrictEqual(input, {
    imageBase64: 'inline-image',
    fileID: '',
    source: 'inline_base64'
  });
}

function testPickRecognizeImageInputFallsBackToFileId() {
  const input = pickRecognizeImageInput({
    fileID: 'cloud://food-image'
  });

  assert.deepStrictEqual(input, {
    imageBase64: '',
    fileID: 'cloud://food-image',
    source: 'cloud_file'
  });
}

function testBalancedProfileIsLighterThanDetailed() {
  const balanced = getRecognizeProfileConfig('balanced');
  const detailed = getRecognizeProfileConfig('detailed');

  assert(balanced.maxTokens < detailed.maxTokens);
  assert(balanced.temperature <= detailed.temperature);
}

async function testDetailedProfileUsesProfileDefaultImageDetail() {
  const https = require('https');
  const originalRequest = https.request;
  const originalApiKey = process.env.SILICONFLOW_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  let capturedRequestBody = '';

  process.env.SILICONFLOW_API_KEY = 'sk-test-secret';
  delete process.env.NODE_ENV;

  https.request = (options, callback) => {
    const response = new EventEmitter();
    response.statusCode = 200;
    callback(response);

    return {
      on() {
        return this;
      },
      write(chunk) {
        capturedRequestBody += chunk;
      },
      end() {
        process.nextTick(() => {
          response.emit('data', JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    foods: [
                      {
                        name: 'rice',
                        estimatedWeight: 100,
                        calories: 116,
                        protein: 2.6,
                        fat: 0.3,
                        carbs: 25.9,
                        confidence: 0.91
                      }
                    ],
                    note: 'ok'
                  })
                }
              }
            ]
          }));
          response.emit('end');
        });
      },
      destroy(error) {
        throw error;
      }
    };
  };

  try {
    const result = await main({
      imageBase64: 'inline-image',
      recognizeProfile: 'detailed'
    });
    const requestPayload = JSON.parse(capturedRequestBody);
    const imageUrl = requestPayload.messages[1].content[0].image_url;

    assert.strictEqual(imageUrl.detail, 'high');
    assert.strictEqual(result.debug.recognizeProfile, 'detailed');
    assert.ok(!Object.prototype.hasOwnProperty.call(result.debug, 'keyPreview'));
  } finally {
    https.request = originalRequest;

    if (typeof originalApiKey === 'undefined') {
      delete process.env.SILICONFLOW_API_KEY;
    } else {
      process.env.SILICONFLOW_API_KEY = originalApiKey;
    }

    if (typeof originalNodeEnv === 'undefined') {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
}

async function run() {
  testPickRecognizeImageInputPrefersInlineBase64();
  testPickRecognizeImageInputFallsBackToFileId();
  testBalancedProfileIsLighterThanDetailed();
  await testDetailedProfileUsesProfileDefaultImageDetail();
  console.log('food recognize cloud tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
