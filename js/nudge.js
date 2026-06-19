(function(global) {
  'use strict';

  const nudgeQueue = [];
  let isDisplaying = false;
  let autoDismissTimeout = null;

  /**
   * Pushes a nudge to the queue and starts processing.
   *
   * @param {string} i18nKey Translation key for the nudge.
   * @param {string} [metricText] Optional custom metric text to append or interpolate.
   * @returns {void}
   */
  function triggerNudge(i18nKey, metricText = '') {
    nudgeQueue.push({ key: i18nKey, metric: metricText });
    processQueue();
  }

  /**
   * Processes the queue to display the next nudge if none is active.
   *
   * @returns {void}
   */
  function processQueue() {
    if (isDisplaying || nudgeQueue.length === 0) return;

    isDisplaying = true;
    const current = nudgeQueue.shift();

    // Create nudge element
    const $container = jQuery('#nudge-container');
    if ($container.length === 0) {
      isDisplaying = false;
      return;
    }

    // Clean container
    $container.empty();

    // Create the nudge card HTML with action button and close trigger
    const $nudgeCard = jQuery(
      `<div class="eco-nudge" role="alert" aria-live="polite">
        <span class="nudge-icon" aria-hidden="true">🌱</span>
        <div class="nudge-content" style="display: flex; flex-direction: column; flex: 1;">
          <p class="nudge-text" style="margin: 0; font-size: 0.95rem; font-weight: 600;" data-i18n="${current.key}"></p>
          <button class="nudge-action-btn" data-i18n="nudge.action_btn_text" aria-label="Perform recommended action" style="align-self: flex-start; margin-top: 6px; padding: 4px 10px; font-size: 0.8rem; font-weight: 700; border: none; border-radius: 4px; background: #FFFFFF; color: var(--color-primary); cursor: pointer; min-height: 24px; min-width: 60px;"></button>
        </div>
        <button class="nudge-dismiss" aria-label="Dismiss this suggestion" style="background: none; border: none; color: #FFFFFF; font-size: 1.2rem; cursor: pointer; padding: 0 8px; display: flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px;">✕</button>
      </div>`
    );

    $container.append($nudgeCard);
    
    // Apply translations to the card
    if (global.EcoTrackI18n && global.EcoTrackI18n.applyStrings) {
      const activeLang = localStorage.getItem('ecotrack_lang') || 'en';
      jQuery.getJSON(`/lang/${activeLang}.json`).done(function(strings) {
        if (strings && strings.nudge) {
          const keySuffix = current.key.split('.')[1];
          if (!strings.nudge[keySuffix]) {
            current.key = 'nudge.commute_rail';
            $nudgeCard.find('.nudge-text').attr('data-i18n', 'nudge.commute_rail');
          }
        }
        global.EcoTrackI18n.applyStrings(strings);
        if (current.metric) {
          $nudgeCard.find('.nudge-text').append(` - ${current.metric}`);
        }
      });
    }

    // Show card
    $nudgeCard.css({ display: 'flex', opacity: 0 }).animate({ opacity: 1 }, 300);

    // Setup action button click handler
    $nudgeCard.find('.nudge-action-btn').on('click', function() {
      if (current.key.indexOf('commute_rail') !== -1) {
        const distance = 15;
        if (global.EcoTrackWorker && global.EcoTrackDB) {
          global.EcoTrackWorker.calculate('commute', 'metro', distance).then(function(emissions) {
            global.EcoTrackDB.write({
              type: 'commute',
              subType: 'metro',
              rawValue: distance,
              emissionsGrams: emissions
            }).then(function() {
              jQuery(document).trigger('ecotrack:entryAdded');
              dismissNudge($nudgeCard);
            });
          });
        }
      } else if (current.key.indexOf('digital_clear') !== -1) {
        if (global.EcoTrackDB) {
          const factor = (global.EcoTrackConstants && global.EcoTrackConstants.EMISSION_FACTORS && global.EcoTrackConstants.EMISSION_FACTORS.cloud_per_gb) || 7000;
          global.EcoTrackDB.write({
            type: 'cloud',
            subType: 'cleanup',
            rawValue: -2.0,
            emissionsGrams: -2.0 * factor
          }).then(function() {
            jQuery(document).trigger('ecotrack:entryAdded');
            dismissNudge($nudgeCard);
          });
        }
      } else {
        dismissNudge($nudgeCard);
      }
    });

    // Setup manual dismiss
    $nudgeCard.find('.nudge-dismiss').on('click', function() {
      dismissNudge($nudgeCard);
    });

    // Setup auto-dismiss after constants value (default 8000ms)
    const dismissMs = (global.EcoTrackConstants && global.EcoTrackConstants.NUDGE_DISMISS_MS) || 8000;
    autoDismissTimeout = setTimeout(function() {
      dismissNudge($nudgeCard);
    }, dismissMs);
  }

  /**
   * Dismisses the active nudge card and triggers the next.
   *
   * @param {jQuery} $card Element representing the nudge.
   * @returns {void}
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
   *
   * @returns {void}
   */
  function checkBehavioralNudges() {
    if (!global.EcoTrackDB || !global.EcoTrackWorker) return;

    global.EcoTrackDB.getAllEntries().then(function(entries) {
      return global.EcoTrackWorker.detectPatterns(entries).then(function(patterns) {
        if (patterns.indexOf('consecutive_rideshare') !== -1) {
          let baselineMode = 'rideshare';
          if (global.localStorage) {
            const userSettingsStr = global.localStorage.getItem('ecotrack_user_settings');
            if (userSettingsStr) {
              try {
                const settings = JSON.parse(userSettingsStr);
                if (settings && settings.commuteMode) {
                  baselineMode = settings.commuteMode;
                }
              } catch (e) {
                // ignore
              }
            }
          }
          const key = `nudge.commute_rail_from_${baselineMode}`;
          triggerNudge(key, 'Switch to metro → save 40% today');
        }

        if (patterns.indexOf('high_cloud_usage') !== -1) {
          const cloudEntries = entries.filter(e => e.type === 'cloud' && e.rawValue > 2);
          const totalGB = cloudEntries.reduce((sum, e) => sum + Number(e.rawValue || 0), 0);
          const factor = (global.EcoTrackConstants && global.EcoTrackConstants.EMISSION_FACTORS && global.EcoTrackConstants.EMISSION_FACTORS.cloud_per_gb) || 7000;
          triggerNudge('nudge.digital_clear', `Clear ${totalGB.toFixed(1)}GB of files → save ${(totalGB * factor).toLocaleString()}g CO₂`);
        }
      });
    }).catch(function(err) {
      console.error('[Nudge Engine] Failed to query behavioral data or detect patterns:', err);
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
