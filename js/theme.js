(function(global) {
  'use strict';

  const THEMES = ['western-ghats', 'terracotta-monsoon'];
  const ICONS  = { 'western-ghats': '🏔️', 'terracotta-monsoon': '🌧️' };
  const LABELS = {
    'western-ghats': 'Switch to Terracotta & Monsoon theme',
    'terracotta-monsoon': 'Switch to Western Ghats theme'
  };

  /**
   * Toggles between Western Ghats and Terracotta & Monsoon themes.
   */
  function toggleTheme() {
    const $html = jQuery('html');
    const current = $html.attr('data-theme') || 'western-ghats';
    const next = current === 'western-ghats' ? 'terracotta-monsoon' : 'western-ghats';
    
    $html.attr('data-theme', next);
    jQuery('#theme-icon').text(ICONS[next]);
    
    const $toggle = jQuery('#theme-toggle');
    $toggle.attr('aria-checked', next === 'terracotta-monsoon' ? 'true' : 'false');
    $toggle.attr('aria-label', LABELS[next]);
    
    localStorage.setItem('ecotrack_theme', next);
  }

  /**
   * Initializes the theme on page load.
   */
  function initTheme() {
    const saved = localStorage.getItem('ecotrack_theme') || 'western-ghats';
    jQuery('html').attr('data-theme', saved);
    jQuery('#theme-icon').text(ICONS[saved]);
    
    const $toggle = jQuery('#theme-toggle');
    $toggle.attr('aria-checked', saved === 'terracotta-monsoon' ? 'true' : 'false');
    $toggle.attr('aria-label', LABELS[saved]);
    
    // Register event click
    $toggle.off('click', toggleTheme).on('click', toggleTheme);
    
    // Support keyboard activation if needed (native buttons already trigger click on Enter and Space, 
    // but we add a check just in case it is styled otherwise)
    $toggle.off('keydown').on('keydown', function(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleTheme();
      }
    });
  }

  // Auto-init in browser if document is ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initTheme);
  }

  const ThemeController = {
    toggleTheme,
    initTheme
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeController;
  } else {
    global.EcoTrackTheme = ThemeController;
  }
})(typeof window !== 'undefined' ? window : this);
