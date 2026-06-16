const jQuery = require('jquery');
global.jQuery = jQuery;
global.$ = jQuery;

const Theme = require('../js/theme.js');

describe('theme.js Theme System', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    
    document.body.innerHTML = `
      <button id="theme-toggle" role="switch" aria-checked="false" class="theme-toggle-btn" aria-label="Switch Theme">
        <span id="theme-icon">🏔️</span>
      </button>
    `;
  });

  test("Default theme on first load is 'western-ghats'", () => {
    Theme.initTheme();
    expect(jQuery('html').attr('data-theme')).toBe('western-ghats');
    expect(jQuery('#theme-icon').text()).toBe('🏔️');
    expect(jQuery('#theme-toggle').attr('aria-checked')).toBe('false');
  });

  test("toggleTheme() switches from western-ghats to terracotta-monsoon", () => {
    Theme.initTheme();
    Theme.toggleTheme();
    expect(jQuery('html').attr('data-theme')).toBe('terracotta-monsoon');
    expect(jQuery('#theme-icon').text()).toBe('🌧️');
    expect(jQuery('#theme-toggle').attr('aria-checked')).toBe('true');
  });

  test("toggleTheme() switches back on second call", () => {
    Theme.initTheme();
    Theme.toggleTheme(); // Switch to terracotta-monsoon
    Theme.toggleTheme(); // Switch back to western-ghats
    expect(jQuery('html').attr('data-theme')).toBe('western-ghats');
    expect(jQuery('#theme-icon').text()).toBe('🏔️');
    expect(jQuery('#theme-toggle').attr('aria-checked')).toBe('false');
  });

  test("aria-checked attribute updates correctly on each toggle", () => {
    Theme.initTheme();
    const $toggle = jQuery('#theme-toggle');
    
    expect($toggle.attr('aria-checked')).toBe('false');
    Theme.toggleTheme();
    expect($toggle.attr('aria-checked')).toBe('true');
    Theme.toggleTheme();
    expect($toggle.attr('aria-checked')).toBe('false');
  });

  test("Theme persists to localStorage and restores on reload", () => {
    Theme.initTheme();
    Theme.toggleTheme(); // Now terracotta-monsoon
    expect(localStorage.getItem('ecotrack_theme')).toBe('terracotta-monsoon');
    
    // Simulate page reload
    document.documentElement.removeAttribute('data-theme');
    Theme.initTheme();
    expect(jQuery('html').attr('data-theme')).toBe('terracotta-monsoon');
  });
});
