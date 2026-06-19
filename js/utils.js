(function(global) {
  'use strict';

  const Constants = typeof require !== 'undefined' ? require('./constants.js') : (global.EcoTrackConstants || {});

  /**
   * Wraps a jQuery AJAX call with standardized error logging and fallback.
   *
   * @param {Object} options - jQuery AJAX settings object.
   * @param {Function} onSuccess - Callback function on successful request.
   * @param {Function} [onError] - Optional callback function on request failure.
   * @returns {jQuery.jqXHR} The jQuery AJAX promise object.
   */
  function safeAjax(options, onSuccess, onError) {
    const $ = global.jQuery || (typeof require !== 'undefined' ? require('jquery') : null);
    if (!$) {
      console.error('[EcoTrack Utils] jQuery is not available.');
      if (onError) onError(new Error('jQuery not available'));
      return;
    }

    return $.ajax(options)
      .done(onSuccess)
      .fail(function(jqxhr, status, error) {
        console.error(`[EcoTrack] Request failed: ${options.url || 'unknown'}`, status, error);
        if (onError) {
          onError(error || new Error(status));
        }
      });
  }

  /**
   * Wraps a jQuery getJSON call with standardized error logging and fallback.
   *
   * @param {string} url - Endpoint URL to fetch.
   * @param {Function} onSuccess - Callback on success.
   * @param {Function} [onError] - Optional custom error handler; defaults to console logging.
   * @returns {jQuery.jqXHR} The jQuery AJAX promise object.
   */
  function safeGetJSON(url, onSuccess, onError) {
    const $ = global.jQuery || (typeof require !== 'undefined' ? require('jquery') : null);
    if (!$) {
      console.error('[EcoTrack Utils] jQuery is not available.');
      if (onError) onError(new Error('jQuery not available'));
      return;
    }

    return $.getJSON(url)
      .done(onSuccess)
      .fail(function(jqxhr, status, error) {
        console.error(`[EcoTrack] Request failed: ${url}`, status, error);
        if (onError) {
          onError(error || new Error(status));
        }
      });
  }

  /**
   * Converts a gram CO2 value into a relatable real-world comparison string.
   *
   * @param {number} grams - Emission value in grams.
   * @returns {string} Relatable comparison string, e.g. "≈ 6.9 km of car travel".
   */
  function toRelatableComparison(grams) {
    const factors = Constants.EMISSION_FACTORS || { rideshare_per_km: 180 };
    const kmDrivingPerGram = 1 / (factors.rideshare_per_km || 180);
    const km = (grams * kmDrivingPerGram).toFixed(1);
    return `≈ ${km} km of car travel`;
  }

  /**
   * Formats a gram value into a human-readable CO2 string with comparison context.
   *
   * @param {number} grams - Emission value in grams.
   * @returns {string} Formatted string, e.g. "1,240g CO2 (≈ 6.9 km of car travel)".
   */
  function formatEmissions(grams) {
    const formattedVal = Math.round(grams).toLocaleString();
    const comparison = toRelatableComparison(grams);
    return `${formattedVal}g CO₂ (${comparison})`;
  }

  /**
   * Clamps a number between a minimum and maximum value.
   *
   * @param {number} value - Input value to clamp.
   * @param {number} min - Lower boundary.
   * @param {number} max - Upper boundary.
   * @returns {number} The clamped value.
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const Utils = {
    safeAjax,
    safeGetJSON,
    toRelatableComparison,
    formatEmissions,
    clamp
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
  } else {
    global.EcoTrackUtils = Utils;
  }
})(typeof window !== 'undefined' ? window : this);
