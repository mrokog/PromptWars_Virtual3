/**
 * Localization Manager for EcoTrack India.
 */
const EcoTrackI18n = (function () {
  'use strict';

  const Constants =
    typeof require !== 'undefined' ? require('./constants.js') : global.EcoTrackConstants || {};
  const Preferences =
    typeof require !== 'undefined' ? require('./preferences.js') : global.EcoTrackPreferences || {};

  /**
   * Resolves a nested key path in a JSON object (e.g. "nav.dashboard").
   * @param {Object} obj The language JSON object.
   * @param {string} path Dotted path key.
   * @returns {string|null} Resolved string or null.
   */
  function getValueByPath(obj, path) {
    if (!obj || !path) {
      return null;
    }
    return path.split('.').reduce(function (acc, part) {
      return acc && acc[part] !== undefined ? acc[part] : null;
    }, obj);
  }

  /**
   * Helper to set translation on a single element.
   * @param {jQuery} $el Element to translate.
   * @param {string} val Translated value.
   * @private
   */
  function _translateElement($el, val) {
    if ($el.is('input') || $el.is('textarea')) {
      $el.attr('placeholder', val);
    } else {
      $el.text(val);
    }
  }

  /**
   * Appends/updates translated strings on all elements with a [data-i18n] attribute.
   * Uses textContent to mitigate XSS risks.
   * @param {Object} strings The language JSON object.
   * @returns {void}
   */
  function applyStrings(strings) {
    jQuery('[data-i18n]').each(function () {
      const $el = jQuery(this);
      const key = $el.attr('data-i18n');
      const val = getValueByPath(strings, key);
      if (val !== null) {
        _translateElement($el, val);
      }
    });

    const ariaLabel = getValueByPath(strings, 'accessibility.lang_select_label');
    if (ariaLabel) {
      jQuery('#lang-select').attr('aria-label', ariaLabel);
    }
  }

  /**
   * Loads language strings asynchronously from JSON file.
   * @param {string} langCode Supported language code (e.g. 'en', 'hi').
   * @returns {Promise} Resolves when translation is applied.
   */
  function loadLanguage(langCode) {
    const supported = Constants.SUPPORTED_LANGUAGES || ['en'];
    const fallback = Constants.DEFAULT_LANGUAGE || 'en';
    const code = supported.indexOf(langCode) !== -1 ? langCode : fallback;

    return jQuery
      .getJSON(`/lang/${code}.json`)
      .done(function (strings) {
        applyStrings(strings);
        document.documentElement.setAttribute('lang', code);
        document.documentElement.setAttribute('dir', 'ltr');
        Preferences.setLanguage(code);
        jQuery(document).trigger('ecotrack:langchange', [code, strings]);
      })
      .fail(function (xhr, status, error) {
        console.error(`[EcoTrack i18n] Failed to load language: ${langCode}`, error);
        if (code !== fallback) {
          loadLanguage(fallback);
        }
      });
  }

  /**
   * Automatically detects the browser language and initializes the localization engine.
   * @returns {void}
   */
  function initLanguage() {
    const supported = Constants.SUPPORTED_LANGUAGES || ['en'];
    const fallback = Constants.DEFAULT_LANGUAGE || 'en';
    const saved = Preferences.getLanguage();

    if (saved && supported.indexOf(saved) !== -1) {
      loadLanguage(saved);
    } else {
      const browserLang = (navigator.language || '').substring(0, 2);
      const initial = supported.indexOf(browserLang) !== -1 ? browserLang : fallback;
      loadLanguage(initial);
    }

    jQuery('#lang-select')
      .off('change')
      .on('change', function () {
        loadLanguage(jQuery(this).val());
      });

    const current = Preferences.getLanguage() || fallback;
    jQuery('#lang-select').val(current);
  }

  // Auto-init in browser if document is ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initLanguage);
  }

  return {
    loadLanguage,
    initLanguage,
    applyStrings,
    getValueByPath,
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackI18n;
} else {
  window.EcoTrackI18n = EcoTrackI18n;
}
