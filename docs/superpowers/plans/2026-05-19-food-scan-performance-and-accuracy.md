# Food Scan Performance And Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current upload-download recognition hot path with a direct-base64, two-pass recognition pipeline that stays faster on average, preserves first-pass results, and only spends extra time on detailed refinement when the first result is weak.

**Architecture:** Keep the recognition UI on `pages/nutrition/nutrition.js`, but move scan heuristics and transport decisions into a small shared helper module so they can be tested with plain Node. Update `cloudfunctions/foodRecognize/index.js` to accept either `imageBase64` or `fileID`, add explicit balanced and detailed recognition profiles, and return metadata the page can use to decide whether to auto-refine or preserve the first result.

**Tech Stack:** WeChat Mini Program page JS/WXML, Node-style utility modules, WeChat cloud function (`wx-server-sdk`), plain Node assertion tests, `node --check`

---

## File Structure

### Existing Files To Modify

- `pages/nutrition/nutrition.js`
  - Owns scan entry actions, compression, recognition request flow, result normalization, and save-to-today behavior.
- `pages/nutrition/nutrition.wxml`
  - Owns loading and result-state copy shown during first-pass and detailed refinement flows.
- `cloudfunctions/foodRecognize/index.js`
  - Owns image input selection, model prompt/profile selection, provider request, and response normalization for the cloud side.

### New Files To Create

- `utils/food-scan.js`
  - Shared pure helpers for scan decision-making that can be tested outside the Mini Program runtime.
- `tests/food-scan.test.js`
  - Node-based regression tests for recognition heuristics and request-profile selection.
- `tests/food-recognize-cloud.test.js`
  - Node-based regression tests for cloud-side input priority and profile behavior extracted into pure functions.

### Optional Small Cleanup Inside Existing Files

- Keep UI-facing strings and debug helpers in `pages/nutrition/nutrition.js` unless they become too large.
- Do not split `nutrition.js` aggressively; only extract the pure decision logic needed for reliable tests.

---

### Task 1: Extract Scan Heuristics And Add Failing Tests

**Files:**
- Create: `utils/food-scan.js`
- Create: `tests/food-scan.test.js`
- Modify: `pages/nutrition/nutrition.js`

- [ ] **Step 1: Write the failing test for broad-result refinement rules**

Create `tests/food-scan.test.js` with this first failing test block:

```js
const assert = require('assert');

const {
  shouldAutoRefineScanResult,
  shouldSuggestDetailedSplit,
  getRecognizeRequestStrategy
} = require('../utils/food-scan.js');

function testShouldAutoRefineBroadSingleDish() {
  const result = {
    foods: [
      {
        name: '盖饭',
        confidence: 0.78
      }
    ],
    lowConfidence: false,
    note: 'AI识别结果仅供记录参考，请根据实际份量自行调整。'
  };

  assert.strictEqual(shouldAutoRefineScanResult(result), true);
}

function testShouldNotAutoRefineClearSingleDish() {
  const result = {
    foods: [
      {
        name: '番茄炒蛋',
        confidence: 0.82
      }
    ],
    lowConfidence: false,
    note: 'AI识别结果仅供记录参考，请根据实际份量自行调整。'
  };

  assert.strictEqual(shouldAutoRefineScanResult(result), false);
}

function testShouldAutoRefineLowConfidenceResult() {
  const result = {
    foods: [
      {
        name: '番茄炒蛋',
        confidence: 0.51
      }
    ],
    lowConfidence: true,
    note: '识别结果可能不完整，请根据实际菜品手动调整。'
  };

  assert.strictEqual(shouldAutoRefineScanResult(result), true);
}
```

- [ ] **Step 2: Extend the failing test with transport-strategy expectations**

Append these test cases to `tests/food-scan.test.js`:

