(function(global) {
  'use strict';

  const DB_NAME = 'EcoTrackDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'behavioralData';

  let dbInstance = null;

  /**
   * Opens the IndexedDB database, setting up the store if it doesn't exist.
   * @returns {Promise<IDBDatabase>}
   */
  function openDB() {
    return new Promise(function(resolve, reject) {
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }
      const idb = global.indexedDB || (global.window && global.window.indexedDB);
      if (!idb) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = idb.open(DB_NAME, DB_VERSION);

      request.onerror = function() {
        reject(new Error('Failed to open database: ' + request.error));
      };

      request.onsuccess = function(event) {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  /**
   * Writes a list of behavioral entries in a single transaction.
   * Rollback is performed automatically by IndexedDB on transaction abort.
   * @param {Array<Object>} entries List of behavioral entries to add.
   * @returns {Promise<Array<number>>} Resolves to list of written entry keys.
   */
  function addBehaviorEntriesBatch(entries) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const keys = [];

        transaction.oncomplete = function() {
          resolve(keys);
        };

        transaction.onabort = function() {
          reject(new Error('Transaction aborted. Changes rolled back. Error: ' + transaction.error));
        };

        transaction.onerror = function() {
          reject(new Error('Transaction failed: ' + transaction.error));
        };

        let validationError = false;
        entries.forEach(function(entry) {
          const rawVal = Number(entry.rawValue);
          const emissions = Number(entry.emissionsGrams || 0);

          if (!entry.type || isNaN(rawVal) || isNaN(emissions)) {
            validationError = true;
            return;
          }

          // Data sanitization - strict PII exclusion
          const sanitizedEntry = {
            type: entry.type,               // 'commute' | 'purchase' | 'email' | 'cloud'
            subType: entry.subType || '',   // e.g. 'rideshare', 'metro', 'air_freight'
            timestamp: entry.timestamp || Date.now(),
            rawValue: rawVal, // km, grams, GB
            emissionsGrams: emissions,
            processed: Boolean(entry.processed || false)
          };

          const request = store.add(sanitizedEntry);
          request.onsuccess = function(e) {
            keys.push(e.target.result);
          };
        });

        if (validationError) {
          transaction.abort();
        }
      });
    });
  }

  /**
   * Adds a single behavioral entry. Uses the batch method underneath for consistency.
   * @param {Object} entry Behavioral entry to add.
   * @returns {Promise<number>} Resolves to key of the written entry.
   */
  function addBehaviorEntry(entry) {
    return addBehaviorEntriesBatch([entry]).then(function(keys) {
      return keys[0];
    });
  }

  /**
   * Retrieves all behavioral entries.
   * @returns {Promise<Array<Object>>}
   */
  function getAllEntries() {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = function() {
          resolve(request.result || []);
        };

        request.onerror = function() {
          reject(new Error('Failed to retrieve entries: ' + request.error));
        };
      });
    });
  }

  /**
   * Retrieves all entries where processed is false.
   * @returns {Promise<Array<Object>>}
   */
  function getUnprocessedEntries() {
    return getAllEntries().then(function(entries) {
      return entries.filter(function(entry) {
        return !entry.processed;
      });
    });
  }

  /**
   * Marks a set of entry IDs as processed.
   * @param {Array<number>} ids Array of key IDs.
   * @returns {Promise<void>}
   */
  function markEntriesAsProcessed(ids) {
    if (!ids || ids.length === 0) return Promise.resolve();

    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        transaction.oncomplete = function() {
          resolve();
        };

        transaction.onerror = function() {
          reject(new Error('Failed to mark entries as processed: ' + transaction.error));
        };

        ids.forEach(function(id) {
          const getReq = store.get(id);
          getReq.onsuccess = function(e) {
            const data = e.target.result;
            if (data) {
              data.processed = true;
              store.put(data);
            }
          };
        });
      });
    });
  }

  /**
   * Gets aggregated totals of processed and unprocessed emissions grouped by type.
   * @returns {Promise<Object>}
   */
  function getAggregatedEmissions() {
    return getAllEntries().then(function(entries) {
      const aggregates = {
        commute: 0,
        purchase: 0,
        email: 0,
        cloud: 0,
        total: 0
      };

      entries.forEach(function(entry) {
        if (aggregates[entry.type] !== undefined) {
          aggregates[entry.type] += entry.emissionsGrams;
        }
        aggregates.total += entry.emissionsGrams;
      });

      return aggregates;
    });
  }

  /**
   * Clears the entire behavioralData store.
   * @returns {Promise<void>}
   */
  function clearDB() {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = function() {
          resolve();
        };

        request.onerror = function() {
          reject(new Error('Failed to clear database: ' + request.error));
        };
      });
    });
  }

  /**
   * Retrieves behavioral entries of a specific type.
   * @param {string} type - Entry category type ('commute' | 'purchase' | 'email' | 'cloud').
   * @returns {Promise<Array<Object>>} List of entries of this type.
   */
  function getAggregateByType(type) {
    return getAllEntries().then(function(entries) {
      return entries.filter(function(entry) {
        return entry.type === type;
      });
    });
  }

  const BehavioralStore = {
    openDB,
    addBehaviorEntry,
    addBehaviorEntriesBatch,
    getAllEntries,
    getUnprocessedEntries,
    markEntriesAsProcessed,
    getAggregatedEmissions,
    clearDB,
    // Unified interface aliases
    write: addBehaviorEntry,
    writeBatch: addBehaviorEntriesBatch,
    getAggregateByType,
    clear: clearDB
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BehavioralStore;
  } else {
    global.EcoTrackDB = BehavioralStore;
  }
})(typeof window !== 'undefined' ? window : this);
