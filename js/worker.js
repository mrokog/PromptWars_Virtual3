(function(global) {
  'use strict';

  const Constants = typeof require !== 'undefined' ? require('./constants.js') : (global.EcoTrackConstants || {});

  let workerInstance = null;
  const callbacks = {};
  let msgIdCounter = 0;

  /**
   * Initializes the Web Worker thread if supported.
   *
   * @returns {void}
   */
  function initWorker() {
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        // Create worker using path relative to website root
        workerInstance = new Worker('/workers/behavioralWorker.js');
        
        workerInstance.onmessage = function(e) {
          const { action, emissionsGrams, patterns, payload } = e.data;
          
          if (action === 'result' && payload && payload.msgId !== undefined) {
            const resolve = callbacks[payload.msgId];
            if (resolve) {
              resolve(emissionsGrams);
              delete callbacks[payload.msgId];
            }
          } else if (action === 'patternResult' && payload && payload.msgId !== undefined) {
            const resolve = callbacks[payload.msgId];
            if (resolve) {
              resolve(patterns);
              delete callbacks[payload.msgId];
            }
          }
        };
        
        workerInstance.onerror = function(e) {
          console.error('[EcoTrack Worker] Web Worker error:', e);
        };
      } catch (err) {
        console.warn('[EcoTrack Worker] Web Worker init failed, using main-thread fallback.', err);
        workerInstance = null;
      }
    }
  }

  /**
   * Performs pattern detection locally as a fallback.
   *
   * @param {Array<Object>} entries List of behavioral entries.
   * @returns {Array<string>} List of detected pattern identifiers.
   */
  function performFallbackPatternDetection(entries) {
    const patterns = [];
    if (!Array.isArray(entries)) return patterns;

    const commutes = entries
      .filter(function(e) { return e.type === 'commute'; })
      .sort(function(a, b) { return a.timestamp - b.timestamp; });

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

    const totalCloudGB = entries
      .filter(function(e) { return e.type === 'cloud'; })
      .reduce(function(sum, e) { return sum + Number(e.rawValue || 0); }, 0);

    if (totalCloudGB > (Constants.CLOUD_THRESHOLD_GB || 2.0)) {
      patterns.push('high_cloud_usage');
    }

    return patterns;
  }

  /**
   * Performs the calculation locally in case Web Workers are not available (e.g. inside tests).
   *
   * @param {Object} payload The calculation payload.
   * @returns {number} The calculated emissions.
   */
  function performFallbackCalculation(payload) {
    const type = payload.type;
    const subType = payload.subType;
    const rawValue = Number(payload.rawValue || 0);

    let factor = 0;
    const factors = Constants.EMISSION_FACTORS || {};

    if (type === 'commute') {
      const key = subType + '_per_km';
      factor = factors[key] !== undefined ? factors[key] : 0;
    } else if (type === 'purchase') {
      if (subType === 'air_freight') {
        factor = factors.air_freight_per_kg || 0;
      } else if (subType === 'rail_freight') {
        factor = factors.domestic_rail_freight || 0;
      } else if (subType === 'road_freight') {
        factor = factors.domestic_road_freight || 0;
      }
    } else if (type === 'email') {
      factor = factors.email_per_gb || 0;
    } else if (type === 'cloud') {
      factor = factors.cloud_per_gb || 0;
    }

    return rawValue * factor;
  }

  /**
   * Asynchronously calculates emissions for a given category.
   *
   * @param {string} type Category type ('commute' | 'purchase' | 'email' | 'cloud').
   * @param {string} subType Specific mode/subtype.
   * @param {number} rawValue Value of the metric (km, kg, GB).
   * @returns {Promise<number>} Emissions in grams of CO2.
   */
  function calculate(type, subType, rawValue) {
    return new Promise(function(resolve) {
      const msgId = msgIdCounter++;
      const payload = { type, subType, rawValue, msgId };

      if (workerInstance) {
        callbacks[msgId] = resolve;
        workerInstance.postMessage({ action: 'calculate', payload });
      } else {
        // Fallback execution to avoid blocking the main thread execution completely
        setTimeout(function() {
          resolve(performFallbackCalculation(payload));
        }, 0);
      }
    });
  }

  /**
   * Scans behavioral entries asynchronously via worker to identify intelligence patterns.
   *
   * @param {Array<Object>} entries List of behavioral entries to scan.
   * @returns {Promise<Array<string>>} List of detected pattern names.
   */
  function detectPatterns(entries) {
    return new Promise(function(resolve) {
      const msgId = msgIdCounter++;
      const payload = { entries, msgId };

      if (workerInstance) {
        callbacks[msgId] = resolve;
        workerInstance.postMessage({ action: 'detectPatterns', payload });
      } else {
        // Fallback calculation on the main thread
        setTimeout(function() {
          resolve(performFallbackPatternDetection(entries));
        }, 0);
      }
    });
  }

  // Auto-init on script load if running in browser
  if (typeof window !== 'undefined') {
    initWorker();
  }

  const CalculationService = {
    initWorker,
    calculate,
    detectPatterns
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalculationService;
  } else {
    global.EcoTrackWorker = CalculationService;
  }
})(typeof window !== 'undefined' ? window : this);
