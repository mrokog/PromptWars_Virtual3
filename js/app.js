(function(global) {
  'use strict';

  const Constants = typeof require !== 'undefined' ? require('./constants.js') : (global.EcoTrackConstants || {});
  const Utils = typeof require !== 'undefined' ? require('./utils.js') : (global.EcoTrackUtils || {});

  /**
   * Route views based on current URL hash.
   *
   * @returns {void}
   */
  function navigateToView() {
    const hash = window.location.hash || '#dashboard';
    jQuery('.view-section').removeClass('active');
    jQuery(hash).addClass('active');

    // Update active nav-link highlighting
    jQuery('.navbar-nav .nav-link').removeClass('active');
    jQuery(`.navbar-nav .nav-link[href="${hash}"]`).addClass('active');

    // Lazy-load module initializations
    if (hash === '#logistics' && global.EcoTrackLogistics) {
      global.EcoTrackLogistics.initLogistics();
    } else if (hash === '#digital' && global.EcoTrackDigital) {
      global.EcoTrackDigital.initDigitalCarbon();
    }
  }

  /**
   * Calculates carbon savings and logging streak from behavioral records.
   *
   * @param {Array<Object>} entries List of behavioral entries.
   * @returns {Object} Streak and saved grams.
   */
  function calculateStreakAndSavings(entries) {
    if (!entries || entries.length === 0) {
      return { streak: 0, savedGrams: 0 };
    }

    let savedGrams = 0;
    entries.forEach(function(e) {
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

    const dates = [];
    entries.forEach(function(e) {
      const dStr = new Date(e.timestamp).toDateString();
      if (dates.indexOf(dStr) === -1) {
        dates.push(dStr);
      }
    });

    const datesSorted = dates.map(function(d) {
      return new Date(d);
    }).sort(function(a, b) {
      return b - a;
    });

    let streak = 0;
    if (datesSorted.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const expectedDate = datesSorted[0];
      const diffMs = today - expectedDate;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        streak = 1;
        for (let i = 1; i < datesSorted.length; i++) {
          const current = datesSorted[i];
          const prev = datesSorted[i - 1];
          const diff = prev - current;
          const diffDaysBetween = Math.round(diff / (1000 * 60 * 60 * 24));
          if (diffDaysBetween === 1) {
            streak++;
          } else if (diffDaysBetween > 1) {
            break;
          }
        }
      }
    }

    return { streak, savedGrams };
  }

  /**
   * Aggregates emissions data from IndexedDB and updates the dashboard values.
   *
   * @returns {void}
   */
  function refreshDashboardMetrics() {
    if (!global.EcoTrackDB) return;

    global.EcoTrackDB.getAggregatedEmissions()
      .then(function(aggregates) {
        // Format to kg with 2 decimal places for user viewing
        const commuteKg = (aggregates.commute / 1000).toFixed(2);
        const logisticsKg = (aggregates.purchase / 1000).toFixed(2);
        const digitalKg = (aggregates.cloud / 1000).toFixed(2);
        const totalKg = (aggregates.total / 1000).toFixed(2);

        jQuery('#metric-commute').text(commuteKg + ' kg');
        jQuery('#metric-logistics').text(logisticsKg + ' kg');
        jQuery('#metric-digital').text(digitalKg + ' kg');
        jQuery('#metric-total').text(totalKg + ' kg');

        // Dynamic relatable comparison subtitle
        let $comparisonText = jQuery('#total-emissions-comparison');
        if ($comparisonText.length === 0) {
          $comparisonText = jQuery('<p id="total-emissions-comparison" class="small text-muted mt-2" style="font-size: 0.85rem; font-weight: 500;"></p>');
          jQuery('#metric-total').after($comparisonText);
        }
        if (Utils.toRelatableComparison) {
          $comparisonText.text('≈ ' + Utils.toRelatableComparison(aggregates.total));
        }

        // Fetch all entries for streak, savings, and edge insights
        global.EcoTrackDB.getAllEntries().then(function(entries) {
          // Calculate streak and savings
          const stats = calculateStreakAndSavings(entries);
          jQuery('#impact-saved').text((stats.savedGrams / 1000).toFixed(2) + ' kg');
          jQuery('#impact-streak').text(stats.streak + '-day streak');

          // Render Edge Worker Insights
          if (global.EcoTrackWorker && global.EcoTrackWorker.detectPatterns) {
            global.EcoTrackWorker.detectPatterns(entries).then(function(patterns) {
              const $list = jQuery('#edge-insights-list');
              $list.empty();
              if (!patterns || patterns.length === 0) {
                $list.append('<li class="list-group-item text-muted py-2 bg-transparent border-0">No pattern findings detected yet. Keep logging behaviors to process edge insights.</li>');
              } else {
                patterns.forEach(function(p) {
                  if (p === 'consecutive_rideshare') {
                    $list.append('<li class="list-group-item py-2 bg-transparent border-0 text-danger fw-bold">⚠️ High Commute Footprint: Consecutive rideshares detected. Tip: Switch to metro to save up to 80% emissions.</li>');
                  } else if (p === 'high_cloud_usage') {
                    $list.append('<li class="list-group-item py-2 bg-transparent border-0 text-warning fw-bold">⚠️ High Digital Footprint: Large cloud storage detected. Tip: Clear unneeded backups/emails to save digital carbon.</li>');
                  } else {
                    $list.append(`<li class="list-group-item py-2 bg-transparent border-0">⚠️ Habit: ${p} detected.</li>`);
                  }
                });
              }
            });
          }
        });

        // Check if we should trigger any behavioral nudges
        if (global.EcoTrackNudge) {
          global.EcoTrackNudge.checkBehavioralNudges();
        }
      })
      .catch(function(err) {
        console.error('[App] Failed to refresh metrics:', err);
      });
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

    if (global.EcoTrackWorker && global.EcoTrackDB) {
      global.EcoTrackWorker.calculate('commute', subType, distanceKm)
        .then(function(emissions) {
          return global.EcoTrackDB.write({
            type: 'commute',
            subType: subType,
            rawValue: distanceKm,
            emissionsGrams: emissions,
            processed: false,
            timestamp: Date.now()
          });
        })
        .then(function() {
          refreshDashboardMetrics();
          // Reset form fields
          jQuery('#commute-distance').val('');
          $feedback
            .addClass('alert-success')
            .removeClass('alert-danger')
            .text('Commute logged successfully!')
            .show()
            .delay(3000)
            .fadeOut();
        })
        .catch(function(err) {
          console.error('[App] Failed to add commute behavior:', err);
          $feedback
            .addClass('alert-danger')
            .text('Failed to save behavior to database.')
            .show();
        });
    }
  }

  /**
   * Syncs anonymized aggregated emissions data to the Node.js backend.
   *
   * @returns {void}
   */
  function handleSyncEmissions() {
    if (!global.EcoTrackDB) return;

    const $feedback = jQuery('#sync-feedback');
    $feedback.hide().removeClass('alert-success alert-danger alert-info').text('');
    jQuery('#btn-sync-data').prop('disabled', true).text('Syncing...');

    global.EcoTrackDB.getUnprocessedEntries()
      .then(function(unprocessed) {
        if (unprocessed.length === 0) {
          $feedback.addClass('alert-info').text('All data is already synchronized!').show();
          jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
          return;
        }

        // Anonymize and aggregate values to preserve privacy (no raw location details)
        const aggregates = {
          commute: 0,
          purchase: 0,
          email: 0,
          cloud: 0
        };

        unprocessed.forEach(function(entry) {
          if (aggregates[entry.type] !== undefined) {
            aggregates[entry.type] += entry.emissionsGrams;
          }
        });

        // POST sync payload to the backend
        const token = localStorage.getItem('ecotrack_token');
        
        Utils.safeAjax({
          url: '/api/sync/emissions',
          method: 'POST',
          contentType: 'application/json',
          headers: token ? { 'Authorization': 'Bearer ' + token } : {},
          data: JSON.stringify({
            emissions: aggregates,
            timestamp: Date.now()
          })
        }, function(response) {
          if (response.success) {
            // Mark sync entries as processed locally
            const ids = unprocessed.map(e => e.id);
            global.EcoTrackDB.markEntriesAsProcessed(ids)
              .then(function() {
                jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
                $feedback.addClass('alert-success').text('Aggregated emissions synchronized successfully!').show();
                refreshDashboardMetrics();
              });
          } else {
            $feedback.addClass('alert-danger').text('Emissions sync failed. Please try again.').show();
            jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
          }
        }, function() {
          $feedback.addClass('alert-danger').text('Failed to connect to backend server for sync.').show();
          jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
        });
      });
  }

  /**
   * Initializes the application lifecycle.
   *
   * @returns {void}
   */
  function initApp() {
    // Open DB
    if (global.EcoTrackDB) {
      global.EcoTrackDB.openDB().then(function() {
        refreshDashboardMetrics();
      }).catch(function(err) {
        console.error('[App] Database setup failed:', err);
      });
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(function() {
          console.log('[EcoTrack] Service Worker registered successfully.');
        })
        .catch(function(err) {
          console.warn('[EcoTrack] Service Worker registration failed:', err);
        });
    }

    // Setup SPA Hash listeners
    window.addEventListener('hashchange', navigateToView);
    navigateToView();

    // Event hooks
    jQuery(document).on('ecotrack:data-updated', refreshDashboardMetrics);
    jQuery(document).on('ecotrack:onboarding-complete', function() {
      refreshDashboardMetrics();
    });
    
    // Bind form submission
    jQuery('#form-add-commute').off('submit').on('submit', handleAddCommute);

    // Bind sync button
    jQuery('#btn-sync-data').off('click').on('click', handleSyncEmissions);

    // Refresh translation values on load (ensuring fallback works)
    if (global.EcoTrackI18n) {
      jQuery(document).on('ecotrack:langchange', function() {
        refreshDashboardMetrics();
      });
    }

    // Consent bindings
    jQuery('#onboarding-btn-email').off('click').on('click', function() {
      if (!jQuery('#email-consent').is(':checked')) {
        alert('Please check the consent box.');
        return;
      }
      jQuery(this).removeClass('btn-outline-primary').addClass('btn-success').text('Connected');
    });

    jQuery('#onboarding-btn-cloud').off('click').on('click', function() {
      if (!jQuery('#cloud-consent').is(':checked')) {
        alert('Please check the consent box.');
        return;
      }
      jQuery(this).removeClass('btn-outline-primary').addClass('btn-success').text('Connected');
    });

    // Synchronize consent boxes between Onboarding and Logistics panels
    jQuery('#email-logistics-consent').off('change').on('change', function() {
      jQuery('#email-consent').prop('checked', this.checked);
    });
    jQuery('#email-consent').off('change').on('change', function() {
      jQuery('#email-logistics-consent').prop('checked', this.checked);
    });

    // Demo login endpoints mock
    jQuery('#btn-login-demo').off('click').on('click', function() {
      Utils.safeAjax({
        url: '/api/auth/login',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ email: 'demo@ecotrack.in', password: 'secure_password' })
      }, function(res) {
        if (res.success && res.data.token) {
          localStorage.setItem('ecotrack_token', res.data.token);
          jQuery('#btn-login-demo').hide();
          jQuery('#btn-logout-demo').show();
          jQuery('#auth-status-text').text('Logged in. Token: ' + res.data.token.substring(0, 15) + '...');
        }
      }, function() {
        console.error('Demo login API request failed');
      });
    });

    jQuery('#btn-logout-demo').off('click').on('click', function() {
      const token = localStorage.getItem('ecotrack_token');
      Utils.safeAjax({
        url: '/api/auth/logout',
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      }, function() {
        // Success logout
      }, function() {
        // Error or always cleanup
      });
      localStorage.removeItem('ecotrack_token');
      jQuery('#btn-login-demo').show();
      jQuery('#btn-logout-demo').hide();
      jQuery('#auth-status-text').text('Not logged in.');
    });

    // Maintain current auth status on load
    const tok = localStorage.getItem('ecotrack_token');
    if (tok) {
      jQuery('#btn-login-demo').hide();
      jQuery('#btn-logout-demo').show();
      jQuery('#auth-status-text').text('Logged in. Token: ' + tok.substring(0, 15) + '...');
    }
  }

  // Bind to DOM ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initApp);
  }

  const AppOrchestrator = {
    initApp,
    refreshDashboardMetrics,
    navigateToView,
    handleAddCommute,
    handleSyncEmissions,
    calculateStreakAndSavings
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppOrchestrator;
  } else {
    global.EcoTrackApp = AppOrchestrator;
  }
})(typeof window !== 'undefined' ? window : this);
