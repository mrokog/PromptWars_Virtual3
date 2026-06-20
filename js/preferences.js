/**
 * Single source of truth for localStorage state persistence.
 */
const EcoTrackPreferences = (function () {
  'use strict';

  const STORAGE_KEYS = Object.freeze({
    LANG: 'ecotrack_lang',
    THEME: 'ecotrack_theme',
    ONBOARDED: 'ecotrack_onboarded',
    USER_SETTINGS: 'ecotrack_user_settings',
    TOKEN: 'ecotrack_token',
    EMAIL_CONNECTED: 'ecotrack_email_connected',
  });

  /**
   * Retrieves the saved language or default 'en'.
   * @returns {string} The language code.
   */
  function getLanguage() {
    return localStorage.getItem(STORAGE_KEYS.LANG) || 'en';
  }

  /**
   * Saves the language preference.
   * @param {string} lang - The language code to save.
   */
  function setLanguage(lang) {
    localStorage.setItem(STORAGE_KEYS.LANG, lang);
  }

  /**
   * Retrieves the saved theme or default 'western-ghats'.
   * @returns {string} The theme name.
   */
  function getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'western-ghats';
  }

  /**
   * Saves the theme preference.
   * @param {string} theme - The theme name to save.
   */
  function setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  /**
   * Checks if onboarding is completed.
   * @returns {boolean} True if onboarded.
   */
  function isOnboarded() {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';
  }

  /**
   * Saves onboarding completion status.
   * @param {boolean} value - Completion status.
   */
  function setOnboarded(value) {
    localStorage.setItem(STORAGE_KEYS.ONBOARDED, String(value));
  }

  /**
   * Retrieves user configuration settings.
   * @returns {Object|null} Parsed settings object or null.
   */
  function getUserSettings() {
    const settings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    if (!settings) {
      return null;
    }
    try {
      return JSON.parse(settings);
    } catch (e) {
      console.error('[EcoTrack Preferences] Failed to parse user settings:', e);
      return null;
    }
  }

  /**
   * Saves user configuration settings.
   * @param {Object} settings - Settings object.
   */
  function setUserSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
  }

  /**
   * Retrieves authentication token.
   * @returns {string|null} The token or null.
   */
  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  /**
   * Saves authentication token.
   * @param {string} token - The auth token.
   */
  function setToken(token) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  }

  /**
   * Removes authentication token.
   */
  function removeToken() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
  }

  /**
   * Checks if email connection is configured.
   * @returns {boolean} True if email is connected.
   */
  function isEmailConnected() {
    return localStorage.getItem(STORAGE_KEYS.EMAIL_CONNECTED) === 'true';
  }

  /**
   * Saves email connection status.
   * @param {boolean} value - Connection status.
   */
  function setEmailConnected(value) {
    localStorage.setItem(STORAGE_KEYS.EMAIL_CONNECTED, String(value));
  }

  return {
    getLanguage,
    setLanguage,
    getTheme,
    setTheme,
    isOnboarded,
    setOnboarded,
    getUserSettings,
    setUserSettings,
    getToken,
    setToken,
    removeToken,
    isEmailConnected,
    setEmailConnected,
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackPreferences;
} else {
  window.EcoTrackPreferences = EcoTrackPreferences;
}
