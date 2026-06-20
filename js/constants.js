/**
 * Global constant definitions for EcoTrack India.
 */
const EcoTrackConstants = (function () {
  'use strict';

  const EMISSION_FACTORS = Object.freeze({
    RIDESHARE_PER_KM: 180,
    METRO_PER_KM: 35,
    AUTO_RICKSHAW_PER_KM: 100,
    DOMESTIC_RAIL_PER_KM: 15,
    AIR_FREIGHT_PER_KG: 600,
    DOMESTIC_RAIL_FREIGHT_PER_KG: 25,
    DOMESTIC_ROAD_FREIGHT_PER_KG: 120,
    EMAIL_PER_GB: 7000,
    CLOUD_PER_GB: 7000,
  });

  const THEMES = Object.freeze({
    WESTERN_GHATS: 'western-ghats',
    TERRACOTTA_MONSOON: 'terracotta-monsoon',
  });

  const THEME_ICONS = Object.freeze({
    'western-ghats': '🏔️',
    'terracotta-monsoon': '🌧️',
  });

  const THEME_LABELS = Object.freeze({
    'western-ghats': 'Western Ghats',
    'terracotta-monsoon': 'Terracotta & Monsoon',
  });

  const SUPPORTED_LANGUAGES = Object.freeze(['en', 'hi', 'bn', 'mr', 'ta']);

  const DEFAULT_LANGUAGE = 'en';

  const CARBON_METER_ZONES = Object.freeze({
    RED_THRESHOLD: 60,
    AMBER_THRESHOLD: 30,
  });

  const TIMING = Object.freeze({
    NUDGE_AUTO_DISMISS_MS: 8000,
    DEBOUNCE_MS: 300,
    THEME_TRANSITION_MS: 300,
  });

  const RETURN_LOGISTICS_SURCHARGE = 380;

  const CLOUD_THRESHOLD_GB = 2.0;

  const BASELINE_SEEDS = Object.freeze({
    rideshare: 15,
    metro: 20,
    auto_rickshaw: 10,
    domestic_rail: 50,
    cycle: 0,
    walk: 0,
  });

  return {
    EMISSION_FACTORS,
    THEMES,
    THEME_ICONS,
    THEME_LABELS,
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
    CARBON_METER_ZONES,
    TIMING,
    RETURN_LOGISTICS_SURCHARGE,
    CLOUD_THRESHOLD_GB,
    BASELINE_SEEDS,
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackConstants;
} else {
  window.EcoTrackConstants = EcoTrackConstants;
}
