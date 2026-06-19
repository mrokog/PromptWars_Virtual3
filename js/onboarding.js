(function(global) {
  'use strict';

  const Constants = typeof require !== 'undefined' ? require('./constants.js') : (global.EcoTrackConstants || {});
  const Utils = typeof require !== 'undefined' ? require('./utils.js') : (global.EcoTrackUtils || {});

  let currentStep = 1;

  /**
   * Shows the current step and hides others in the wizard.
   *
   * @returns {void}
   */
  function updateWizardUI() {
    jQuery('.onboarding-step').hide();
    jQuery(`#onboarding-step-${currentStep}`).show();

    // Update step headings/progress indicators
    jQuery('.step-indicator').removeClass('active');
    for (let i = 1; i <= currentStep; i++) {
      jQuery(`#indicator-step-${i}`).addClass('active');
    }

    // Toggle button visibilities
    if (currentStep === 1) {
      jQuery('#btn-prev').hide();
      jQuery('#btn-next').show();
      jQuery('#btn-finish').hide();
      jQuery('#btn-skip').show();
    } else if (currentStep === 2) {
      jQuery('#btn-prev').show();
      jQuery('#btn-next').show();
      jQuery('#btn-finish').hide();
      jQuery('#btn-skip').show();
    } else if (currentStep === 3) {
      jQuery('#btn-prev').show();
      jQuery('#btn-next').hide();
      jQuery('#btn-finish').show();
      jQuery('#btn-skip').hide();
    }
  }

  /**
   * Validates the input elements in the active step.
   * Displays errors using role="alert" inline fields.
   *
   * @param {number} step The step number to validate.
   * @returns {boolean} True if inputs are valid, false otherwise.
   */
  function validateStep(step) {
    let isValid = true;
    jQuery(`#onboarding-step-${step} .error-msg`).hide().text('');

    if (step === 1) {
      const state = jQuery('#onboarding-state').val();
      if (!state) {
        jQuery('#error-step-1')
          .text('Please select your state / location.')
          .show()
          .attr('role', 'alert');
        isValid = false;
      }
    } else if (step === 2) {
      const transit = jQuery('[name="transit-mode"]:checked').val();
      const energy = jQuery('[name="energy-source"]:checked').val();
      const orders = jQuery('#onboarding-orders').val();

      if (!transit) {
        jQuery('#error-step-2')
          .text('Please select your primary transit mode.')
          .show()
          .attr('role', 'alert');
        isValid = false;
      } else if (!energy) {
        jQuery('#error-step-2')
          .text('Please select your primary household energy source.')
          .show()
          .attr('role', 'alert');
        isValid = false;
      } else if (!orders) {
        jQuery('#error-step-2')
          .text('Please select your average monthly e-commerce orders.')
          .show()
          .attr('role', 'alert');
        isValid = false;
      }
    }

    return isValid;
  }

  /**
   * Helper to fetch the distance seed based on transit mode.
   *
   * @param {string} mode - Transit mode key.
   * @returns {number} Distance seed in km.
   */
  function getDistanceSeed(mode) {
    const seeds = Constants.BASELINE_SEEDS || {
      rideshare: 15,
      metro: 20,
      auto_rickshaw: 10,
      domestic_rail: 50
    };
    return seeds[mode] || 0;
  }

  /**
   * Saves onboarding data to localStorage and IndexedDB baseline record.
   *
   * @returns {void}
   */
  function saveOnboardingData() {
    const data = {
      lang: jQuery('#lang-select').val() || 'en',
      state: jQuery('#onboarding-state').val(),
      transitMode: jQuery('[name="transit-mode"]:checked').val(),
      energySource: jQuery('[name="energy-source"]:checked').val(),
      monthlyOrders: jQuery('#onboarding-orders').val(),
      emailConnected: jQuery('#email-consent').is(':checked'),
      cloudConnected: jQuery('#cloud-consent').is(':checked')
    };

    localStorage.setItem('ecotrack_onboarded', 'true');
    localStorage.setItem('ecotrack_user_settings', JSON.stringify(data));
    
    // Save a baseline emission seed in IndexedDB
    if (global.EcoTrackDB) {
      const baselineRaw = getDistanceSeed(data.transitMode);
      const baselineType = 'commute';
      const baselineSubType = data.transitMode;

      if (global.EcoTrackWorker && baselineRaw > 0) {
        global.EcoTrackWorker.calculate(baselineType, baselineSubType, baselineRaw)
          .then(function(emissions) {
            global.EcoTrackDB.write({
              type: baselineType,
              subType: baselineSubType,
              rawValue: baselineRaw,
              emissionsGrams: emissions,
              processed: true,
              timestamp: Date.now()
            }).catch(function(err) {
              console.error('[Onboarding DB] Failed to seed baseline:', err);
            });
          });
      }
    }

    // Call server API profile sync if logged in
    const token = localStorage.getItem('ecotrack_token');
    if (token) {
      Utils.safeAjax({
        url: '/api/user/profile',
        method: 'PUT',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + token },
        data: JSON.stringify({ profile: data })
      }, function() {
        // success - profile synced
      }, function() {
        console.warn('Could not sync profile settings with backend.');
      });
    }

    // Hide onboarding modal/wizard
    jQuery('#onboarding-overlay').fadeOut();
    // Refresh main app dashboard metrics
    jQuery(document).trigger('ecotrack:onboarding-complete');
  }

  /**
   * Initializes event hooks for wizard elements.
   *
   * @returns {void}
   */
  function initOnboarding() {
    // Check if onboarding completed
    const onboarded = localStorage.getItem('ecotrack_onboarded');
    if (onboarded === 'true') {
      jQuery('#onboarding-overlay').hide();
    } else {
      jQuery('#onboarding-overlay').show();
      currentStep = 1;
      updateWizardUI();
    }

    // Hook wizard buttons
    jQuery('#btn-next').off('click').on('click', function() {
      if (validateStep(currentStep)) {
        currentStep++;
        updateWizardUI();
      }
    });

    jQuery('#btn-prev').off('click').on('click', function() {
      if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
      }
    });

    jQuery('#btn-skip').off('click').on('click', function() {
      // Set baseline default settings
      localStorage.setItem('ecotrack_onboarded', 'true');
      jQuery('#onboarding-overlay').fadeOut();
      jQuery(document).trigger('ecotrack:onboarding-complete');
    });

    jQuery('#btn-finish').off('click').on('click', function() {
      saveOnboardingData();
    });

    // Language selector change inside onboarding triggers loading languages
    jQuery('#onboarding-lang-select').off('change').on('change', function() {
      const selected = jQuery(this).val();
      jQuery('#lang-select').val(selected).trigger('change');
    });

    // Ensure steps indicator click is disabled (must use buttons)
    jQuery('.step-indicator').css('cursor', 'default');
  }

  // Bind init to DOM ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initOnboarding);
  }

  const OnboardingController = {
    initOnboarding,
    validateStep,
    saveOnboardingData,
    getCurrentStep: () => currentStep,
    setStep: (s) => { currentStep = s; updateWizardUI(); }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OnboardingController;
  } else {
    global.EcoTrackOnboarding = OnboardingController;
  }
})(typeof window !== 'undefined' ? window : this);
