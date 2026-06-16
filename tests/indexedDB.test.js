// Inject fake IndexedDB factory into global context before importing DB code
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
global.indexedDB = new FDBFactory();

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = function(val) {
    return JSON.parse(JSON.stringify(val));
  };
}

const DB = require('../js/indexedDB.js');


describe('indexedDB.js Database System', () => {
  beforeEach(async () => {
    // Clear instance and reset mock DB
    global.indexedDB = new FDBFactory();
    
    // We get a clean DB setup per test
    // To reset singletons in commonjs require:
    jest.resetModules();
  });

  test('Behavioral data is written without PII fields', async () => {
    const DB_instance = require('../js/indexedDB.js');
    
    const piiEntry = {
      type: 'commute',
      rawValue: 15,
      emissionsGrams: 2700,
      processed: false,
      timestamp: Date.now(),
      // PII Fields that must NOT be stored
      username: 'ojaswi',
      email: 'ojaswi@example.com',
      locationName: 'Mumbai Central'
    };

    await DB_instance.addBehaviorEntry(piiEntry);
    const records = await DB_instance.getAllEntries();

    expect(records.length).toBe(1);
    const stored = records[0];
    
    // Verify stored fields match schema exactly and exclude PII
    expect(stored.type).toBe('commute');
    expect(stored.rawValue).toBe(15);
    expect(stored.emissionsGrams).toBe(2700);
    expect(stored.processed).toBe(false);
    expect(stored.id).toBeDefined();
    
    expect(stored.username).toBeUndefined();
    expect(stored.email).toBeUndefined();
    expect(stored.locationName).toBeUndefined();
  });

  test('Aggregated totals are correct after 5 write operations', async () => {
    const DB_instance = require('../js/indexedDB.js');

    const entries = [
      { type: 'commute', rawValue: 10, emissionsGrams: 1800 },
      { type: 'commute', rawValue: 5, emissionsGrams: 175 },
      { type: 'cloud', rawValue: 2.0, emissionsGrams: 14000 },
      { type: 'purchase', rawValue: 2.0, emissionsGrams: 1200 },
      { type: 'email', rawValue: 1.0, emissionsGrams: 7000 }
    ];

    await DB_instance.addBehaviorEntriesBatch(entries);

    const aggregates = await DB_instance.getAggregatedEmissions();

    expect(aggregates.commute).toBe(1975); // 1800 + 175
    expect(aggregates.cloud).toBe(14000);
    expect(aggregates.purchase).toBe(1200);
    expect(aggregates.email).toBe(7000);
    expect(aggregates.total).toBe(1975 + 14000 + 1200 + 7000);
  });

  test('Processed flag is set after worker completes/marks sync', async () => {
    const DB_instance = require('../js/indexedDB.js');

    const entryId = await DB_instance.addBehaviorEntry({
      type: 'commute',
      rawValue: 10,
      emissionsGrams: 1800,
      processed: false
    });

    let unprocessed = await DB_instance.getUnprocessedEntries();
    expect(unprocessed.length).toBe(1);
    expect(unprocessed[0].processed).toBe(false);

    await DB_instance.markEntriesAsProcessed([entryId]);

    unprocessed = await DB_instance.getUnprocessedEntries();
    expect(unprocessed.length).toBe(0);

    const all = await DB_instance.getAllEntries();
    expect(all[0].processed).toBe(true);
  });

  test('Failed transactions roll back cleanly', async () => {
    const DB_instance = require('../js/indexedDB.js');
    await DB_instance.openDB();
    
    // We try to trigger a rollback by forcing a transaction abort
    // In our implementation, we'll verify it returns a clean rejection when bad values are added
    const invalidEntry = {
      type: 'commute',
      rawValue: 'invalid-number', // Causes errors or bad payload conversion
      emissionsGrams: NaN
    };

    await expect(DB_instance.addBehaviorEntry(invalidEntry)).rejects.toThrow();
    
    // DB should contain 0 records
    const all = await DB_instance.getAllEntries();
    expect(all.length).toBe(0);
  });
});