```js
function testRequestStrategyUsesBase64WhenPayloadFits() {
  const strategy = getRecognizeRequestStrategy({
    imageBase64Length: 240000,
    maxInlineBase64Length: 760000
  });

  assert.deepStrictEqual(strategy, {
    mode: 'inline_base64',
    shouldUploadToCloud: false
  });
}

function testRequestStrategyFallsBackWhenPayloadTooLarge() {
  const strategy = getRecognizeRequestStrategy({
    imageBase64Length: 900000,
    maxInlineBase64Length: 760000
  });

  assert.deepStrictEqual(strategy, {
    mode: 'cloud_file',
    shouldUploadToCloud: true
  });
}

function testDetailedSuggestionMatchesBroadDishRules() {
  const result = {
    foods: [
      {
        name: '便当',
        confidence: 0.69
      }
    ]
  };

  assert.strictEqual(shouldSuggestDetailedSplit(result), true);
}

function run() {
  testShouldAutoRefineBroadSingleDish();
  testShouldNotAutoRefineClearSingleDish();
  testShouldAutoRefineLowConfidenceResult();
  testRequestStrategyUsesBase64WhenPayloadFits();
  testRequestStrategyFallsBackWhenPayloadTooLarge();
  testDetailedSuggestionMatchesBroadDishRules();
  console.log('food-scan tests passed');
}

run();
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```powershell
node tests/food-scan.test.js
```

Expected:

```text
Error: Cannot find module '../utils/food-scan.js'
```

- [ ] **Step 4: Create the minimal shared helper module**

Create `utils/food-scan.js` with this implementation:

```js
const BROAD_DISH_KEYWORDS = ['盖浇饭', '便当', '拼盘', '套餐', '麻辣烫', '火锅', '炒饭', '拌饭', '盖饭', '沙拉碗'];
const INCOMPLETE_NOTE_MARKERS = ['不完整', '手动调整', '确认主要食材', '确认份量'];

function hasBroadDishKeyword(name) {
  const normalizedName = String(name || '').trim();
  return !!normalizedName && BROAD_DISH_KEYWORDS.some(keyword => normalizedName.indexOf(keyword) >= 0);
}

function shouldSuggestDetailedSplit(scanResult) {
  if (!scanResult || !Array.isArray(scanResult.foods) || scanResult.foods.length !== 1) {
    return false;
  }

  return hasBroadDishKeyword(scanResult.foods[0].name);
}

function hasIncompleteNote(note) {
  const text = String(note || '').trim();
  return !!text && INCOMPLETE_NOTE_MARKERS.some(marker => text.indexOf(marker) >= 0);
}

function shouldAutoRefineScanResult(scanResult) {
  if (!scanResult || !Array.isArray(scanResult.foods) || scanResult.foods.length === 0) {
    return true;
  }

  if (scanResult.lowConfidence) {
    return true;
  }

  if (shouldSuggestDetailedSplit(scanResult)) {
    return true;
  }

  if (hasIncompleteNote(scanResult.note)) {
    return true;
  }

  return false;
}

function getRecognizeRequestStrategy({ imageBase64Length, maxInlineBase64Length }) {
  if ((Number(imageBase64Length) || 0) > (Number(maxInlineBase64Length) || 0)) {
    return {
      mode: 'cloud_file',
      shouldUploadToCloud: true
    };
  }

  return {
    mode: 'inline_base64',
    shouldUploadToCloud: false
  };
}

module.exports = {
  BROAD_DISH_KEYWORDS,
  getRecognizeRequestStrategy,
  shouldAutoRefineScanResult,
  shouldSuggestDetailedSplit
};
```

- [ ] **Step 5: Point `nutrition.js` at the shared helper instead of duplicating keyword logic**

Update the import section and helper usage in `pages/nutrition/nutrition.js` to this shape:

```js
const util = require('../../utils/util.js');
const {
  getRecognizeRequestStrategy,
  shouldAutoRefineScanResult,
  shouldSuggestDetailedSplit
} = require('../../utils/food-scan.js');
const {
  calculateFatLossTargets,
  createPortionAdjustedFood
} = require('../../utils/mvp-core.js');
const app = getApp();
```

Also delete the local `BROAD_DISH_KEYWORDS` constant and the local `shouldSuggestDetailedSplit` implementation so the page uses the shared helper.

- [ ] **Step 6: Run the new helper test to verify it passes**

Run:

```powershell
node tests/food-scan.test.js
```

Expected:

```text
food-scan tests passed
```

- [ ] **Step 7: Commit**

```powershell
git add utils/food-scan.js tests/food-scan.test.js pages/nutrition/nutrition.js
git commit -m "test: cover food scan heuristics"
```

### Task 2: Add Cloud Function Profile Selection And Input Priority

**Files:**
- Modify: `cloudfunctions/foodRecognize/index.js`
- Create: `tests/food-recognize-cloud.test.js`

- [ ] **Step 1: Write the failing cloud-side tests for input priority and profile presets**

Create `tests/food-recognize-cloud.test.js` with this content:

```js
const assert = require('assert');

