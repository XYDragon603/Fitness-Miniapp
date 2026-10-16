const assert = require('assert');

const {
  buildRecognizeFlowPlan,
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

function testRecognizeFlowPlanKeepsClearDishOnFirstPass() {
  const plan = buildRecognizeFlowPlan({
    foods: [
      {
        name: '番茄炒蛋',
        confidence: 0.82
      }
    ],
    lowConfidence: false
  });

  assert.deepStrictEqual(plan, {
    shouldAutoRefine: false,
    preserveFirstPassOnRefineFailure: true
  });
}

function testRecognizeFlowPlanAutoRefinesBroadMeal() {
  const plan = buildRecognizeFlowPlan({
    foods: [
      {
        name: '便当',
        confidence: 0.69
      }
    ],
    lowConfidence: false
  });

  assert.deepStrictEqual(plan, {
    shouldAutoRefine: true,
    preserveFirstPassOnRefineFailure: true
  });
}

function run() {
  testShouldAutoRefineBroadSingleDish();
  testShouldNotAutoRefineClearSingleDish();
  testShouldAutoRefineLowConfidenceResult();
  testRequestStrategyUsesBase64WhenPayloadFits();
  testRequestStrategyFallsBackWhenPayloadTooLarge();
  testDetailedSuggestionMatchesBroadDishRules();
  testRecognizeFlowPlanKeepsClearDishOnFirstPass();
  testRecognizeFlowPlanAutoRefinesBroadMeal();
  console.log('food-scan tests passed');
}

run();
