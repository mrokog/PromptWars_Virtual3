const jQuery = require('jquery');
global.jQuery = jQuery;
global.$ = jQuery;

const App = require('../js/app.js');

describe('app.js Impact Summary Calculations', () => {
  test('calculateStreakAndSavings calculates savings correctly for commute and cloud', () => {
    const entries = [
      // 10km metro: baseline rideshare (180g) - metro (35g) = 145g * 10 = 1450g saved
      { type: 'commute', subType: 'metro', rawValue: 10, emissionsGrams: 350, timestamp: Date.now() },
      // 5km walk: baseline rideshare (180g) - walk (0g) = 180g * 5 = 900g saved
      { type: 'commute', subType: 'walk', rawValue: 5, emissionsGrams: 0, timestamp: Date.now() },
      // Cloud clean up: -14000g emissions saved
      { type: 'cloud', subType: 'cleanup', rawValue: -2.0, emissionsGrams: -14000, timestamp: Date.now() }
    ];

    const stats = App.calculateStreakAndSavings(entries);
    // 1450 + 900 + 14000 = 16350g saved
    expect(stats.savedGrams).toBe(16350);
  });

  test('calculateStreakAndSavings calculates daily streak correctly', () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const entries = [
      { type: 'commute', subType: 'metro', rawValue: 10, emissionsGrams: 350, timestamp: now },
      { type: 'commute', subType: 'metro', rawValue: 10, emissionsGrams: 350, timestamp: now - oneDayMs },
      { type: 'commute', subType: 'metro', rawValue: 10, emissionsGrams: 350, timestamp: now - 2 * oneDayMs }
    ];

    const stats = App.calculateStreakAndSavings(entries);
    expect(stats.streak).toBe(3);
  });

  test('calculateStreakAndSavings returns 0 streak if last entry is too old', () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const entries = [
      { type: 'commute', subType: 'metro', rawValue: 10, emissionsGrams: 350, timestamp: now - 3 * oneDayMs },
      { type: 'commute', subType: 'metro', rawValue: 10, emissionsGrams: 350, timestamp: now - 4 * oneDayMs }
    ];

    const stats = App.calculateStreakAndSavings(entries);
    expect(stats.streak).toBe(0);
  });
});
