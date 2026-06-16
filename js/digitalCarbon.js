(function(global) {
  'use strict';

  // Initial cloud storage state
  let cloudItems = {
    emails: { id: 'emails', sizeGB: 1.8, active: true },
    backups: { id: 'backups', sizeGB: 1.4, active: true },
    attachments: { id: 'attachments', sizeGB: 1.0, active: true }
  };

  const MAX_LIMIT_GB = 5.0;

  /**
   * Calculates current total GB and returns the usage percentage.
   */
  function getUsagePercentage() {
    let currentGB = 0;
    if (cloudItems.emails.active) currentGB += cloudItems.emails.sizeGB;
    if (cloudItems.backups.active) currentGB += cloudItems.backups.sizeGB;
    if (cloudItems.attachments.active) currentGB += cloudItems.attachments.sizeGB;
    return (currentGB / MAX_LIMIT_GB) * 100;
  }

  /**
   * Updates the progress bar and zone indicators.
   * Respects prefers-reduced-motion.
   * @param {number} newPercent Percentage value.
   */
  function updateCarbonMeter(newPercent) {
    const clampedPercent = Math.max(0, Math.min(100, newPercent));
    const $fill = jQuery('#carbon-meter-fill');
    
    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      $fill.css('width', clampedPercent + '%');
    } else {
      $fill.stop().animate({ width: clampedPercent + '%' }, 600);
    }

    // Update accessibility attributes
    $fill.attr('aria-valuenow', Math.round(clampedPercent));
    $fill.attr('aria-label', `Digital carbon usage is at ${Math.round(clampedPercent)}%`);

    // Update percentage text
    jQuery('#carbon-meter-percent').text(Math.round(clampedPercent) + '%');

    updateZoneLabel(clampedPercent);
  }

  /**
   * Updates the color zone label and icon based on usage.
   * @param {number} percent Current percentage.
   */
  function updateZoneLabel(percent) {
    const $label = jQuery('#carbon-meter-zone-label');
    const $indicator = jQuery('#carbon-meter-indicator-dot');
    
    let zoneText = 'modules.green_zone';
    let color = '#388E3C'; // Green
    let icon = '🟢';

    if (percent > 60) {
      zoneText = 'modules.red_zone';
      color = '#D32F2F'; // Red
      icon = '🔴';
    } else if (percent >= 30) {
      zoneText = 'modules.amber_zone';
      color = '#F57C00'; // Amber
      icon = '🟡';
    }

    // Update status dot and color
    $indicator.css('color', color).text(icon);
    $label.attr('data-i18n', zoneText);

    // Refresh translation just for this element
    if (global.EcoTrackI18n && global.localStorage) {
      const activeLang = localStorage.getItem('ecotrack_lang') || 'en';
      jQuery.getJSON(`/lang/${activeLang}.json`).done(function(strings) {
        global.EcoTrackI18n.applyStrings(strings);
      });
    }
  }

  /**
   * Performs simulated deletion, writes saving entry to IndexedDB, and updates UI.
   * @param {string} itemKey Key of the deleted item.
   */
  function deleteCloudItem(itemKey) {
    const item = cloudItems[itemKey];
    if (!item || !item.active) return;

    item.active = false;
    
    // Hide item in UI
    jQuery(`#digital-item-${itemKey}`).slideUp();

    // Calculate saving using Worker
    if (global.EcoTrackWorker && global.EcoTrackDB) {
      global.EcoTrackWorker.calculate('cloud', 'cloud_per_gb', item.sizeGB)
        .then(function(emissionsSaved) {
          // Write saving as negative emissions (deleting means saving)
          return global.EcoTrackDB.addBehaviorEntry({
            type: 'cloud',
            rawValue: -item.sizeGB,
            emissionsGrams: -emissionsSaved,
            processed: true,
            timestamp: Date.now()
          });
        })
        .then(function() {
          // Refresh main dashboard metrics
          jQuery(document).trigger('ecotrack:data-updated');
          
          // Animate the carbon meter to new state
          const newPercent = getUsagePercentage();
          updateCarbonMeter(newPercent);

          // Update real-time total saved message
          let savedGB = 0;
          if (!cloudItems.emails.active) savedGB += cloudItems.emails.sizeGB;
          if (!cloudItems.backups.active) savedGB += cloudItems.backups.sizeGB;
          if (!cloudItems.attachments.active) savedGB += cloudItems.attachments.sizeGB;
          
          const savedEmissions = savedGB * 7000;
          jQuery('#digital-carbon-saved-text')
            .text(`Clear ${savedGB.toFixed(1)} GB → Save ${savedEmissions.toLocaleString()}g CO₂`);
        })
        .catch(function(err) {
          console.error('[Digital Carbon DB] Failed to save savings logs:', err);
        });
    }
  }

  /**
   * Initializes the digital carbon diet UI.
   */
  function initDigitalCarbon() {
    // Reset item active flags for demonstration
    cloudItems.emails.active = true;
    cloudItems.backups.active = true;
    cloudItems.attachments.active = true;

    jQuery('#digital-item-emails').show();
    jQuery('#digital-item-backups').show();
    jQuery('#digital-item-attachments').show();

    // Bind clicks
    jQuery('#btn-clear-emails').off('click').on('click', function() {
      deleteCloudItem('emails');
    });

    jQuery('#btn-clear-backups').off('click').on('click', function() {
      deleteCloudItem('backups');
    });

    jQuery('#btn-clear-attachments').off('click').on('click', function() {
      deleteCloudItem('attachments');
    });

    // Set initial progress bar width
    const startPercent = getUsagePercentage();
    updateCarbonMeter(startPercent);

    jQuery('#digital-carbon-saved-text').text('Clear 0.0 GB → Save 0g CO₂');
  }

  // Bind init to DOM ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initDigitalCarbon);
  }

  const DigitalCarbonDiet = {
    initDigitalCarbon,
    deleteCloudItem,
    getUsagePercentage,
    updateCarbonMeter,
    getCloudItems: () => cloudItems
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DigitalCarbonDiet;
  } else {
    global.EcoTrackDigital = DigitalCarbonDiet;
  }
})(typeof window !== 'undefined' ? window : this);
