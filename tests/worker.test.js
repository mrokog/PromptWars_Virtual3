const WorkerService = require('../js/worker.js');

describe('worker.js Calculation & Pattern Service', () => {
  beforeEach(() => {
    // Clear and mock references
    global.EcoTrackConstants = {
      EMISSION_FACTORS: {
        rideshare: 180,
        metro: 35,
        auto_rickshaw: 100,
        domestic_rail: 15,
        air_freight: 600,
        rail_freight: 25,
        road_freight: 120,
        email_per_gb: 7000,
        cloud_per_gb: 7000
      },
      CLOUD_THRESHOLD_GB: 2.0
    };
  });

  test('calculate returns correct emission grams for commute and purchase types', async () => {
    const commuteVal = await WorkerService.calculate('commute', 'metro', 15);
    expect(commuteVal).toBe(15 * 35);

    const logisticsVal = await WorkerService.calculate('purchase', 'air_freight', 2.5);
    expect(logisticsVal).toBe(2.5 * 600);
  });

  test('detectPatterns detects consecutive rideshare patterns correctly', async () => {
    const entries = [
      { type: 'commute', subType: 'rideshare', rawValue: 10, emissionsGrams: 1800, timestamp: Date.now() - 2000 },
      { type: 'commute', subType: 'rideshare', rawValue: 5, emissionsGrams: 900, timestamp: Date.now() - 1000 },
      { type: 'commute', subType: 'rideshare', rawValue: 8, emissionsGrams: 1440, timestamp: Date.now() }
    ];

    const patterns = await WorkerService.detectPatterns(entries);
    expect(patterns).toContain('consecutive_rideshare');
  });

  test('detectPatterns detects high cloud usage patterns correctly', async () => {
    const entries = [
      { type: 'cloud', subType: 'backup', rawValue: 1.5, emissionsGrams: 10500, timestamp: Date.now() },
      { type: 'cloud', subType: 'drive', rawValue: 1.0, emissionsGrams: 7000, timestamp: Date.now() }
    ];

    const patterns = await WorkerService.detectPatterns(entries);
    expect(patterns).toContain('high_cloud_usage');
  });
});
