/**
 * User Onboarding Wizard Controller for EcoTrack India.
 */
const EcoTrackOnboarding = (function () {
  'use strict';

  const Constants =
    typeof require !== 'undefined' ? require('./constants.js') : global.EcoTrackConstants || {};
  const Utils = typeof require !== 'undefined' ? require('./utils.js') : global.EcoTrackUtils || {};
  const Preferences =
    typeof require !== 'undefined' ? require('./preferences.js') : global.EcoTrackPreferences || {};

  let currentStep = 1;

  /**
   * Helper to toggle wizard buttons based on current step.
   * @param {number} step Current wizard step.
   * @private
   */
  function _toggleWizardButtons(step) {
    jQuery('#btn-prev').toggle(step > 1);
    jQuery('#btn-next').toggle(step < 3);
    jQuery('#btn-finish').toggle(step === 3);
    jQuery('#btn-skip').toggle(step < 3);
  }

  /**
   * Shows the current step and hides others in the wizard.
   *
   * @returns {void}
   */
  function updateWizardUI() {
    jQuery('.onboarding-step').hide();
    jQuery(`#onboarding-step-${currentStep}`).show();

    jQuery('.step-indicator').removeClass('active');
    for (let i = 1; i <= currentStep; i++) {
      jQuery(`#indicator-step-${i}`).addClass('active');
    }

    _toggleWizardButtons(currentStep);
  }

  /**
   * Validates step 1 inputs.
   * @returns {boolean} True if valid.
   * @private
   */
  function _validateStep1() {
    const state = jQuery('#onboarding-state').val();
    if (!state) {
      jQuery('#error-step-1')
        .text('Please select your state / location.')
        .show()
        .attr('role', 'alert');
      return false;
    }
    return true;
  }

  /**
   * Validates step 2 inputs.
   * @returns {boolean} True if valid.
   * @private
   */
  function _validateStep2() {
    const transit = jQuery('[name="transit-mode"]:checked').val();
    const energy = jQuery('[name="energy-source"]:checked').val();
    const orders = jQuery('#onboarding-orders').val();

    let error = '';
    if (!transit) {
      error = 'Please select your primary transit mode.';
    } else if (!energy) {
      error = 'Please select your primary household energy source.';
    } else if (!orders) {
      error = 'Please select your average monthly e-commerce orders.';
    }

    if (error) {
      jQuery('#error-step-2').text(error).show().attr('role', 'alert');
      return false;
    }
    return true;
  }

  /**
   * Validates the input elements in the active step.
   * Displays errors using role="alert" inline fields.
   *
   * @param {number} step The step number to validate.
   * @returns {boolean} True if inputs are valid, false otherwise.
   */
  function validateStep(step) {
    jQuery(`#onboarding-step-${step} .error-msg`).hide().text('');
    if (step === 1) {
      return _validateStep1();
    }
    if (step === 2) {
      return _validateStep2();
    }
    return true;
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
      domestic_rail: 50,
    };
    return seeds[mode] || 0;
  }

  /**
   * Seeds the baseline emissions in the IndexedDB database.
   * @param {string} transitMode Selected transit mode.
   * @private
   */
  function _seedBaselineEmissions(transitMode) {
    if (!global.EcoTrackDB) {
      return;
    }
    const baselineRaw = getDistanceSeed(transitMode);
    if (global.EcoTrackWorker && baselineRaw > 0) {
      global.EcoTrackWorker.calculate('commute', transitMode, baselineRaw)
        .then(function (emissions) {
          global.EcoTrackDB.write({
            type: 'commute',
            subType: transitMode,
            rawValue: baselineRaw,
            emissionsGrams: emissions,
            processed: true,
            timestamp: Date.now(),
          });
        })
        .catch(function (err) {
          console.error('[Onboarding DB] Failed to seed baseline:', err);
        });
    }
  }

  /**
   * Syncs user onboarding settings profile with backend.
   * @param {Object} data User settings data object.
   * @private
   */
  function _syncProfileWithBackend(data) {
    const token = Preferences.getToken();
    if (token) {
      Utils.safeAjax(
        {
          url: '/api/user/profile',
          method: 'PUT',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + token },
          data: JSON.stringify({ profile: data }),
        },
        function () {
          // profile synced successfully
        },
        function () {
          console.warn('Could not sync profile settings with backend.');
        }
      );
    }
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
      cloudConnected: jQuery('#cloud-consent').is(':checked'),
    };

    Preferences.setOnboarded(true);
    Preferences.setUserSettings(data);

    _seedBaselineEmissions(data.transitMode);
    _syncProfileWithBackend(data);

    jQuery('#onboarding-overlay').fadeOut();
    jQuery(document).trigger('ecotrack:onboarding-complete');
  }

  /**
   * Binds click handlers to wizard control buttons.
   * @private
   */
  function _bindWizardButtons() {
    jQuery('#btn-next')
      .off('click')
      .on('click', function () {
        if (validateStep(currentStep)) {
          currentStep++;
          updateWizardUI();
        }
      });

    jQuery('#btn-prev')
      .off('click')
      .on('click', function () {
        if (currentStep > 1) {
          currentStep--;
          updateWizardUI();
        }
      });

    jQuery('#btn-skip')
      .off('click')
      .on('click', function () {
        Preferences.setOnboarded(true);
        jQuery('#onboarding-overlay').fadeOut();
        jQuery(document).trigger('ecotrack:onboarding-complete');
      });

    jQuery('#btn-finish').off('click').on('click', saveOnboardingData);
  }

  /**
   * Initializes event hooks for wizard elements.
   *
   * @returns {void}
   */
  function initOnboarding() {
    const onboarded = Preferences.isOnboarded();
    if (onboarded) {
      jQuery('#onboarding-overlay').hide();
    } else {
      jQuery('#onboarding-overlay').show();
      currentStep = 1;
      updateWizardUI();
    }

    _bindWizardButtons();

    jQuery('#onboarding-lang-select')
      .off('change')
      .on('change', function () {
        jQuery('#lang-select').val(jQuery(this).val()).trigger('change');
      });

    jQuery('.step-indicator').css('cursor', 'default');
  }

  // Bind init to DOM ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initOnboarding);
  }

  return {
    initOnboarding,
    validateStep,
    saveOnboardingData,
    getCurrentStep: () => currentStep,
    setStep: (s) => {
      currentStep = s;
      updateWizardUI();
    },
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackOnboarding;
} else {
  window.EcoTrackOnboarding = EcoTrackOnboarding;
}
