(function(global) {
  'use strict';

  const nudgeQueue = [];
  let isDisplaying = false;
  let autoDismissTimeout = null;

  /**
   * Pushes a nudge to the queue and starts processing.
   * @param {string} i18nKey Translation key for the nudge.
   * @param {string} [metricText] Optional custom metric text to append or interpolate.
   */
  function triggerNudge(i18nKey, metricText = '') {
    nudgeQueue.push({ key: i18nKey, metric: metricText });
    processQueue();
  }

  /**
   * Processes the queue to display the next nudge if none is active.
   */
  function processQueue() {
    if (isDisplaying || nudgeQueue.length === 0) return;

    isDisplaying = true;
    const current = nudgeQueue.shift();

    // Fetch translated base text if i18n available, else fallback
    let baseText = '';
    if (global.EcoTrackI18n && global.localStorage) {
      const currentLang = global.localStorage.getItem('ecotrack_lang') || 'en';
      // We read strings from DOM or simulate i18n lookup
      // To be absolutely safe, we look up the element text or let applyStrings handle it
      baseText = ''; 
    }

    // Create nudge element
    const $container = jQuery('#nudge-container');
    if ($container.length === 0) {
      isDisplaying = false;
      return;
    }

    // Clean container
    $container.empty();

    // Create the nudge card HTML exactly as specified
    const $nudgeCard = jQuery(
      `<div class="eco-nudge" role="alert" aria-live="polite">
        <span class="nudge-icon" aria-hidden="true">🌱</span>
        <p class="nudge-text" data-i18n="${current.key}"></p>
        <button class="nudge-dismiss" aria-label="Dismiss this suggestion">✕</button>
      </div>`
    );

    // Append metric text if provided
    if (current.metric) {
      const $metricSpan = jQuery(`<span class="nudge-metric"> - ${current.metric}</span>`);
      $nudgeCard.find('.nudge-text').append($metricSpan);
    }

    $container.append($nudgeCard);
    
    // Apply translations to the card
    if (global.EcoTrackI18n && global.EcoTrackI18n.applyStrings) {
      // Fetch strings from current language if available in cached memory
      // In the application, we trigger i18n.applyStrings to refresh data-i18n tags
      // Or we can load the JSON files. For simple cases, we can trigger i18n re-processing:
      const activeLang = localStorage.getItem('ecotrack_lang') || 'en';
      jQuery.getJSON(`/lang/${activeLang}.json`).done(function(strings) {
        global.EcoTrackI18n.applyStrings(strings);
        if (current.metric) {
          $nudgeCard.find('.nudge-text').append(` - ${current.metric}`);
        }
      });
    }

    // Show card
    $nudgeCard.css({ display: 'flex', opacity: 0 }).animate({ opacity: 1 }, 300);

    // Setup manual dismiss
    $nudgeCard.find('.nudge-dismiss').on('click', function() {
      dismissNudge($nudgeCard);
    });

    // Setup auto-dismiss after 8 seconds (8000ms)
    autoDismissTimeout = setTimeout(function() {
      dismissNudge($nudgeCard);
    }, 8000);
  }

  /**
   * Dismisses the active nudge card and triggers the next.
   * @param {jQuery} $card Element representing the nudge.
   */
  function dismissNudge($card) {
    if (autoDismissTimeout) {
      clearTimeout(autoDismissTimeout);
      autoDismissTimeout = null;
    }

    $card.animate({ opacity: 0 }, 300, function() {
      $card.remove();
      isDisplaying = false;
      // Process next in queue
      processQueue();
    });
  }

  /**
   * Scans IndexedDB records to identify patterns and trigger nudges automatically.
   */
  function checkBehavioralNudges() {
    if (!global.EcoTrackDB) return;

    global.EcoTrackDB.getAllEntries().then(function(entries) {
      // 1. Commute check: 3+ consecutive entries of rideshare
      const commuteEntries = entries.filter(e => e.type === 'commute');
      let consecutiveRideshare = 0;
      for (let i = commuteEntries.length - 1; i >= 0; i--) {
        // We look for 'rideshare'
        // Let's check if the entry's subType was rideshare (which we can infer or store)
        // Wait, IndexedDB schema is: type, rawValue, emissionsGrams, processed. 
        // We can infer rideshare if rawValue * rideshare_per_km === emissionsGrams!
        // Or let's see, did we store subType in the DB? 
        // The DB schema is:
        // { id: 'auto-increment', type: 'commute | purchase | email | cloud', timestamp, rawValue, emissionsGrams, processed }
        // Wait! In the schema, there's no subType field. But we can check if rawValue matches rideshare emissions:
        // rideshare is 180 gCO2/km. So rawValue * 180 === emissionsGrams!
        // Yes, let's verify if the emission factor matches rideshare (180).
        const entry = commuteEntries[i];
        if (entry.rawValue > 0 && Math.abs((entry.emissionsGrams / entry.rawValue) - 180) < 0.1) {
          consecutiveRideshare++;
          if (consecutiveRideshare >= 3) {
            triggerNudge('nudge.commute_rail', 'Switch to metro → save 40% today');
            break;
          }
        } else {
          // Reset if we encounter a non-rideshare commute
          consecutiveRideshare = 0;
        }
      }

      // 2. Cloud declutter check: If total cloud emissions indicate high idle storage
      // Storage > 2GB. 2GB * 7000 = 14000g CO2.
      // Let's check if there's any cloud entry in DB with rawValue > 2 (GB)
      const cloudEntries = entries.filter(e => e.type === 'cloud' && e.rawValue > 2);
      if (cloudEntries.length > 0) {
        const totalGB = cloudEntries.reduce((sum, e) => sum + e.rawValue, 0);
        triggerNudge('nudge.digital_clear', `Clear ${totalGB.toFixed(1)}GB of files → save ${(totalGB * 7000).toLocaleString()}g CO₂`);
      }
    }).catch(function(err) {
      console.error('[Nudge Engine] Failed to query behavioral data:', err);
    });
  }

  const NudgeEngine = {
    triggerNudge,
    dismissNudge,
    checkBehavioralNudges,
    getQueue: () => nudgeQueue,
    isDisplaying: () => isDisplaying
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NudgeEngine;
  } else {
    global.EcoTrackNudge = NudgeEngine;
  }
})(typeof window !== 'undefined' ? window : this);
