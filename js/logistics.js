(function(global) {
  'use strict';

  // Mock receipt data representing parsed email headers
  const MOCK_RECEIPTS = [
    {
      id: 'FKT-9831',
      merchant: 'Flipkart',
      subject: 'Your Flipkart order FKT-9831 has been delivered',
      weightKg: 2,
      transitMode: 'air_freight', // 600 gCO2/kg
      isReturn: true,
      returnSurchargeGrams: 380, // Surcharge for reverse logistics
      date: 'June 14, 2026'
    },
    {
      id: 'AMZ-4322',
      merchant: 'Amazon India',
      subject: 'Order confirmation: AMZ-4322',
      weightKg: 5,
      transitMode: 'road_freight', // 120 gCO2/kg
      isReturn: false,
      returnSurchargeGrams: 0,
      date: 'June 15, 2026'
    },
    {
      id: 'MYN-0987',
      merchant: 'Myntra',
      subject: 'Shipment delivered for order MYN-0987',
      weightKg: 3,
      transitMode: 'rail_freight', // 25 gCO2/kg
      isReturn: false,
      returnSurchargeGrams: 0,
      date: 'June 16, 2026'
    }
  ];

  /**
   * Triggers the logistics email parsing simulation.
   * Performs client-side OAuth validation and requires explicit consent.
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

    // Simulate Server OAuth authorization and JWT token exchange
    jQuery('#btn-connect-email').prop('disabled', true).text('Connecting via OAuth...');

    jQuery.ajax({
      url: '/api/oauth/email',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ consent: true })
    }).done(function(response) {
      if (response.success) {
        localStorage.setItem('ecotrack_email_connected', 'true');
        jQuery('#btn-connect-email').removeClass('btn-primary').addClass('btn-success').text('Connected');
        // Render receipts
        processAndSaveReceipts();
      } else {
        resetConnectionButton('OAuth connection failed.');
      }
    }).fail(function() {
      resetConnectionButton('Could not connect to server.');
    });
  }

  function resetConnectionButton(errMsg) {
    jQuery('#logistics-error').text(errMsg).show().attr('role', 'alert');
    jQuery('#btn-connect-email').prop('disabled', false).text('Connect Email');
  }

  /**
   * Processes receipts using Web Worker to calculate emissions,
   * writes them to IndexedDB, and updates the UI.
   * @returns {Promise<Array<Object>|void>}
   */
  function processAndSaveReceipts() {
    if (!global.EcoTrackWorker || !global.EcoTrackDB) return Promise.resolve();

    const dbEntries = [];
    const promises = MOCK_RECEIPTS.map(function(receipt) {
      return global.EcoTrackWorker.calculate('purchase', receipt.transitMode, receipt.weightKg)
        .then(function(baseEmissions) {
          const totalEmissions = baseEmissions + receipt.returnSurchargeGrams;
          
          // Prepare DB record (PII excluded - no merchant names, raw order numbers)
          dbEntries.push({
            type: 'purchase',
            rawValue: receipt.weightKg, // kg
            emissionsGrams: totalEmissions,
            processed: true,
            timestamp: Date.now()
          });

          return {
            ...receipt,
            baseEmissions,
            totalEmissions
          };
        });
    });

    return Promise.all(promises).then(function(processedReceipts) {
      // Save all in a batch transaction
      return global.EcoTrackDB.addBehaviorEntriesBatch(dbEntries)
        .then(function() {
          renderReceiptCards(processedReceipts);
          // Refresh main dashboard stats
          jQuery(document).trigger('ecotrack:data-updated');

          // Trigger a logistics return nudge if any returned items exist
          const hasReturn = processedReceipts.some(r => r.isReturn);
          if (hasReturn && global.EcoTrackNudge) {
            // Queue return nudge
            global.EcoTrackNudge.triggerNudge('nudge.logistics_return', 'This return added 380g CO₂');
          }
          return processedReceipts;
        })
        .catch(function(err) {
          console.error('[Logistics DB] Failed to save parsed receipts:', err);
        });
    });
  }

  /**
   * Renders parsed e-commerce shipment details in the dashboard.
   * @param {Array<Object>} receipts The processed receipts.
   */
  function renderReceiptCards(receipts) {
    const $container = jQuery('#logistics-receipts-container');
    if ($container.length === 0) return;

    $container.empty();

    const modeLabels = {
      air_freight: '✈️ Air Freight (High Impact)',
      rail_freight: '🚂 Rail Wagon (Low Impact)',
      road_freight: '🚚 Road Delivery'
    };

    receipts.forEach(function(receipt) {
      let returnHtml = '';
      if (receipt.isReturn) {
        returnHtml = `
          <div class="logistics-card__return">
            <span class="logistics-card__return-label">🔄 Return detected</span>
            <span class="logistics-card__return-surcharge">Reverse logistics CO₂: +${receipt.returnSurchargeGrams}g</span>
            <p class="logistics-card__tip">💡 Tip: Keep or donate instead → Save ${receipt.returnSurchargeGrams}g CO₂</p>
          </div>
        `;
      }

      const cardHtml = `
        <div class="card logistics-card mb-3" id="receipt-card-${receipt.id}">
          <div class="card-body">
            <h5 class="card-title logistics-card__merchant">📦 Order #${receipt.id} — ${receipt.merchant}</h5>
            <p class="card-text mb-1"><strong>Transit mode:</strong> ${modeLabels[receipt.transitMode]}</p>
            <p class="card-text mb-1"><strong>Weight:</strong> ${receipt.weightKg.toFixed(1)} kg</p>
            <p class="card-text mb-3"><strong>Estimated CO₂:</strong> ${receipt.totalEmissions.toLocaleString()}g</p>
            ${returnHtml}
          </div>
        </div>
      `;

      $container.append(cardHtml);
    });
  }

  /**
   * Initializes the logistics UI states on page load.
   */
  function initLogistics() {
    const isConnected = localStorage.getItem('ecotrack_email_connected') === 'true';
    if (isConnected) {
      jQuery('#email-consent').prop('checked', true);
      jQuery('#btn-connect-email').removeClass('btn-primary').addClass('btn-success').text('Connected').prop('disabled', true);
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

  const LogisticsModule = {
    initLogistics,
    handleConnectEmail,
    processAndSaveReceipts,
    getMockReceipts: () => MOCK_RECEIPTS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogisticsModule;
  } else {
    global.EcoTrackLogistics = LogisticsModule;
  }
})(typeof window !== 'undefined' ? window : this);
