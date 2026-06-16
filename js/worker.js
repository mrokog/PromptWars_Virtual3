(function(global) {
  'use strict';

  let workerInstance = null;
  const callbacks = {};
  let msgIdCounter = 0;

  // India-specific emission factors for fallback calculations
  const FALLBACK_FACTORS = {
    rideshare: 180,
    metro: 35,
    auto_rickshaw: 100,
    domestic_rail: 15,
    cycle: 0,
    walk: 0,
    air_freight: 600,
    rail_freight: 25,
    road_freight: 120,
    email: 7000,
    cloud: 7000
  };

  /**
   * Initializes the Web Worker thread if supported.
   */
  function initWorker() {
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        // Create worker using path relative to website root
        workerInstance = new Worker('/workers/behavioralWorker.js');
        
        workerInstance.onmessage = function(e) {
          const { action, emissionsGrams, payload } = e.data;
          
          if (action === 'result' && payload && payload.msgId !== undefined) {
            const resolve = callbacks[payload.msgId];
            if (resolve) {
              resolve(emissionsGrams);
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
   * Performs the calculation locally in case Web Workers are not available (e.g. inside tests).
   * @param {Object} payload The calculation payload.
   * @returns {number} The calculated emissions.
   */
  function performFallbackCalculation(payload) {
    const type = payload.type;
    const subType = payload.subType;
    const rawValue = Number(payload.rawValue || 0);

    let factor = 0;

    if (type === 'commute') {
      factor = FALLBACK_FACTORS[subType] !== undefined ? FALLBACK_FACTORS[subType] : 0;
    } else if (type === 'purchase') {
      factor = FALLBACK_FACTORS[subType] !== undefined ? FALLBACK_FACTORS[subType] : 0;
    } else if (type === 'email' || type === 'cloud') {
      factor = FALLBACK_FACTORS[type] || 0;
    }

    return rawValue * factor;
  }

  /**
   * Asynchronously calculates emissions for a given category.
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

  // Auto-init on script load if running in browser
  if (typeof window !== 'undefined') {
    initWorker();
  }

  const WorkerInterface = {
    initWorker,
    calculate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkerInterface;
  } else {
    global.EcoTrackWorker = WorkerInterface;
  }
})(typeof window !== 'undefined' ? window : this);
