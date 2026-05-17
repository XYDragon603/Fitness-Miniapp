const assert = require('assert');

const {
  calculateNutritionTargets,
  createPortionAdjustedFood,
  sanitizeGuideUrl
} = require('../utils/mvp-core.js');

function testCalculateNutritionTargets() {
  const targets = calculateNutritionTargets({
    height: 175,
    weight: 70,
    age: 28,
    gender: 'male',
    activityLevel: 'moderate',
    goal: 'maintain'
  });

  assert.strictEqual(targets.dailyCalories, 2571);
  assert.strictEqual(targets.proteinTarget, 98);
  assert.deepStrictEqual(targets.fatRange, { min: 57.1, max: 100 });
  assert.strictEqual(targets.carbTarget, 378);
  assert.strictEqual(targets.isMinor, false);
}

function testCalculateNutritionTargetsForMinor() {
  const targets = calculateNutritionTargets({
    height: 165,
    weight: 58,
    age: 16,
    gender: 'female',
    activityLevel: 'light',
    goal: 'muscle_gain'
  });

  assert.strictEqual(targets.isMinor, true);
  assert.strictEqual(targets.guidanceMode, 'gentle');
}

function testCreatePortionAdjustedFood() {
  const food = createPortionAdjustedFood(
    {
      name: '番茄炒蛋',
      estimatedWeight: 180,
      calories: 220,
      protein: 12,
      fat: 14,
      carbs: 9
    },
    {
      portionKey: 'large'
    }
  );

  assert.strictEqual(food.estimatedWeight, 225);
  assert.strictEqual(food.calories, 275);
  assert.strictEqual(food.protein, 15);
  assert.strictEqual(food.fat, 17.5);
  assert.strictEqual(food.carbs, 11.3);
}

function testSanitizeGuideUrl() {
  assert.strictEqual(
    sanitizeGuideUrl('https://www.bilibili.com/video/BV1xx411c7mD'),
    'https://www.bilibili.com/video/BV1xx411c7mD'
  );
  assert.strictEqual(sanitizeGuideUrl('https://www.youtube.com/watch?v=test'), '');
  assert.strictEqual(sanitizeGuideUrl(''), '');
}

function run() {
  testCalculateNutritionTargets();
  testCalculateNutritionTargetsForMinor();
  testCreatePortionAdjustedFood();
  testSanitizeGuideUrl();
  console.log('mvp-core tests passed');
}

run();
