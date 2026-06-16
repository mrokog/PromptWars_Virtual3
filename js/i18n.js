(function(global) {
  'use strict';

  const SUPPORTED_LANGS = ['en', 'hi', 'bn', 'mr', 'ta'];
  const DEFAULT_LANG = 'en';

  /**
   * Resolves a nested key path in a JSON object (e.g. "nav.dashboard").
   * @param {Object} obj The language JSON object.
   * @param {string} path Dotted path key.
   * @returns {string|null} Resolved string or null.
   */
  function getValueByPath(obj, path) {
    if (!obj || !path) return null;
    return path.split('.').reduce(function(acc, part) {
      return acc && acc[part] !== undefined ? acc[part] : null;
    }, obj);
  }

  /**
   * Appends/updates translated strings on all elements with a [data-i18n] attribute.
   * Uses textContent to mitigate XSS risks.
   * @param {Object} strings The language JSON object.
   */
  function applyStrings(strings) {
    jQuery('[data-i18n]').each(function() {
      const $el = jQuery(this);
      const key = $el.attr('data-i18n');
      const val = getValueByPath(strings, key);
      
      if (val !== null) {
        if ($el.is('input') || $el.is('textarea')) {
          // If it's an input/textarea with a placeholder, translate the placeholder
          $el.attr('placeholder', val);
        } else {
          $el.text(val);
        }
      }
    });

    // Also update aria-labels for accessibility elements from translations
    const langSelectLabel = getValueByPath(strings, 'accessibility.lang_select_label');
    if (langSelectLabel) {
      jQuery('#lang-select').attr('aria-label', langSelectLabel);
    }
    
    // Update theme toggle button's default labels/descriptions if needed
    // The theme.js manages its own label based on current theme, but we can trigger 
    // updates here if required.
  }

  /**
   * Loads language strings asynchronously from JSON file.
   * @param {string} langCode Supported language code (e.g. 'en', 'hi').
   * @returns {Promise} Resolves when translation is applied.
   */
  function loadLanguage(langCode) {
    const code = SUPPORTED_LANGS.includes(langCode) ? langCode : DEFAULT_LANG;
    
    // Return a promise structure for testing and orchestrator integration
    return jQuery.getJSON(`/lang/${code}.json`)
      .done(function(strings) {
        applyStrings(strings);
        document.documentElement.setAttribute('lang', code);
        document.documentElement.setAttribute('dir', 'ltr');
        localStorage.setItem('ecotrack_lang', code);
        // Dispatch custom event for modules to react to language change
        jQuery(document).trigger('ecotrack:langchange', [code, strings]);
      })
      .fail(function(xhr, status, error) {
        console.error(`[EcoTrack i18n] Failed to load language: ${langCode}`, error);
        if (code !== DEFAULT_LANG) {
          loadLanguage(DEFAULT_LANG);
        }
      });
  }

  /**
   * Automatically detects the browser language and initializes the localization engine.
   */
  function initLanguage() {
    const saved = localStorage.getItem('ecotrack_lang');
    if (saved && SUPPORTED_LANGS.includes(saved)) {
      loadLanguage(saved);
    } else {
      const browserLang = (navigator.language || navigator.userLanguage || '').substring(0, 2);
      const initial = SUPPORTED_LANGS.includes(browserLang) ? browserLang : DEFAULT_LANG;
      loadLanguage(initial);
    }

    // Set listener on the language selector dropdown
    jQuery('#lang-select').off('change').on('change', function() {
      const selected = jQuery(this).val();
      loadLanguage(selected);
    });

    // Set initial dropdown value
    const current = localStorage.getItem('ecotrack_lang') || DEFAULT_LANG;
    jQuery('#lang-select').val(current);
  }

  // Auto-init in browser if document is ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initLanguage);
  }

  const I18nController = {
    loadLanguage,
    initLanguage,
    applyStrings,
    getValueByPath
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18nController;
  } else {
    global.EcoTrackI18n = I18nController;
  }
})(typeof window !== 'undefined' ? window : this);
