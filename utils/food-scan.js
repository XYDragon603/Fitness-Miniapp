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

function buildRecognizeFlowPlan(scanResult) {
  return {
    shouldAutoRefine: shouldAutoRefineScanResult(scanResult),
    preserveFirstPassOnRefineFailure: true
  };
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
  buildRecognizeFlowPlan,
  getRecognizeRequestStrategy,
  shouldAutoRefineScanResult,
  shouldSuggestDetailedSplit
};
