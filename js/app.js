(function(global) {
  'use strict';

  /**
   * Route views based on current URL hash.
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
   * Aggregates emissions data from IndexedDB and updates the dashboard values.
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
   */
  function handleAddCommute(event) {
    event.preventDefault();
    const subType = jQuery('#commute-type').val();
    const distanceKm = Number(jQuery('#commute-distance').val());

    if (!subType || isNaN(distanceKm) || distanceKm <= 0) {
      alert('Please select a valid transit type and enter a distance greater than 0.');
      return;
    }

    if (global.EcoTrackWorker && global.EcoTrackDB) {
      global.EcoTrackWorker.calculate('commute', subType, distanceKm)
        .then(function(emissions) {
          return global.EcoTrackDB.addBehaviorEntry({
            type: 'commute',
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
        })
        .catch(function(err) {
          console.error('[App] Failed to add commute behavior:', err);
        });
    }
  }

  /**
   * Syncs anonymized aggregated emissions data to the Node.js backend.
   */
  function handleSyncEmissions() {
    if (!global.EcoTrackDB) return;

    jQuery('#btn-sync-data').prop('disabled', true).text('Syncing...');

    global.EcoTrackDB.getUnprocessedEntries()
      .then(function(unprocessed) {
        if (unprocessed.length === 0) {
          alert('All data is already synchronized!');
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
        jQuery.ajax({
          url: '/api/sync/emissions',
          method: 'POST',
          contentType: 'application/json',
          headers: token ? { 'Authorization': 'Bearer ' + token } : {},
          data: JSON.stringify({
            emissions: aggregates,
            timestamp: Date.now()
          })
        }).done(function(response) {
          if (response.success) {
            // Mark sync entries as processed locally
            const ids = unprocessed.map(e => e.id);
            global.EcoTrackDB.markEntriesAsProcessed(ids)
              .then(function() {
                jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
                alert('Aggregated emissions synchronized successfully!');
                refreshDashboardMetrics();
              });
          } else {
            alert('Emissions sync failed.');
            jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
          }
        }).fail(function() {
          alert('Failed to connect to backend server for sync.');
          jQuery('#btn-sync-data').prop('disabled', false).text('Sync to Cloud');
        });
      });
  }

  /**
   * Initializes the application lifecycle.
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
      jQuery.ajax({
        url: '/api/auth/login',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ email: 'demo@ecotrack.in', password: 'secure_password' })
      }).done(function(res) {
        if (res.success && res.data.token) {
          localStorage.setItem('ecotrack_token', res.data.token);
          jQuery('#btn-login-demo').hide();
          jQuery('#btn-logout-demo').show();
          jQuery('#auth-status-text').text('Logged in. Token: ' + res.data.token.substring(0, 15) + '...');
        }
      });
    });

    jQuery('#btn-logout-demo').off('click').on('click', function() {
      const token = localStorage.getItem('ecotrack_token');
      jQuery.ajax({
        url: '/api/auth/logout',
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      }).always(function() {
        localStorage.removeItem('ecotrack_token');
        jQuery('#btn-login-demo').show();
        jQuery('#btn-logout-demo').hide();
        jQuery('#auth-status-text').text('Not logged in.');
      });
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
    handleSyncEmissions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppOrchestrator;
  } else {
    global.EcoTrackApp = AppOrchestrator;
  }
})(typeof window !== 'undefined' ? window : this);