const {
  getRecognizeProfileConfig,
  pickRecognizeImageInput
} = require('../cloudfunctions/foodRecognize/index.js');

function testPrefersInlineBase64OverFileId() {
  const input = pickRecognizeImageInput({
    imageBase64: 'abc123',
    fileID: 'cloud://food.jpg'
  });

  assert.deepStrictEqual(input, {
    source: 'inline_base64',
    imageBase64: 'abc123',
    fileID: ''
  });
}

function testFallsBackToCloudFileWhenBase64Missing() {
  const input = pickRecognizeImageInput({
    imageBase64: '',
    fileID: 'cloud://food.jpg'
  });

  assert.deepStrictEqual(input, {
    source: 'cloud_file',
    imageBase64: '',
    fileID: 'cloud://food.jpg'
  });
}

function testBalancedProfileIsLighterThanDetailedProfile() {
  const balanced = getRecognizeProfileConfig('balanced');
  const detailed = getRecognizeProfileConfig('detailed');

  assert.strictEqual(balanced.name, 'balanced');
  assert.strictEqual(detailed.name, 'detailed');
  assert.ok(balanced.maxTokens < detailed.maxTokens);
}

function run() {
  testPrefersInlineBase64OverFileId();
  testFallsBackToCloudFileWhenBase64Missing();
  testBalancedProfileIsLighterThanDetailedProfile();
  console.log('food-recognize cloud tests passed');
}

run();
```

- [ ] **Step 2: Run the cloud-side test to verify it fails**

Run:

```powershell
node tests/food-recognize-cloud.test.js
```

Expected:

```text
TypeError: pickRecognizeImageInput is not a function
```

- [ ] **Step 3: Add pure helper functions and exports in the cloud function**

Add these helpers near the top of `cloudfunctions/foodRecognize/index.js`:

```js
const RECOGNIZE_PROFILES = {
  balanced: {
    name: 'balanced',
    temperature: 0.08,
    maxTokens: 820,
    defaultImageDetail: 'low'
  },
  detailed: {
    name: 'detailed',
    temperature: 0.1,
    maxTokens: 1100,
    defaultImageDetail: 'high'
  }
};

function getRecognizeProfileConfig(profileName) {
  return RECOGNIZE_PROFILES[profileName] || RECOGNIZE_PROFILES.balanced;
}

function pickRecognizeImageInput(event = {}) {
  const imageBase64 = event && event.imageBase64 ? String(event.imageBase64) : '';
  const fileID = event && event.fileID ? String(event.fileID) : '';

  if (imageBase64) {
    return {
      source: 'inline_base64',
      imageBase64,
      fileID: ''
    };
  }

  return {
    source: 'cloud_file',
    imageBase64: '',
    fileID
  };
}
```

At the bottom of the file, export them for Node tests:

```js
module.exports.getRecognizeProfileConfig = getRecognizeProfileConfig;
module.exports.pickRecognizeImageInput = pickRecognizeImageInput;
module.exports.main = exports.main;
```

- [ ] **Step 4: Update request construction to use profile presets**

Replace the hard-coded profile decisions in the provider request path with this pattern:

```js
function requestSiliconFlow(apiKey, model, imageBase64, host, splitMode, recognizeProfile, imageDetail) {
  const prompt = buildRequestPrompt(splitMode);
  const profile = getRecognizeProfileConfig(recognizeProfile);
  const preferDetailed = profile.name === 'detailed';

  const requestBody = JSON.stringify({
    model,
    stream: false,
    temperature: profile.temperature,
    max_tokens: profile.maxTokens,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: prompt.system
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
              detail: imageDetail || profile.defaultImageDetail
            }
          },
          {
            type: 'text',
            text: prompt.user
          }
        ]
      }
    ]
  });

  // keep the existing https.request body send logic below this point
}
```

- [ ] **Step 5: Update `exports.main` to prefer inline base64 and pass profile metadata through**

In `exports.main`, use this structure:

```js
exports.main = async (event) => {
  const recognizeProfile = event && event.recognizeProfile === 'detailed' ? 'detailed' : 'balanced';
  const imageInput = pickRecognizeImageInput(event);
  let imageBase64 = imageInput.imageBase64;
  const fileID = imageInput.fileID;

  if (!imageBase64 && fileID) {
    imageBase64 = await getImageBase64FromFileID(fileID);
  }

  // keep the current missing-image and missing-api-key branches

  const content = await requestSiliconFlow(
    apiKey,
    model,
    imageBase64,
    host,
    splitMode,
    recognizeProfile,
    imageDetail
  );

  // include recognizeProfile and imageInput.source in debug metadata
};
```

- [ ] **Step 6: Run the cloud-side tests and syntax check**

Run:

```powershell
node tests/food-recognize-cloud.test.js
node --check cloudfunctions/foodRecognize/index.js
```

Expected:

```text
food-recognize cloud tests passed
```

```text
(no output from node --check)
```

- [ ] **Step 7: Commit**

```powershell
git add cloudfunctions/foodRecognize/index.js tests/food-recognize-cloud.test.js
git commit -m "feat: add cloud recognition profiles"
```

### Task 3: Implement Frontend Two-Pass Recognition And Result Preservation

**Files:**
- Modify: `pages/nutrition/nutrition.js`
- Modify: `pages/nutrition/nutrition.wxml`

- [ ] **Step 1: Add the failing UI-state tests as a lightweight pure-flow harness**

Append these tests to `tests/food-scan.test.js` so the page-flow rules are pinned before implementation:

```js
const {
  buildRecognizeFlowPlan
} = require('../utils/food-scan.js');

