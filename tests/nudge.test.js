const jQuery = require('jquery');
global.jQuery = jQuery;
global.$ = jQuery;

// Mock jQuery animate to run synchronously in tests
jQuery.fn.animate = function(props, speed, easing, callback) {
  let cb = callback;
  if (typeof speed === 'function') cb = speed;
  if (typeof easing === 'function') cb = easing;
  if (typeof cb === 'function') {
    cb.call(this);
  }
  return this;
};

// Set up mock constants for translations
const mockEnStrings = {
  nudge: {
    commute_rail: 'Switch to metro or rail today!',
    logistics_return: 'This return added CO2.',
    digital_clear: 'Clear cloud files.'
  }
};

// Mock i18n
global.EcoTrackI18n = {
  applyStrings: jest.fn().mockImplementation((strings) => {
    jQuery('[data-i18n]').each(function() {
      const key = jQuery(this).attr('data-i18n');
      if (key === 'nudge.commute_rail') {
        jQuery(this).text(mockEnStrings.nudge.commute_rail);
      }
    });
  })
};

// Mock getJSON to resolve synchronously
jQuery.getJSON = jest.fn().mockImplementation((url) => {
  const d = jQuery.Deferred();
  d.resolve(mockEnStrings);
  return d.promise();
});

const Nudge = require('../js/nudge.js');

describe('nudge.js Eco-Nudge System', () => {
  beforeEach(() => {
    localStorage.setItem('ecotrack_lang', 'en');
    
    // Clear mock database references
    global.EcoTrackDB = {
      getAllEntries: jest.fn().mockResolvedValue([])
    };

    document.body.innerHTML = `
      <div id="nudge-container"></div>
    `;
    
    // Reset queue and displaying states
    Nudge.getQueue().length = 0;
    if (Nudge.isDisplaying()) {
      const $card = jQuery('.eco-nudge');
      Nudge.dismissNudge($card);
    }
  });

  test('Nudge is triggered after 3 consecutive rideshare entries', async () => {
    global.EcoTrackDB = {
      getAllEntries: jest.fn().mockResolvedValue([
        { type: 'commute', rawValue: 10, emissionsGrams: 1800 }, // 10 * 180 = 1800
        { type: 'commute', rawValue: 5, emissionsGrams: 900 },   // 5 * 180 = 900
        { type: 'commute', rawValue: 8, emissionsGrams: 1440 }   // 8 * 180 = 1440
      ])
    };

    Nudge.checkBehavioralNudges();
    
    // Wait for promise resolution
    await new Promise(process.nextTick);

    expect(jQuery('.eco-nudge').length).toBe(1);
    expect(jQuery('.eco-nudge .nudge-text').attr('data-i18n')).toBe('nudge.commute_rail');
  });

  test('Nudge text renders in the active language', async () => {
    Nudge.triggerNudge('nudge.commute_rail');
    
    await new Promise(process.nextTick);
    
    expect(jQuery('.eco-nudge .nudge-text').text()).toContain(mockEnStrings.nudge.commute_rail);
  });

  test('Nudge dismisses after 8000ms', () => {
    jest.useFakeTimers();
    
    Nudge.triggerNudge('nudge.commute_rail');
    
    expect(jQuery('.eco-nudge').length).toBe(1);
    
    // Advance fake timers by 8000ms
    jest.advanceTimersByTime(8000);
    
    expect(jQuery('.eco-nudge').length).toBe(0);
    
    jest.useRealTimers();
  });

  test('Only one nudge is visible at a time (queue test)', async () => {
    Nudge.triggerNudge('nudge.commute_rail');
    Nudge.triggerNudge('nudge.logistics_return');
    Nudge.triggerNudge('nudge.digital_clear');

    await new Promise(process.nextTick);

    expect(jQuery('.eco-nudge').length).toBe(1);
    expect(Nudge.getQueue().length).toBe(2);
  });
});
