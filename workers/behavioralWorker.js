/**
 * Dedicated Web Worker script for calculating carbon emissions.
 * Running calculations here keeps the main UI thread responsive and smooth.
 */

// India-specific emission factors (gCO2 per unit)
const EMISSION_FACTORS = {
  // Commute (per km)
  rideshare: 180,
  metro: 35,
  auto_rickshaw: 100,
  domestic_rail: 15,
  cycle: 0,
  walk: 0,
  
  // Logistics (per kg)
  air_freight: 600,
  rail_freight: 25,
  road_freight: 120,
  
  // Digital (per GB)
  email: 7000,
  cloud: 7000
};

/**
 * Calculates emissions based on payload details.
 *
 * @param {Object} payload The details of the behavior.
 * @returns {number} The calculated emissions in grams of CO2.
 */
function calculateEmissions(payload) {
  const type = payload.type;          // 'commute' | 'purchase' | 'email' | 'cloud'
  const subType = payload.subType;    // e.g. 'rideshare', 'air_freight', etc.
  const rawValue = Number(payload.rawValue || 0);

  let factor = 0;

  if (type === 'commute') {
    factor = EMISSION_FACTORS[subType] !== undefined ? EMISSION_FACTORS[subType] : 0;
  } else if (type === 'purchase') {
    // subType can be air_freight, rail_freight, road_freight
    factor = EMISSION_FACTORS[subType] !== undefined ? EMISSION_FACTORS[subType] : 0;
  } else if (type === 'email' || type === 'cloud') {
    factor = EMISSION_FACTORS[type] || 0;
  }

  return rawValue * factor;
}

/**
 * Analyzes logs to detect behavioral pattern indicators.
 *
 * @param {Array<Object>} entries List of behavioral entries.
 * @returns {Array<string>} List of detected patterns.
 */
function detectPatterns(entries) {
  const patterns = [];
  if (!Array.isArray(entries)) return patterns;

  // Commutes sorted by timestamp ascending
  const commutes = entries
    .filter(function(e) { return e.type === 'commute'; })
    .sort(function(a, b) { return a.timestamp - b.timestamp; });

  // Check 3+ consecutive rideshares
  let consecutiveRideshareCount = 0;
  let maxConsecutiveRideshare = 0;
  commutes.forEach(function(c) {
    const isRideshare = c.subType === 'rideshare' || (c.rawValue > 0 && Math.abs((c.emissionsGrams / c.rawValue) - 180) < 0.1);
    if (isRideshare) {
      consecutiveRideshareCount++;
      if (consecutiveRideshareCount > maxConsecutiveRideshare) {
        maxConsecutiveRideshare = consecutiveRideshareCount;
      }
    } else {
      consecutiveRideshareCount = 0;
    }
  });

  if (maxConsecutiveRideshare >= 3) {
    patterns.push('consecutive_rideshare');
  }

  // Check high cloud usage (total cloud rawValue > 2.0)
  const totalCloudGB = entries
    .filter(function(e) { return e.type === 'cloud'; })
    .reduce(function(sum, e) { return sum + Number(e.rawValue || 0); }, 0);

  if (totalCloudGB > 2.0) {
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
self.onmessage = function(e) {
  const { action, payload } = e.data;
  
  if (action === 'calculate') {
    const emissionsGrams = calculateEmissions(payload);
    self.postMessage({
      action: 'result',
      emissionsGrams: emissionsGrams,
      payload: payload
    });
  } else if (action === 'detectPatterns') {
    const patterns = detectPatterns(payload.entries);
    self.postMessage({
      action: 'patternResult',
      patterns: patterns,
      payload: payload
    });
  }
};