function testFlowPlanStaysSinglePassForClearDish() {
  const result = {
    foods: [{ name: '番茄炒蛋', confidence: 0.88 }],
    lowConfidence: false,
    note: ''
  };

  assert.deepStrictEqual(buildRecognizeFlowPlan(result), {
    shouldAutoRefine: false,
    preserveFirstPassOnRefineFailure: true
  });
}

function testFlowPlanAutoRefinesBroadMeal() {
  const result = {
    foods: [{ name: '便当', confidence: 0.72 }],
    lowConfidence: false,
    note: ''
  };

  assert.deepStrictEqual(buildRecognizeFlowPlan(result), {
    shouldAutoRefine: true,
    preserveFirstPassOnRefineFailure: true
  });
}
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```powershell
node tests/food-scan.test.js
```

Expected:

```text
TypeError: buildRecognizeFlowPlan is not a function
```

- [ ] **Step 3: Extend `utils/food-scan.js` with a simple flow-plan helper**

Add this export:

```js
function buildRecognizeFlowPlan(scanResult) {
  return {
    shouldAutoRefine: shouldAutoRefineScanResult(scanResult),
    preserveFirstPassOnRefineFailure: true
  };
}

module.exports = {
  BROAD_DISH_KEYWORDS,
  buildRecognizeFlowPlan,
  getRecognizeRequestStrategy,
  shouldAutoRefineScanResult,
  shouldSuggestDetailedSplit
};
```

- [ ] **Step 4: Add first-pass and refine-pass state to the page**

In `pages/nutrition/nutrition.js`, add these page-state fields under `data`:

```js
recognizePhase: '',
recognizePhaseText: '',
isRecognizeRefining: false,
recognizeNotice: ''
```

Use these values:

- first pass start: `recognizePhase = 'first_pass'`
- refine pass start: `recognizePhase = 'refine_pass'`
- after refine soft-failure: `recognizeNotice = '已保留首次识别结果，可直接修正后保存。'`

- [ ] **Step 5: Change `runAnalyzeFood` to prefer inline base64 and support two-pass recognition**

Refactor `runAnalyzeFood` into this shape:

