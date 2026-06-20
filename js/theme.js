/**
 * Theme Manager for EcoTrack India.
 */
const EcoTrackTheme = (function () {
  'use strict';

  const Constants =
    typeof require !== 'undefined' ? require('./constants.js') : global.EcoTrackConstants || {};
  const Preferences =
    typeof require !== 'undefined' ? require('./preferences.js') : global.EcoTrackPreferences || {};

  const TOGGLE_LABELS = Object.freeze({
    'western-ghats': 'Switch to Terracotta & Monsoon theme',
    'terracotta-monsoon': 'Switch to Western Ghats theme',
  });

  /**
   * Toggles between Western Ghats and Terracotta & Monsoon themes.
   * @returns {void}
   */
  function toggleTheme() {
    const $html = jQuery('html');
    const current = $html.attr('data-theme') || Constants.THEMES.WESTERN_GHATS;
    const next =
      current === Constants.THEMES.WESTERN_GHATS
        ? Constants.THEMES.TERRACOTTA_MONSOON
        : Constants.THEMES.WESTERN_GHATS;

    $html.attr('data-theme', next);
    jQuery('#theme-icon').text(Constants.THEME_ICONS[next]);

    const $toggle = jQuery('#theme-toggle');
    $toggle.attr('aria-checked', next === Constants.THEMES.TERRACOTTA_MONSOON ? 'true' : 'false');
    $toggle.attr('aria-label', TOGGLE_LABELS[next]);

    Preferences.setTheme(next);
  }

  /**
   * Initializes the theme on page load.
   * @returns {void}
   */
  function initTheme() {
    const saved = Preferences.getTheme();
    jQuery('html').attr('data-theme', saved);
    jQuery('#theme-icon').text(Constants.THEME_ICONS[saved]);

    const $toggle = jQuery('#theme-toggle');
    if ($toggle.length > 0) {
      $toggle.attr(
        'aria-checked',
        saved === Constants.THEMES.TERRACOTTA_MONSOON ? 'true' : 'false'
      );
      $toggle.attr('aria-label', TOGGLE_LABELS[saved]);

      $toggle.off('click', toggleTheme).on('click', toggleTheme);
      $toggle.off('keydown').on('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleTheme();
        }
      });
    }
  }

  // Auto-init in browser if document is ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initTheme);
  }

  return {
    toggleTheme,
    initTheme,
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackTheme;
} else {
  window.EcoTrackTheme = EcoTrackTheme;
}
