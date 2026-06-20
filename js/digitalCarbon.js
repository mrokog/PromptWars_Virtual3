/**
 * Digital Carbon Diet Module for EcoTrack India.
 */
const EcoTrackDigital = (function () {
  'use strict';

  const Constants =
    typeof require !== 'undefined' ? require('./constants.js') : global.EcoTrackConstants || {};
  const Utils = typeof require !== 'undefined' ? require('./utils.js') : global.EcoTrackUtils || {};
  const Preferences =
    typeof require !== 'undefined' ? require('./preferences.js') : global.EcoTrackPreferences || {};

  // Initial cloud storage state
  const cloudItems = {
    emails: { id: 'emails', sizeGB: 1.8, active: true },
    backups: { id: 'backups', sizeGB: 1.4, active: true },
    attachments: { id: 'attachments', sizeGB: 1.0, active: true },
  };

  const MAX_LIMIT_GB = Constants.CLOUD_THRESHOLD_GB || 5.0;

  /**
   * Calculates current total GB and returns the usage percentage.
   *
   * @returns {number} The current usage percentage.
   */
  function getUsagePercentage() {
    let currentGB = 0;
    if (cloudItems.emails.active) {
      currentGB += cloudItems.emails.sizeGB;
    }
    if (cloudItems.backups.active) {
      currentGB += cloudItems.backups.sizeGB;
    }
    if (cloudItems.attachments.active) {
      currentGB += cloudItems.attachments.sizeGB;
    }
    return (currentGB / MAX_LIMIT_GB) * 100;
  }

  /**
   * Updates the progress bar and zone indicators.
   * Respects prefers-reduced-motion.
   *
   * @param {number} newPercent Percentage value.
   * @returns {void}
   */
  function updateCarbonMeter(newPercent) {
    const clampedPercent = Utils.clamp
      ? Utils.clamp(newPercent, 0, 100)
      : Math.max(0, Math.min(100, newPercent));
    const $fill = jQuery('#carbon-meter-fill');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      $fill.css('width', clampedPercent + '%');
    } else {
      const animMs = 600;
      $fill.stop().animate({ width: clampedPercent + '%' }, animMs);
    }

    $fill.attr('aria-valuenow', Math.round(clampedPercent));
    $fill.attr('aria-label', `Digital carbon usage is at ${Math.round(clampedPercent)}%`);
    jQuery('#carbon-meter-percent').text(Math.round(clampedPercent) + '%');

    updateZoneLabel(clampedPercent);
  }

  /**
   * Resolves the threshold zone details.
   * @param {number} percent Current percent.
   * @returns {Object} { zoneText, color, icon }
   * @private
   */
  function _resolveZoneDetails(percent) {
    const zones = Constants.CARBON_METER_ZONES || { RED_THRESHOLD: 60, AMBER_THRESHOLD: 30 };
    if (percent > zones.RED_THRESHOLD) {
      return { zoneText: 'modules.red_zone', color: '#D32F2F', icon: '🔴' };
    }
    if (percent >= zones.AMBER_THRESHOLD) {
      return { zoneText: 'modules.amber_zone', color: '#F57C00', icon: '🟡' };
    }
    return { zoneText: 'modules.green_zone', color: '#388E3C', icon: '🟢' };
  }

  /**
   * Updates the color zone label and icon based on usage.
   *
   * @param {number} percent Current percentage.
   * @returns {void}
   */
  function updateZoneLabel(percent) {
    const { zoneText, color, icon } = _resolveZoneDetails(percent);
    jQuery('#carbon-meter-indicator-dot').css('color', color).text(icon);
    jQuery('#carbon-meter-zone-label').attr('data-i18n', zoneText);

    if (global.EcoTrackI18n) {
      const activeLang = Preferences.getLanguage();
      jQuery.getJSON(`/lang/${activeLang}.json`).done(function (strings) {
        global.EcoTrackI18n.applyStrings(strings);
      });
    }
  }

  /**
   * Helper to perform the deletion state update and slide up the card in the UI.
   *
   * @param {string} itemKey - Key of the cloud item.
   * @returns {void}
   */
  function performDeletion(itemKey) {
    const item = cloudItems[itemKey];
    if (item) {
      item.active = false;
      jQuery(`#digital-item-${itemKey}`).slideUp();
    }
  }

  /**
   * Calculates the emissions saved from clearing cloud data and logs it in the database.
   *
   * @param {number} sizeGB - The size of cleared storage in GB.
   * @returns {Promise<number>} Emissions saved in grams.
   */
  function logSavedEmissions(sizeGB) {
    if (!global.EcoTrackWorker || !global.EcoTrackDB) {
      return Promise.resolve(0);
    }
    return global.EcoTrackWorker.calculate('cloud', 'cloud_per_gb', sizeGB).then(
      function (emissionsSaved) {
        return global.EcoTrackDB.write({
          type: 'cloud',
          subType: 'cleanup',
          rawValue: -sizeGB,
          emissionsGrams: -emissionsSaved,
          processed: true,
          timestamp: Date.now(),
        }).then(function () {
          return emissionsSaved;
        });
      }
    );
  }

  /**
   * Triggers global updates, redraws the meter, and shows the updated carbon diet message.
   *
   * @returns {void}
   */
  function updateCarbonDashboard() {
    jQuery(document).trigger('ecotrack:data-updated');
    updateCarbonMeter(getUsagePercentage());

    let savedGB = 0;
    if (!cloudItems.emails.active) {
      savedGB += cloudItems.emails.sizeGB;
    }
    if (!cloudItems.backups.active) {
      savedGB += cloudItems.backups.sizeGB;
    }
    if (!cloudItems.attachments.active) {
      savedGB += cloudItems.attachments.sizeGB;
    }

    const factor = (Constants.EMISSION_FACTORS && Constants.EMISSION_FACTORS.CLOUD_PER_GB) || 7000;
    const savedEmissions = savedGB * factor;
    const comparisonText = Utils.toRelatableComparison
      ? Utils.toRelatableComparison(savedEmissions)
      : '';
    const formattedVal = Math.round(savedEmissions).toLocaleString();
    jQuery('#digital-carbon-saved-text').text(
      `Clear ${savedGB.toFixed(1)} GB → Save ${formattedVal}g CO₂ (${comparisonText})`
    );
  }

  /**
   * Performs simulated deletion, writes saving entry to IndexedDB, and updates UI.
   *
   * @param {string} itemKey Key of the deleted item.
   * @returns {void}
   */
  function deleteCloudItem(itemKey) {
    const item = cloudItems[itemKey];
    if (!item || !item.active) {
      return;
    }

    performDeletion(itemKey);

    logSavedEmissions(item.sizeGB)
      .then(function () {
        updateCarbonDashboard();
      })
      .catch(function (err) {
        console.error('[Digital Carbon DB] Failed to save savings logs:', err);
      });
  }

  /**
   * Initializes the digital carbon diet UI.
   *
   * @returns {void}
   */
  function initDigitalCarbon() {
    ['emails', 'backups', 'attachments'].forEach((key) => {
      cloudItems[key].active = true;
      jQuery(`#digital-item-${key}`).show();
      jQuery(`#btn-clear-${key}`)
        .off('click')
        .on('click', () => deleteCloudItem(key));
    });

    updateCarbonMeter(getUsagePercentage());
    jQuery('#digital-carbon-saved-text').text(
      'Clear 0.0 GB → Save 0g CO₂ (≈ 0.0 km of car travel)'
    );
  }

  // Bind init to DOM ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initDigitalCarbon);
  }

  return {
    initDigitalCarbon,
    deleteCloudItem,
    getUsagePercentage,
    updateCarbonMeter,
    getCloudItems: () => cloudItems,
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackDigital;
} else {
  window.EcoTrackDigital = EcoTrackDigital;
}
