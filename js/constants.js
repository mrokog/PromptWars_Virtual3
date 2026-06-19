(function(global) {
  'use strict';

  const EMISSION_FACTORS = Object.freeze({
    rideshare_per_km: 180,       // gCO2/km
    metro_per_km: 35,            // gCO2/km
    auto_rickshaw_per_km: 100,    // gCO2/km
    domestic_rail_per_km: 15,     // gCO2/km
    air_freight_per_kg: 600,      // gCO2/kg
    domestic_rail_freight: 25,    // gCO2/kg (domestic rail freight)
    domestic_road_freight: 120,   // gCO2/kg
    email_per_gb: 7000,           // gCO2/GB (idle server data)
    cloud_per_gb: 7000            // gCO2/GB
  });

  const THEMES = Object.freeze(['western-ghats', 'terracotta-monsoon']);

  const THEME_ICONS = Object.freeze({
    'western-ghats': '🏔️',
    'terracotta-monsoon': '🌧️'
  });

  const THEME_LABELS = Object.freeze({
    'western-ghats': 'Western Ghats',
    'terracotta-monsoon': 'Terracotta & Monsoon'
  });

  const SUPPORTED_LANGUAGES = Object.freeze(['en', 'hi', 'bn', 'mr', 'ta']);

  const DEFAULT_LANGUAGE = 'en';

  const CARBON_ZONES = Object.freeze({ RED: 60, AMBER: 30 });

  const NUDGE_DISMISS_MS = 8000;

  const RETURN_LOGISTICS_SURCHARGE = 380;

  const CLOUD_THRESHOLD_GB = 2.0;

  const BASELINE_SEEDS = Object.freeze({
    rideshare: 15,
    metro: 20,
    auto_rickshaw: 10,
    domestic_rail: 50,
    cycle: 0,
    walk: 0
  });

  const Constants = Object.freeze({
    EMISSION_FACTORS,
    THEMES,
    THEME_ICONS,
    THEME_LABELS,
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
    CARBON_ZONES,
    NUDGE_DISMISS_MS,
    RETURN_LOGISTICS_SURCHARGE,
    CLOUD_THRESHOLD_GB,
    BASELINE_SEEDS
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Constants;
  } else {
    global.EcoTrackConstants = Constants;
  }
})(typeof window !== 'undefined' ? window : this);