```js
async runAnalyzeFood(imagePath, options = {}) {
  wx.showLoading({
    title: '正在识别主要食材...'
  });

  let uploadedFileId = '';

  try {
    const prepared = await this.prepareRecognizeImage(imagePath, options);
    const compressedPath = prepared.compressedPath;
    const imageBase64 = prepared.imageBase64;
    const requestStrategy = getRecognizeRequestStrategy({
      imageBase64Length: imageBase64.length,
      maxInlineBase64Length: MAX_CLOUD_BASE64_LENGTH
    });

    const firstPayload = {
      imageBase64: requestStrategy.shouldUploadToCloud ? '' : imageBase64,
      fileID: ''
    };

    if (requestStrategy.shouldUploadToCloud) {
      uploadedFileId = await this.uploadRecognizeImage(compressedPath);
      firstPayload.fileID = uploadedFileId;
    }

    this.setData({
      recognizePhase: 'first_pass',
      recognizePhaseText: '正在识别主要食材...',
      isRecognizeRefining: false,
      recognizeNotice: ''
    });

    const firstResult = await this.callFoodRecognize({
      ...firstPayload,
      recognizeProfile: 'balanced'
    }, options);

    const normalizedFirstResult = normalizeScanResult({
      ...(firstResult.data || firstResult),
      source: firstResult.source,
      isMock: firstResult.isMock
    });

    this.setData({
      scanResult: normalizedFirstResult,
      scanImagePath: imagePath,
      scanCompressedPath: compressedPath,
      showDetailedRescanHint: shouldSuggestDetailedSplit(normalizedFirstResult)
    });

    const flowPlan = buildRecognizeFlowPlan(normalizedFirstResult);
    if (!flowPlan.shouldAutoRefine) {
      return;
    }

    wx.showLoading({
      title: '正在进一步细分食材...'
    });

    this.setData({
      recognizePhase: 'refine_pass',
      recognizePhaseText: '正在进一步细分食材...',
      isRecognizeRefining: true
    });

    const refineResult = await this.callFoodRecognize({
      ...firstPayload,
      recognizeProfile: 'detailed'
    }, {
      ...options,
      preset: 'retry'
    });

    const normalizedRefineResult = normalizeScanResult({
      ...(refineResult.data || refineResult),
      source: refineResult.source,
      isMock: refineResult.isMock
    });

    this.setData({
      scanResult: normalizedRefineResult,
      showDetailedRescanHint: shouldSuggestDetailedSplit(normalizedRefineResult),
      isRecognizeRefining: false,
      recognizeNotice: ''
    });
  } catch (error) {
    // keep current hard-failure modal behavior for the first pass
    // preserve the first-pass result if the refine pass fails
  } finally {
    this.deleteRecognizeUpload(uploadedFileId);
    wx.hideLoading();
  }
}
```

- [ ] **Step 6: Handle refine-pass failures without clearing the first-pass result**

Inside the `catch` branch of `runAnalyzeFood`, split the logic like this:

```js
const isRefineFailure = this.data.recognizePhase === 'refine_pass' && this.data.scanResult;

if (isRefineFailure) {
  this.setData({
    isRecognizeRefining: false,
    recognizeNotice: '已保留首次识别结果，可直接修正后保存。'
  });

  wx.showToast({
    title: '细分未完成，已保留首次结果',
    icon: 'none'
  });
  return;
}

if (error && (error.message === 'compress_failed' || error.message === 'image_too_large')) {
  this.showImageProcessUnavailable();
} else {
  this.showRecognizeUnavailable(imagePath, options, reason, debugText);
}
```

- [ ] **Step 7: Pass the explicit recognition profile into the cloud call**

Update `callFoodRecognize` in `pages/nutrition/nutrition.js` to accept `recognizeProfile`:

```js
callFoodRecognize(payload, options = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'foodRecognize',
      data: {
        fileID: payload && payload.fileID ? payload.fileID : '',
        imageBase64: payload && payload.imageBase64 ? payload.imageBase64 : '',
        recognizeProfile: payload && payload.recognizeProfile ? payload.recognizeProfile : 'balanced',
        splitMode: this.data.scanMode || 'dish_first',
        imageDetail: options && options.preset === 'retry' ? 'high' : 'low'
      },
      success: (res) => resolve(res.result || {}),
      fail: reject
    });
  });
}
```

- [ ] **Step 8: Surface the two-pass state in WXML**

In `pages/nutrition/nutrition.wxml`, add a lightweight status block near the scan result header:

```xml
<view class="estimate-note" wx:if="{{recognizePhaseText || recognizeNotice}}">
  <view class="estimate-note-text">{{recognizeNotice || recognizePhaseText}}</view>
</view>
```

Also update the explicit retry button copy only if needed so it still reads naturally after auto-refinement:

```xml
<view class="btn-secondary rescan-tip-action" bindtap="retryDetailedRecognize">
  重新细分
</view>
```

- [ ] **Step 9: Run the helper tests and syntax checks**

Run:

```powershell
node tests/food-scan.test.js
node --check pages/nutrition/nutrition.js
```

Expected:

```text
food-scan tests passed
```

