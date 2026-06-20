/**
 * Logistics Manager for EcoTrack India.
 */
const EcoTrackLogistics = (function () {
  'use strict';

  const Constants =
    typeof require !== 'undefined' ? require('./constants.js') : global.EcoTrackConstants || {};
  const Utils = typeof require !== 'undefined' ? require('./utils.js') : global.EcoTrackUtils || {};
  const Preferences =
    typeof require !== 'undefined' ? require('./preferences.js') : global.EcoTrackPreferences || {};

  // Mock receipt data representing parsed email headers
  const MOCK_RECEIPTS = [
    {
      id: 'FKT-9831',
      merchant: 'Flipkart',
      subject: 'Your Flipkart order FKT-9831 has been delivered',
      weightKg: 2,
      transitMode: 'air_freight',
      isReturn: true,
      returnSurchargeGrams: Constants.RETURN_LOGISTICS_SURCHARGE || 380,
      date: 'June 14, 2026',
    },
    {
      id: 'AMZ-4322',
      merchant: 'Amazon India',
      subject: 'Order confirmation: AMZ-4322',
      weightKg: 5,
      transitMode: 'road_freight',
      isReturn: false,
      returnSurchargeGrams: 0,
      date: 'June 15, 2026',
    },
    {
      id: 'MYN-0987',
      merchant: 'Myntra',
      subject: 'Shipment delivered for order MYN-0987',
      weightKg: 3,
      transitMode: 'rail_freight',
      isReturn: false,
      returnSurchargeGrams: 0,
      date: 'June 16, 2026',
    },
  ];

  /**
   * Resets the connection button UI state with a error message alert.
   *
   * @param {string} errMsg The error message to present to the user.
   * @returns {void}
   */
  function resetConnectionButton(errMsg) {
    jQuery('#logistics-error').text(errMsg).show().attr('role', 'alert');
    jQuery('#btn-connect-email').prop('disabled', false).text('Connect Email');
  }

  /**
   * Standardized email connection mock API wrapper.
   * @private
   */
  function _connectEmailOAuth() {
    jQuery('#btn-connect-email').prop('disabled', true).text('Connecting via OAuth...');

    Utils.safeAjax(
      {
        url: '/api/oauth/email',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ consent: true }),
      },
      function (response) {
        if (response.success) {
          Preferences.setEmailConnected(true);
          jQuery('#btn-connect-email')
            .removeClass('btn-primary')
            .addClass('btn-success')
            .text('Connected');
          processAndSaveReceipts();
        } else {
          resetConnectionButton('OAuth connection failed.');
        }
      },
      function () {
        resetConnectionButton('Could not connect to server.');
      }
    );
  }

  /**
   * Triggers the logistics email parsing simulation.
   * Performs client-side OAuth validation and requires explicit consent.
   *
   * @returns {void}
   */
  function handleConnectEmail() {
    const $consentCheckbox = jQuery('#email-consent');
    const $errorAlert = jQuery('#logistics-error');

    $errorAlert.hide().text('');

    if (!$consentCheckbox.is(':checked')) {
      $errorAlert
        .text('You must actively check the consent checkbox to connect email services.')
        .show()
        .attr('role', 'alert');
      return;
    }

    _connectEmailOAuth();
  }

  /**
   * Calculates emissions for a single receipt entry.
   * @param {Object} receipt Receipt object.
   * @param {Array<Object>} dbEntries Array to push store entry to.
   * @returns {Promise<Object>} Processed receipt object.
   * @private
   */
  function _processSingleReceipt(receipt, dbEntries) {
    if (!global.EcoTrackWorker) {
      return Promise.resolve(receipt);
    }
    return global.EcoTrackWorker.calculate('purchase', receipt.transitMode, receipt.weightKg).then(
      function (baseEmissions) {
        const totalEmissions = baseEmissions + receipt.returnSurchargeGrams;
        dbEntries.push({
          type: 'purchase',
          subType: receipt.transitMode,
          rawValue: receipt.weightKg,
          emissionsGrams: totalEmissions,
          processed: true,
          timestamp: Date.now(),
        });
        return Object.assign({}, receipt, { baseEmissions, totalEmissions });
      }
    );
  }

  /**
   * Asynchronously calculates emissions for every receipt.
   *
   * @param {Array<Object>} receipts List of raw receipt objects.
   * @returns {Promise<Object>} Object containing processedReceipts and dbEntries.
   */
  function calculateEmissionsForReceipts(receipts) {
    const dbEntries = [];
    const promises = receipts.map((r) => _processSingleReceipt(r, dbEntries));
    return Promise.all(promises).then(function (processedReceipts) {
      return { processedReceipts, dbEntries };
    });
  }

  /**
   * Saves a list of processed entries to IndexedDB store.
   *
   * @param {Array<Object>} dbEntries Sanitized behavior entries.
   * @returns {Promise<Array<number>>} Resolves to list of database keys.
   */
  function saveReceiptsToStore(dbEntries) {
    if (!global.EcoTrackDB) {
      return Promise.resolve([]);
    }
    return global.EcoTrackDB.writeBatch(dbEntries);
  }

  /**
   * Processes receipts using Web Worker to calculate emissions,
   * writes them to IndexedDB, and updates the UI.
   *
   * @returns {Promise<Array<Object>|void>}
   */
  function processAndSaveReceipts() {
    return calculateEmissionsForReceipts(MOCK_RECEIPTS).then(function ({
      processedReceipts,
      dbEntries,
    }) {
      return saveReceiptsToStore(dbEntries)
        .then(function () {
          renderReceiptCards(processedReceipts);
          jQuery(document).trigger('ecotrack:data-updated');

          const hasReturn = processedReceipts.some((r) => r.isReturn);
          if (hasReturn) {
            const surcharge = Constants.RETURN_LOGISTICS_SURCHARGE || 380;
            jQuery(document).trigger('ecotrack:trigger-nudge', {
              key: 'nudge.logistics_return',
              metric: `This return added ${surcharge}g CO₂`,
            });
          }
          return processedReceipts;
        })
        .catch(function (err) {
          console.error('[Logistics DB] Failed to save parsed receipts:', err);
          resetConnectionButton('Failed to save parsed receipts.');
        });
    });
  }

  /**
   * Generates return logistics alert HTML block.
   *
   * @param {Object} receipt The processed receipt with total emissions details.
   * @returns {string} The HTML string representing the return information block.
   */
  function generateReturnHtml(receipt) {
    if (!receipt.isReturn) {
      return '';
    }
    return `
      <div class="logistics-card__return">
        <span class="logistics-card__return-label">🔄 Return detected</span>
        <span class="logistics-card__return-surcharge">Reverse logistics CO₂: +${receipt.returnSurchargeGrams}g</span>
        <p class="logistics-card__tip">💡 Tip: Keep or donate instead → Save ${receipt.returnSurchargeGrams}g CO₂</p>
      </div>
    `;
  }

  /**
   * Generates receipt card outer container HTML block.
   *
   * @param {Object} receipt The processed receipt.
   * @param {string} returnHtml The HTML string of the return info block.
   * @param {Object} modeLabels Translation mode labels.
   * @returns {string} The card HTML structure.
   */
  function generateCardHtml(receipt, returnHtml, modeLabels) {
    const formatted = Utils.formatEmissions
      ? Utils.formatEmissions(receipt.totalEmissions)
      : `${receipt.totalEmissions.toLocaleString()}g CO₂`;
    return `
      <div class="card logistics-card mb-3" id="receipt-card-${receipt.id}">
        <div class="card-body">
          <h5 class="card-title logistics-card__merchant">📦 Order #${receipt.id} — ${receipt.merchant}</h5>
          <p class="card-text mb-1"><strong>Transit mode:</strong> ${modeLabels[receipt.transitMode] || receipt.transitMode}</p>
          <p class="card-text mb-1"><strong>Weight:</strong> ${receipt.weightKg.toFixed(1)} kg</p>
          <p class="card-text mb-3"><strong>Estimated CO₂:</strong> ${formatted}</p>
          ${returnHtml}
        </div>
      </div>
    `;
  }

  /**
   * Renders parsed e-commerce shipment details in the dashboard.
   *
   * @param {Array<Object>} receipts The processed receipts.
   * @returns {void}
   */
  function renderReceiptCards(receipts) {
    const $container = jQuery('#logistics-receipts-container');
    if ($container.length === 0) {
      return;
    }

    $container.empty();

    const modeLabels = {
      air_freight: '✈️ Air Freight (High Impact)',
      rail_freight: '🚂 Rail Wagon (Low Impact)',
      road_freight: '🚚 Road Delivery',
    };

    receipts.forEach(function (receipt) {
      const returnHtml = generateReturnHtml(receipt);
      const cardHtml = generateCardHtml(receipt, returnHtml, modeLabels);
      $container.append(cardHtml);
    });
  }

  /**
   * Initializes the logistics UI states on page load.
   *
   * @returns {void}
   */
  function initLogistics() {
    const isConnected = Preferences.isEmailConnected();
    if (isConnected) {
      jQuery('#email-consent').prop('checked', true);
      jQuery('#btn-connect-email')
        .removeClass('btn-primary')
        .addClass('btn-success')
        .text('Connected')
        .prop('disabled', true);
      processAndSaveReceipts();
    } else {
      jQuery('#email-consent').prop('checked', false);
      jQuery('#btn-connect-email').off('click').on('click', handleConnectEmail);
    }
  }

  // Bind init to DOM ready
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(initLogistics);
  }

  return {
    initLogistics,
    handleConnectEmail,
    processAndSaveReceipts,
    getMockReceipts: () => MOCK_RECEIPTS,
  };
})();

// Browser exposes the module on window; Node/Jest exposes it via module.exports.
// This block is identical across every module file — do not vary its shape.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoTrackLogistics;
} else {
  window.EcoTrackLogistics = EcoTrackLogistics;
}
