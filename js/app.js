/**
 * Main Application Orchestrator for EcoTrack India.
 */
const EcoTrackApp = (function () {
  'use strict';

  const Utils = typeof require !== 'undefined' ? require('./utils.js') : global.EcoTrackUtils || {};
  const Preferences =
    typeof require !== 'undefined' ? require('./preferences.js') : global.EcoTrackPreferences || {};

  /**
   * Route views based on current URL hash.
   *
   * @returns {void}
   */
  function navigateToView() {
    const hash = window.location.hash || '#dashboard';
    jQuery('.view-section').removeClass('active');
    jQuery(hash).addClass('active');

    jQuery('.navbar-nav .nav-link').removeClass('active');
    jQuery(`.navbar-nav .nav-link[href="${hash}"]`).addClass('active');

    if (hash === '#logistics' && global.EcoTrackLogistics) {
      global.EcoTrackLogistics.initLogistics();
    } else if (hash === '#digital' && global.EcoTrackDigital) {
      global.EcoTrackDigital.initDigitalCarbon();
    }
  }

  /**
   * Pure function to calculate saved carbon emissions.
   * @param {Array<Object>} entries List of behavioral entries.
   * @returns {number} Saved grams of carbon.
   */
  function calculateSavedEmissions(entries) {
    let savedGrams = 0;
    entries.forEach(function (e) {
      if (e.type === 'commute') {
        if (e.subType === 'metro') {
          savedGrams += e.rawValue * (180 - 35);
        } else if (e.subType === 'cycle' || e.subType === 'walk') {
          savedGrams += e.rawValue * 180;
        } else if (e.subType === 'auto_rickshaw') {
          savedGrams += e.rawValue * (180 - 100);
        } else if (e.subType === 'domestic_rail') {
          savedGrams += e.rawValue * (180 - 15);
        }
      } else if (e.type === 'cloud' && e.emissionsGrams < 0) {
        savedGrams += Math.abs(e.emissionsGrams);
      }
    });
    return savedGrams;
  }

  /**
   * Pure function to calculate logging streak.
   * @param {Array<Object>} entries List of behavioral entries.
   * @param {Date} referenceDate Date to calculate the streak relative to.
   * @returns {number} The streak count in days.
   */
  function calculateStreak(entries, referenceDate) {
    const dates = [];
    entries.forEach(function (e) {
      const dStr = new Date(e.timestamp).toDateString();
      if (dates.indexOf(dStr) === -1) {
        dates.push(dStr);
      }
    });

    const datesSorted = dates.map((d) => new Date(d)).sort((a, b) => b - a);
    if (datesSorted.length === 0) {
      return 0;
    }

    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);
    const diffMs = today - datesSorted[0];
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      return 0;
    }

    let streak = 1;
    for (let i = 1; i < datesSorted.length; i++) {
      const diffDaysBetween = Math.round(
        (datesSorted[i - 1] - datesSorted[i]) / (1000 * 60 * 60 * 24)
      );
      if (diffDaysBetween === 1) {
        streak++;
      } else if (diffDaysBetween > 1) {
        break;
      }
    }
    return streak;
  }

  /**
   * Calculates carbon savings and logging streak from behavioral records.
   *
   * @param {Array<Object>} entries List of behavioral entries.
   * @param {Date} [referenceDate] Optional reference date (defaults to current date).
   * @returns {Object} Streak and saved grams.
   */
  function calculateStreakAndSavings(entries, referenceDate = new Date()) {
    if (!entries || entries.length === 0) {
      return { streak: 0, savedGrams: 0 };
    }
    return {
      streak: calculateStreak(entries, referenceDate),
      savedGrams: calculateSavedEmissions(entries),
    };
  }

  /**
   * Updates dashboard UI with computed metrics.
   * @param {Object} aggregates Computed totals.
   * @private
   */
  function _updateDashboardMetricTexts(aggregates) {
    jQuery('#metric-commute').text((aggregates.commute / 1000).toFixed(2) + ' kg');
    jQuery('#metric-logistics').text((aggregates.purchase / 1000).toFixed(2) + ' kg');
    jQuery('#metric-digital').text((aggregates.cloud / 1000).toFixed(2) + ' kg');
    jQuery('#metric-total').text((aggregates.total / 1000).toFixed(2) + ' kg');

    let $comp = jQuery('#total-emissions-comparison');
    if ($comp.length === 0) {
      $comp = jQuery(
        '<p id="total-emissions-comparison" class="small text-muted mt-2" style="font-size: 0.85rem; font-weight: 500;"></p>'
      );
      jQuery('#metric-total').after($comp);
    }
    if (Utils.toRelatableComparison) {
      $comp.text('≈ ' + Utils.toRelatableComparison(aggregates.total));
    }
  }

  /**
   * Renders edge intelligence insights lists.
   * @param {Array<string>} patterns Detected patterns.
   * @private
   */
  function _renderEdgeInsightsList(patterns) {
    const $list = jQuery('#edge-insights-list');
    $list.empty();
    if (!patterns || patterns.length === 0) {
      $list.append(
        '<li class="list-group-item text-muted py-2 bg-transparent border-0">No pattern findings detected yet. Keep logging behaviors to process edge insights.</li>'
      );
      return;
    }
    patterns.forEach(function (p) {
      if (p === 'consecutive_rideshare') {
        $list.append(
          '<li class="list-group-item py-2 bg-transparent border-0 text-danger fw-bold">⚠️ High Commute Footprint: Consecutive rideshares detected. Tip: Switch to metro to save up to 80% emissions.</li>'
        );
      } else if (p === 'high_cloud_usage') {
        $list.append(
          '<li class="list-group-item py-2 bg-transparent border-0 text-warning fw-bold">⚠️ High Digital Footprint: Large cloud storage detected. Tip: Clear unneeded backups/emails to save digital carbon.</li>'
        );
      } else {
        $list.append(
          `<li class="list-group-item py-2 bg-transparent border-0">⚠️ Habit: ${p} detected.</li>`
        );
      }
    });
  }

  /**
   * Aggregates emissions data from IndexedDB and updates the dashboard values.
   *
   * @returns {void}
   */
  function refreshDashboardMetrics() {
    if (!global.EcoTrackDB) {
      return;
    }

    global.EcoTrackDB.getAggregatedEmissions()
      .then(function (aggregates) {
        _updateDashboardMetricTexts(aggregates);

        return global.EcoTrackDB.getAllEntries().then(function (entries) {
          const stats = calculateStreakAndSavings(entries);
          jQuery('#impact-saved').text((stats.savedGrams / 1000).toFixed(2) + ' kg');
          jQuery('#impact-streak').text(stats.streak + '-day streak');

          if (global.EcoTrackWorker && global.EcoTrackWorker.detectPatterns) {
            global.EcoTrackWorker.detectPatterns(entries).then(_renderEdgeInsightsList);
          }
        });
      })
      .then(function () {
        if (global.EcoTrackNudge) {
          global.EcoTrackNudge.checkBehavioralNudges();
        }
      })
      .catch(function (err) {
        console.error('[App] Failed to refresh metrics:', err);
      });
  }

  /**
   * Helper to calculate emissions and log commute.
   * @param {string} subType Transit mode.
   * @param {number} distanceKm Distance in km.
   * @param {jQuery} $feedback Feedback element.
   * @private
   */
  function _logCommute(subType, distanceKm, $feedback) {
    if (global.EcoTrackWorker && global.EcoTrackDB) {
      global.EcoTrackWorker.calculate('commute', subType, distanceKm)
        .then(function (emissions) {
          return global.EcoTrackDB.write({
            type: 'commute',
            subType: subType,
            rawValue: distanceKm,
            emissionsGrams: emissions,
            processed: false,
            timestamp: Date.now(),
          });
        })
        .then(function () {
          refreshDashboardMetrics();
          jQuery('#commute-distance').val('');
          $feedback
            .addClass('alert-success')
            .removeClass('alert-danger')
            .text('Commute logged successfully!')
            .show()
            .delay(3000)
            .fadeOut();
        })
        .catch(function (err) {
          console.error('[App] Failed to add commute behavior:', err);
          $feedback.addClass('alert-danger').text('Failed to save behavior to database.').show();
        });
    }
  }

  /**
   * Adds commute behavior manually via form input.
   *
   * @param {Event} event - The form submit event.
   * @returns {void}
   */
  function handleAddCommute(event) {
    event.preventDefault();
    const subType = jQuery('#commute-type').val();
    const distanceKm = Number(jQuery('#commute-distance').val());
    const $feedback = jQuery('#commute-feedback');

    $feedback.hide().removeClass('alert-success alert-danger').text('');

    if (!subType || isNaN(distanceKm) || distanceKm <= 0) {
      $feedback
        .addClass('alert-danger')
        .text('Please select a valid transit type and enter a distance greater than 0.')
        .show();
      return;
    }

    _logCommute(subType, distanceKm, $feedback);
  }

  /**
   * Aggregates and sends sync data payload to server.
   * @param {Array<Object>} unprocessed Unprocessed entries.
   * @param {jQuery} $feedback Feedback element.
   * @private
   */
  function _sendSyncPayload(unprocessed, $feedback) {
    const aggregates = { commute: 0, purchase: 0, email: 0, cloud: 0 };
    unprocessed.forEach(function (entry) {
      if (aggregates[entry.type] !== undefined) {
        aggregates[entry.type] += entry.emissionsGrams;
      }
    });

    const token = Preferences.getToken();
    Utils.safeAjax(
      {
        url: '/api/sync/emissions',
        method: 'POST',
        contentType: 'application/json',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        data: JSON.stringify({ emissions: aggregates, timestamp: Date.now() }),
      },
      function (response) {
        if (response.success) {
          const ids = unprocessed.map((e) => e.id);
          global.EcoTrackDB.markEntriesAsProcessed(ids).then(function () {
            jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
            $feedback
              .addClass('alert-success')
              .text('Aggregated emissions synchronized successfully!')
              .show();
            refreshDashboardMetrics();
          });
        } else {
          $feedback
            .addClass('alert-danger')
            .text('Emissions sync failed. Please try again.')
            .show();
          jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
        }
      },
      function () {
        $feedback
          .addClass('alert-danger')
          .text('Failed to connect to backend server for sync.')
          .show();
        jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
      }
    );
  }

  /**
   * Syncs anonymized aggregated emissions data to the Node.js backend.
   *
   * @returns {void}
   */
  function handleSyncEmissions() {
    if (!global.EcoTrackDB) {
      return;
    }

    const $feedback = jQuery('#sync-feedback');
    $feedback.hide().removeClass('alert-success alert-danger alert-info').text('');
    jQuery('#btn-sync-data').prop('disabled', true).text('Syncing...');

    global.EcoTrackDB.getUnprocessedEntries().then(function (unprocessed) {
      if (unprocessed.length === 0) {
        $feedback.addClass('alert-info').text('All data is already synchronized!').show();
        jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
        return;
      }
      _sendSyncPayload(unprocessed, $feedback);
    });
  }

  /**
   * Sets up event listeners and hooks.
   * @private
   */
  function _setupEventHooks() {
    window.addEventListener('hashchange', navigateToView);
    navigateToView();

    jQuery(document).on('ecotrack:data-updated ecotrack:entryAdded', refreshDashboardMetrics);
    jQuery(document).on('ecotrack:onboarding-complete', refreshDashboardMetrics);
    jQuery(document).on('ecotrack:trigger-nudge', function (event, data) {
      if (global.EcoTrackNudge) {
        global.EcoTrackNudge.triggerNudge(data.key, data.metric);
      }
    });

    jQuery('#form-add-commute').off('submit').on('submit', handleAddCommute);
    jQuery('#btn-sync-data').off('click').on('click', handleSyncEmissions);

    if (global.EcoTrackI18n) {
      jQuery(document).on('ecotrack:langchange', refreshDashboardMetrics);
    }
  }

  /**
   * Sets up mock user authentication views and controllers.
   * @private
   */
  function _setupMockAuthentication() {
    jQuery('#btn-login-demo')
      .off('click')
      .on('click', function () {
        Utils.safeAjax(
          {
            url: '/api/auth/login',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ email: 'demo@ecotrack.in', password: 'secure_password' }),
          },
          function (res) {
            if (res.success && res.data.token) {
              Preferences.setToken(res.data.token);
              jQuery('#btn-login-demo').hide();
              jQuery('#btn-logout-demo').show();
              jQuery('#auth-status-text').text(
                'Logged in. Token: ' + res.data.token.substring(0, 15) + '...'
              );
            }
          },
          () => console.error('Demo login API request failed')
        );
      });

    jQuery('#btn-logout-demo')
      .off('click')
      .on('click', function () {
        const token = Preferences.getToken();
        Utils.safeAjax(
          {
            url: '/api/auth/logout',
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
          },
          () => {},
          () => {}
        );
        Preferences.removeToken();
        jQuery('#btn-login-demo').show();
        jQuery('#btn-logout-demo').hide();
        jQuery('#auth-status-text').text('Not logged in.');
      });

    const token = Preferences.getToken();
    if (token) {
      jQuery('#btn-login-demo').hide();
      jQuery('#btn-logout-demo').show();
      jQuery('#auth-status-text').text('Logged in. Token: ' + token.substring(0, 15) + '...');
    }
  }

  /**
   * Sets up consent selectors synchronization.
   * @private
   */
  function _setupConsentSynchronization() {
    jQuery('#onboarding-btn-email')
      .off('click')
      .on('click', function () {
        if (!jQuery('#email-consent').is(':checked')) {
          alert('Please check the consent box.');
          return;
        }
        jQuery(this).removeClass('btn-outline-primary').addClass('btn-success').text('Connected');
      });

    jQuery('#onboarding-btn-cloud')
      .off('click')
      .on('click', function () {
        if (!jQuery('#cloud-consent').is(':checked')) {
          alert('Please check the consent box.');
          return;
        }
        jQuery(this).removeClass('btn-outline-primary').addClass('btn-success').text('Connected');
      });

    jQuery('#email-logistics-consent')
      .off('change')
      .on('change', function () {
        jQuery('#email-consent').prop('checked', this.checked);
      });
    jQuery('#email-consent')
      .off('change')
      .on('change', function () {
        jQuery('#email-logistics-consent').prop('checked', this.checked);
      });
  }

  /**
   * Initializes the application lifecycle.
   *
   * @returns {void}
   */
  function initApp() {
    if (global.EcoTrackDB) {
      global.EcoTrackDB.openDB()
        .then(refreshDashboardMetrics)
        .catch((err) => console.error('[App] Database setup failed:', err));
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.warn('[EcoTrack] Service Worker registered.'))
        .catch((err) => console.warn('[EcoTrack] Service Worker registration failed:', err));
    }

    _setupEventHooks();
    _setupConsentSynchronization();
    _setupMockAuthentication();
  }

  return {
    initApp,
    refreshDashboardMetrics,
    navigateToView,
    handleAddCommute,
    handleSyncEmissions,
    calculateStreakAndSavings,
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackApp;
} else {
  window.EcoTrackApp = EcoTrackApp;
}
