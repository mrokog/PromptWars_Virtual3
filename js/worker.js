/**
 * Calculation and Edge Worker Service Manager for EcoTrack India.
 */
const EcoTrackWorker = (function () {
  'use strict';

  const Constants =
    typeof require !== 'undefined' ? require('./constants.js') : global.EcoTrackConstants || {};

  let workerInstance = null;
  const callbacks = {};
  let msgIdCounter = 0;

  const FACTOR_MAP = Object.freeze({
    commute_rideshare: 'RIDESHARE_PER_KM',
    commute_metro: 'METRO_PER_KM',
    commute_auto_rickshaw: 'AUTO_RICKSHAW_PER_KM',
    commute_domestic_rail: 'DOMESTIC_RAIL_PER_KM',
    purchase_air_freight: 'AIR_FREIGHT_PER_KG',
    purchase_rail_freight: 'DOMESTIC_RAIL_FREIGHT_PER_KG',
    purchase_road_freight: 'DOMESTIC_ROAD_FREIGHT_PER_KG',
    email: 'EMAIL_PER_GB',
    cloud: 'CLOUD_PER_GB',
  });

  /**
   * Message event dispatcher from worker thread.
   * @param {MessageEvent} e Worker event data.
   * @private
   */
  function _handleWorkerMessage(e) {
    const { action, emissionsGrams, patterns, payload } = e.data;
    if (payload && payload.msgId !== undefined) {
      const resolve = callbacks[payload.msgId];
      if (resolve) {
        resolve(action === 'result' ? emissionsGrams : patterns);
        delete callbacks[payload.msgId];
      }
    }
  }

  /**
   * Initializes the Web Worker thread if supported.
   * @returns {void}
   */
  function initWorker() {
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        workerInstance = new Worker('/workers/behavioralWorker.js');
        workerInstance.onmessage = _handleWorkerMessage;
        workerInstance.onerror = (e) => console.error('[EcoTrack Worker] Web Worker error:', e);
      } catch (err) {
        console.warn('[EcoTrack Worker] Web Worker init failed, using fallback.', err);
        workerInstance = null;
      }
    }
  }

  /**
   * Helper to check consecutive rideshares.
   * @param {Array<Object>} commutes Sorted commutes.
   * @returns {boolean} True if consecutive rideshares found.
   * @private
   */
  function _checkConsecutiveRideshares(commutes) {
    let consecutiveCount = 0;
    let maxConsecutive = 0;
    commutes.forEach(function (c) {
      const rideshareEmissions =
        (Constants.EMISSION_FACTORS && Constants.EMISSION_FACTORS.RIDESHARE_PER_KM) || 180;
      const isRideshare =
        c.subType === 'rideshare' ||
        (c.rawValue > 0 && Math.abs(c.emissionsGrams / c.rawValue - rideshareEmissions) < 0.1);
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
   * @param {Array<Object>} entries All log entries.
   * @returns {boolean} True if high cloud usage detected.
   * @private
   */
  function _checkHighCloudUsage(entries) {
    const totalCloudGB = entries
      .filter((e) => e.type === 'cloud')
      .reduce((sum, e) => sum + Number(e.rawValue || 0), 0);
    return totalCloudGB > (Constants.CLOUD_THRESHOLD_GB || 2.0);
  }

  /**
   * Performs pattern detection locally as a fallback.
   * @param {Array<Object>} entries List of behavioral entries.
   * @returns {Array<string>} List of detected pattern identifiers.
   */
  function performFallbackPatternDetection(entries) {
    const patterns = [];
    if (!Array.isArray(entries)) {
      return patterns;
    }
    const commutes = entries
      .filter((e) => e.type === 'commute')
      .sort((a, b) => a.timestamp - b.timestamp);

    if (_checkConsecutiveRideshares(commutes)) {
      patterns.push('consecutive_rideshare');
    }
    if (_checkHighCloudUsage(entries)) {
      patterns.push('high_cloud_usage');
    }
    return patterns;
  }

  /**
   * Performs the calculation locally in case Web Workers are not available.
   * @param {Object} payload The calculation payload.
   * @returns {number} The calculated emissions.
   */
  function performFallbackCalculation(payload) {
    const { type, subType, rawValue = 0 } = payload;
    const key = type === 'email' || type === 'cloud' ? type : `${type}_${subType}`;
    const factorKey = FACTOR_MAP[key];
    const factor = (factorKey && Constants.EMISSION_FACTORS[factorKey]) || 0;
    return Number(rawValue) * factor;
  }

  /**
   * Asynchronously calculates emissions for a given category.
   * @param {string} type Category type ('commute' | 'purchase' | 'email' | 'cloud').
   * @param {string} subType Specific mode/subtype.
   * @param {number} rawValue Value of the metric (km, kg, GB).
   * @returns {Promise<number>} Emissions in grams of CO2.
   */
  function calculate(type, subType, rawValue) {
    return new Promise(function (resolve) {
      const msgId = msgIdCounter++;
      const payload = { type, subType, rawValue, msgId };

      if (workerInstance) {
        callbacks[msgId] = resolve;
        workerInstance.postMessage({ action: 'calculate', payload });
      } else {
        setTimeout(() => resolve(performFallbackCalculation(payload)), 0);
      }
    });
  }

  /**
   * Scans behavioral entries asynchronously via worker to identify intelligence patterns.
   * @param {Array<Object>} entries List of behavioral entries to scan.
   * @returns {Promise<Array<string>>} List of detected pattern names.
   */
  function detectPatterns(entries) {
    return new Promise(function (resolve) {
      const msgId = msgIdCounter++;
      const payload = { entries, msgId };

      if (workerInstance) {
        callbacks[msgId] = resolve;
        workerInstance.postMessage({ action: 'detectPatterns', payload });
      } else {
        setTimeout(() => resolve(performFallbackPatternDetection(entries)), 0);
      }
    });
  }

  // Auto-init on script load if running in browser
  if (typeof window !== 'undefined') {
    initWorker();
  }

  return {
    initWorker,
    calculate,
    detectPatterns,
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackWorker;
} else {
  window.EcoTrackWorker = EcoTrackWorker;
}