```text
(no output from node --check)
```

- [ ] **Step 10: Commit**

```powershell
git add pages/nutrition/nutrition.js pages/nutrition/nutrition.wxml utils/food-scan.js tests/food-scan.test.js
git commit -m "feat: add two-pass food recognition flow"
```

### Task 4: Regression Verification And Cleanup

**Files:**
- Modify: `pages/nutrition/nutrition.js` if final copy/debug cleanup is needed
- Modify: `cloudfunctions/foodRecognize/index.js` if final debug payload cleanup is needed
- Test: `tests/food-scan.test.js`
- Test: `tests/food-recognize-cloud.test.js`

- [ ] **Step 1: Run all targeted automated checks**

Run:

```powershell
node tests/food-scan.test.js
node tests/food-recognize-cloud.test.js
node --check pages/nutrition/nutrition.js
node --check cloudfunctions/foodRecognize/index.js
```

Expected:

```text
food-scan tests passed
food-recognize cloud tests passed
```

```text
(no output from either node --check command)
```

- [ ] **Step 2: Manually verify the clear single-dish path in WeChat DevTools**

Run this manual flow:

```text
1. Open the nutrition page.
2. Choose a clear single-dish photo such as 番茄炒蛋.
3. Confirm the loading copy starts with “正在识别主要食材...”.
4. Confirm a usable result appears without needing a second pass.
5. Confirm the result can still be adjusted and saved into today’s intake.
```

Expected:

```text
Single-dish scans complete in one pass, with no cloud-upload delay visible in the happy path.
```

- [ ] **Step 3: Manually verify the broad mixed-meal auto-refine path**

Run this manual flow:

```text
1. Choose a lunch box / rice bowl / 麻辣烫 photo.
2. Confirm the first loading state appears.
3. Confirm the app automatically enters “正在进一步细分食材...” when the first result is broad or uncertain.
4. Confirm the refined result either adds more structure or keeps the original result available if refinement fails.
```

Expected:

```text
Mixed meals either gain extra detail automatically or keep the first-pass result instead of dropping to an empty failure state.
```

- [ ] **Step 4: Manually verify oversize fallback and explicit retry**

Run this manual flow:

```text
1. Try a relatively large image that forces the compression ladder.
2. Confirm the app still recognizes or gracefully falls back instead of hanging.
3. Use “重新细分” after a saved result appears.
4. Confirm the detailed profile still runs on demand.
```

Expected:

```text
Large images either use the cloud-file fallback path safely or show the existing manual-add fallback, and explicit refinement still works.
```

- [ ] **Step 5: Final cleanup of debug/copy if needed**

If the implementation introduced noisy logs or inconsistent copy, reduce it to this shape:

```js
console.log(DEBUG_RECOGNIZE_PREFIX, 'request strategy', {
  mode: requestStrategy.mode,
  recognizeProfile: payload.recognizeProfile
});
```

Keep only the logs needed to distinguish:

- inline base64 vs cloud file fallback
- balanced vs detailed profile
- refine-pass soft failure vs hard failure

- [ ] **Step 6: Commit**

```powershell
git add pages/nutrition/nutrition.js pages/nutrition/nutrition.wxml cloudfunctions/foodRecognize/index.js tests/food-scan.test.js tests/food-recognize-cloud.test.js
git commit -m "test: verify food scan performance regression"
```

## Self-Review

### Spec Coverage

- Direct base64 transport by default is covered in Task 1 and Task 3.
- Fallback to `fileID` only when payload is too large is covered in Task 1 and Task 3.
- Balanced first pass and detailed second pass are covered in Task 2 and Task 3.
- Auto-refine only for weak or broad results is covered in Task 1 and Task 3.
- Preserve first-pass result when refinement fails is covered in Task 3.
- Keep save-to-today behavior unchanged is preserved by limiting storage changes and verifying save flow in Task 4.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each code-changing step includes concrete code blocks or exact edit targets.
- Each verification step includes exact commands or explicit manual flows.

### Type Consistency

- Frontend request profile names are consistently `balanced` and `detailed`.
- Shared helper names are consistently `shouldAutoRefineScanResult`, `shouldSuggestDetailedSplit`, `getRecognizeRequestStrategy`, and `buildRecognizeFlowPlan`.
- Cloud-side input helper names are consistently `pickRecognizeImageInput` and `getRecognizeProfileConfig`.
