(function(global) {
  'use strict';

  const EMISSION_FACTORS = {
    rideshare_per_km: 180,       // gCO2/km
    metro_per_km: 35,            // gCO2/km
    auto_rickshaw_per_km: 100,    // gCO2/km
    domestic_rail_per_km: 15,     // gCO2/km
    air_freight_per_kg: 600,      // gCO2/kg
    domestic_rail_freight: 25,    // gCO2/kg (domestic rail freight)
    domestic_road_freight: 120,   // gCO2/kg
    email_per_gb: 7000,           // gCO2/GB (idle server data)
    cloud_per_gb: 7000            // gCO2/GB
  };

  const THEMES = ['western-ghats', 'terracotta-monsoon'];

  const THEME_ICONS = {
    'western-ghats': '🏔️',
    'terracotta-monsoon': '🌧️'
  };

  const THEME_LABELS = {
    'western-ghats': 'Western Ghats',
    'terracotta-monsoon': 'Terracotta & Monsoon'
  };

  const SUPPORTED_LANGUAGES = ['en', 'hi', 'bn', 'mr', 'ta'];

  const DEFAULT_LANGUAGE = 'en';

  const Constants = {
    EMISSION_FACTORS,
    THEMES,
    THEME_ICONS,
    THEME_LABELS,
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Constants;
  } else {
    global.EcoTrackConstants = Constants;
  }
})(typeof window !== 'undefined' ? window : this);
