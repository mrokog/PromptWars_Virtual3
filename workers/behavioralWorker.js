/**
 * Dedicated Web Worker script for calculating carbon emissions.
 * Running calculations here keeps the main UI thread responsive and smooth.
 */

// India-specific emission factors (gCO2 per unit)
const EMISSION_FACTORS = Object.freeze({
  RIDESHARE: 180,
  METRO: 35,
  AUTO_RICKSHAW: 100,
  DOMESTIC_RAIL: 15,
  CYCLE: 0,
  WALK: 0,
  AIR_FREIGHT: 600,
  RAIL_FREIGHT: 25,
  ROAD_FREIGHT: 120,
  EMAIL: 7000,
  CLOUD: 7000,
});

/**
 * Calculates emissions based on payload details.
 *
 * @param {Object} payload The details of the behavior.
 * @returns {number} The calculated emissions in grams of CO2.
 */
function calculateEmissions(payload) {
  const { type, subType, rawValue = 0 } = payload;
  const key = (type === 'email' || type === 'cloud' ? type : subType).toUpperCase();
  const factor = EMISSION_FACTORS[key] !== undefined ? EMISSION_FACTORS[key] : 0;
  return Number(rawValue) * factor;
}

/**
 * Helper to detect consecutive rideshares.
 * @param {Array<Object>} commutes List of commute entries.
 * @returns {boolean} True if detected.
 * @private
 */
function _checkConsecutiveRideshares(commutes) {
  let consecutiveCount = 0;
  let maxConsecutive = 0;
  commutes.forEach(function (c) {
    const isRideshare =
      c.subType === 'rideshare' ||
      (c.rawValue > 0 && Math.abs(c.emissionsGrams / c.rawValue - 180) < 0.1);
    if (isRideshare) {
      consecutiveCount++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
    } else {
      consecutiveCount = 0;
    }
  });
  return maxConsecutive >= 3;
}

/**
 * Helper to check high cloud usage.
 * @param {Array<Object>} entries List of behavioral entries.
 * @returns {boolean} True if detected.
 * @private
 */
function _checkHighCloudUsage(entries) {
  const totalCloudGB = entries
    .filter(function (e) {
      return e.type === 'cloud';
    })
    .reduce(function (sum, e) {
      return sum + Number(e.rawValue || 0);
    }, 0);
  return totalCloudGB > 2.0;
}

/**
 * Analyzes logs to detect behavioral pattern indicators.
 *
 * @param {Array<Object>} entries List of behavioral entries.
 * @returns {Array<string>} List of detected patterns.
 */
function detectPatterns(entries) {
  const patterns = [];
  if (!Array.isArray(entries)) {
    return patterns;
  }

  const commutes = entries
    .filter(function (e) {
      return e.type === 'commute';
    })
    .sort(function (a, b) {
      return a.timestamp - b.timestamp;
    });

  if (_checkConsecutiveRideshares(commutes)) {
    patterns.push('consecutive_rideshare');
  }
  if (_checkHighCloudUsage(entries)) {
    patterns.push('high_cloud_usage');
  }

  return patterns;
}

/**
 * Worker event listener message handler.
 *
 * @param {MessageEvent} e The postMessage event containing action and payload.
 * @returns {void}
 */
self.onmessage = function (e) {
  const { action, payload } = e.data;

  if (action === 'calculate') {
    const emissionsGrams = calculateEmissions(payload);
    self.postMessage({
      action: 'result',
      emissionsGrams: emissionsGrams,
      payload: payload,
    });
  } else if (action === 'detectPatterns') {
    const patterns = detectPatterns(payload.entries);
    self.postMessage({
      action: 'patternResult',
      patterns: patterns,
      payload: payload,
    });
  }
};
