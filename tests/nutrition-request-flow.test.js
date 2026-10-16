const assert = require('assert');
const path = require('path');

function loadNutritionPage() {
  const pagePath = path.resolve(__dirname, '../pages/nutrition/nutrition.js');
  delete require.cache[pagePath];

  let capturedPage = null;
  const previousGlobals = {
    getApp: global.getApp,
    Page: global.Page,
    wx: global.wx
  };

  global.getApp = () => ({ globalData: {} });
  global.Page = (definition) => {
    capturedPage = definition;
  };
  global.wx = {
    showLoading() {},
    hideLoading() {},
    showModal() {},
    showToast() {},
    vibrateShort() {},
    navigateTo() {},
    cloud: {}
  };

  require(pagePath);

  return {
    ...capturedPage,
    data: JSON.parse(JSON.stringify(capturedPage.data || {})),
    restoreGlobals() {
      global.getApp = previousGlobals.getApp;
      global.Page = previousGlobals.Page;
      global.wx = previousGlobals.wx;
    },
    setData(update) {
      Object.keys(update).forEach((key) => {
        this.data[key] = update[key];
      });
    }
  };
}

async function testPrepareRecognizeImageAllowsCloudFileFallback() {
  const page = loadNutritionPage();

  try {
    page.compressFoodImage = async () => 'compressed.jpg';
    page.readFileAsBase64 = async () => 'x'.repeat(900000);

    const prepared = await page.prepareRecognizeImage('input.jpg');

    assert.strictEqual(prepared.compressedPath, 'compressed.jpg');
    assert.strictEqual(prepared.imageBase64.length, 900000);
    assert.deepStrictEqual(prepared.requestStrategy, {
      mode: 'cloud_file',
      shouldUploadToCloud: true
    });
  } finally {
    page.restoreGlobals();
  }
}

async function testRunAnalyzeFoodUsesInlineBase64WhenItFits() {
  const page = loadNutritionPage();
  let uploadCalled = 0;
  const recognizePayloads = [];

  try {
    page.prepareRecognizeImage = async () => ({
      compressedPath: 'compressed-inline.jpg',
      imageBase64: 'abc123',
      requestStrategy: {
        mode: 'inline_base64',
        shouldUploadToCloud: false
      }
    });
    page.uploadRecognizeImage = async () => {
      uploadCalled += 1;
      return 'should-not-upload';
    };
    page.callFoodRecognize = async (payload) => {
      recognizePayloads.push(payload);
      return {
        success: true,
        source: 'openai',
        data: {
          foods: [
            {
              name: '番茄炒蛋',
              estimatedWeight: 180,
              calories: 220,
              protein: 12,
              fat: 14,
              carbs: 9,
              confidence: 0.82
            }
          ]
        }
      };
    };
    page.deleteRecognizeUpload = () => {};

    await page.runAnalyzeFood('input.jpg');

    assert.strictEqual(uploadCalled, 0);
    assert.deepStrictEqual(recognizePayloads, [
      {
        fileID: '',
        imageBase64: 'abc123',
        recognizeProfile: 'balanced',
        splitMode: 'dish_first'
      }
    ]);
  } finally {
    page.restoreGlobals();
  }
}

async function testRunAnalyzeFoodFallsBackToCloudFileAfterInlinePayloadLimit() {
  const page = loadNutritionPage();
  let uploadCalled = 0;
  const recognizePayloads = [];
  let deletedFileId = '';

  try {
    page.prepareRecognizeImage = async () => ({
      compressedPath: 'compressed-fallback.jpg',
      imageBase64: 'abc123',
      requestStrategy: {
        mode: 'inline_base64',
        shouldUploadToCloud: false
      }
    });
    page.uploadRecognizeImage = async (filePath) => {
      uploadCalled += 1;
      assert.strictEqual(filePath, 'compressed-fallback.jpg');
      return 'cloud://fallback-file-id';
    };
    page.callFoodRecognize = async (payload) => {
      recognizePayloads.push(payload);
      if (recognizePayloads.length === 1) {
        const error = new Error('image_too_large');
        error.errMsg = 'cloud.callFunction:fail Error: data exceed max size';
        throw error;
      }

      return {
        success: true,
        source: 'openai',
        data: {
          foods: [
            {
              name: '番茄炒蛋',
              estimatedWeight: 180,
              calories: 220,
              protein: 12,
              fat: 14,
              carbs: 9,
              confidence: 0.82
            }
          ]
        }
      };
    };
    page.deleteRecognizeUpload = (fileID) => {
      deletedFileId = fileID;
    };

    await page.runAnalyzeFood('input.jpg');

    assert.strictEqual(uploadCalled, 1);
    assert.deepStrictEqual(recognizePayloads, [
      {
        fileID: '',
        imageBase64: 'abc123',
        recognizeProfile: 'balanced',
        splitMode: 'dish_first'
      },
      {
        fileID: 'cloud://fallback-file-id',
        imageBase64: '',
        recognizeProfile: 'balanced',
        splitMode: 'dish_first'
      }
    ]);
    assert.strictEqual(deletedFileId, 'cloud://fallback-file-id');
  } finally {
    page.restoreGlobals();
  }
}

async function testRunAnalyzeFoodUsesCloudFileWhenPayloadIsTooLarge() {
  const page = loadNutritionPage();
  let uploadCalled = 0;
  const recognizePayloads = [];
  let deletedFileId = '';

  try {
    page.prepareRecognizeImage = async () => ({
      compressedPath: 'compressed-cloud.jpg',
      imageBase64: 'x'.repeat(900000),
      requestStrategy: {
        mode: 'cloud_file',
        shouldUploadToCloud: true
      }
    });
    page.uploadRecognizeImage = async (filePath) => {
      uploadCalled += 1;
      assert.strictEqual(filePath, 'compressed-cloud.jpg');
      return 'cloud://file-id';
    };
    page.callFoodRecognize = async (payload) => {
      recognizePayloads.push(payload);
      return {
        success: true,
        source: 'openai',
        data: {
          foods: [
            {
              name: '便当',
              estimatedWeight: 320,
              calories: 540,
              protein: 20,
              fat: 18,
              carbs: 72,
              confidence: 0.7
            }
          ]
        }
      };
    };
    page.deleteRecognizeUpload = (fileID) => {
      deletedFileId = fileID;
    };

    await page.runAnalyzeFood('input.jpg');

    assert.strictEqual(uploadCalled, 1);
    assert.deepStrictEqual(recognizePayloads, [
      {
        fileID: 'cloud://file-id',
        imageBase64: '',
        recognizeProfile: 'balanced',
        splitMode: 'dish_first'
      },
      {
        fileID: 'cloud://file-id',
        imageBase64: '',
        recognizeProfile: 'detailed',
        splitMode: 'detailed'
      }
    ]);
    assert.strictEqual(deletedFileId, 'cloud://file-id');
  } finally {
    page.restoreGlobals();
  }
}

async function run() {
  await testPrepareRecognizeImageAllowsCloudFileFallback();
  await testRunAnalyzeFoodUsesInlineBase64WhenItFits();
  await testRunAnalyzeFoodFallsBackToCloudFileAfterInlinePayloadLimit();
  await testRunAnalyzeFoodUsesCloudFileWhenPayloadIsTooLarge();
  console.log('nutrition request flow tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
