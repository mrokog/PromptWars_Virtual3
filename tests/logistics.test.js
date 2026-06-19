const jQuery = require('jquery');
global.jQuery = jQuery;
global.$ = jQuery;

const Logistics = require('../js/logistics.js');

describe('logistics.js Omni-Logistics Tracker', () => {
  beforeEach(() => {
    global.EcoTrackDB = {
      addBehaviorEntriesBatch: jest.fn().mockResolvedValue([1, 2, 3]),
      writeBatch: jest.fn().mockResolvedValue([1, 2, 3])
    };

    // Mock background calculations fresh per test
    global.EcoTrackWorker = {
      calculate: jest.fn().mockImplementation((type, subType, rawValue) => {
        let factor = 0;
        if (subType === 'air_freight') factor = 600;
        else if (subType === 'rail_freight') factor = 25;
        else if (subType === 'road_freight') factor = 120;
        return Promise.resolve(rawValue * factor);
      })
    };

    document.body.innerHTML = `
      <div id="logistics-receipts-container"></div>
      <input type="checkbox" id="email-consent">
      <button id="btn-connect-email">Connect</button>
      <div id="logistics-error"></div>
    `;
    localStorage.clear();
  });

  test('Air freight calculates correctly: 2kg x 600 = 1200g CO2', async () => {
    await Logistics.processAndSaveReceipts();

    // Verify card rendered with calculated air emissions
    const $airCard = jQuery('#receipt-card-FKT-9831');
    expect($airCard.length).toBe(1);
    
    // Base is 1200g. With +380g return surcharge, total is 1580g.
    expect($airCard.text()).toContain('1,580g');
  });

  test('Rail freight calculates correctly: 2kg x 25 = 50g CO2', async () => {
    // Modify mock weight to 2kg for the rail shipment MYN-0987 inside tests
    const mockReceipts = Logistics.getMockReceipts();
    const originalRailWeight = mockReceipts[2].weightKg;
    mockReceipts[2].weightKg = 2.0;

    await Logistics.processAndSaveReceipts();

    const $railCard = jQuery('#receipt-card-MYN-0987');
    expect($railCard.length).toBe(1);
    expect($railCard.text()).toContain('50g'); // 2kg * 25 = 50g

    // Restore
    mockReceipts[2].weightKg = originalRailWeight;
  });

  test('Return surcharge is added to base shipment total', async () => {
    await Logistics.processAndSaveReceipts();

    const $airCard = jQuery('#receipt-card-FKT-9831');
    // Base = 2kg * 600 = 1200g. Return surcharge = 380g. Total = 1580g.
    expect($airCard.html()).toContain('Estimated CO₂:</strong> 1,580g');
    expect($airCard.html()).toContain('Reverse logistics CO₂: +380g');
  });

  test('Keep-or-donate tip appears only when return is detected', async () => {
    await Logistics.processAndSaveReceipts();

    const $airCard = jQuery('#receipt-card-FKT-9831'); // returned
    const $roadCard = jQuery('#receipt-card-AMZ-4322'); // kept

    expect($airCard.find('.logistics-card__tip').length).toBe(1);
    expect($airCard.text()).toContain('Tip: Keep or donate instead');
    
    expect($roadCard.find('.logistics-card__tip').length).toBe(0);
    expect($roadCard.text()).not.toContain('Tip: Keep or donate instead');
  });
});
