const fs = require('fs');
const path = require('path');

// Set up jQuery and JSDOM global environment
const jQuery = require('jquery');
global.jQuery = jQuery;
global.$ = jQuery;

// Import translation JSON files directly to test schemas
const enJson = require('../lang/en.json');
const hiJson = require('../lang/hi.json');
const bnJson = require('../lang/bn.json');
const mrJson = require('../lang/mr.json');
const taJson = require('../lang/ta.json');

const langMocks = { en: enJson, hi: hiJson, bn: bnJson, mr: mrJson, ta: taJson };

// Mock jQuery.getJSON to load mock files synchronously
jQuery.getJSON = jest.fn().mockImplementation((url) => {
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  const lang = filename.split('.')[0];

  if (langMocks[lang]) {
    const d = jQuery.Deferred();
    d.resolve(langMocks[lang]);
    return d.promise();
  } else {
    const d = jQuery.Deferred();
    d.reject({}, 'error', 'File not found');
    return d.promise();
  }
});

// Import code under test
const I18n = require('../js/i18n.js');

describe('i18n.js Localization Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
    
    // Reset JSDOM body
    document.body.innerHTML = `
      <select id="lang-select" aria-label="Select language">
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
        <option value="bn">বাংলা</option>
        <option value="mr">मराठी</option>
        <option value="ta">தமிழ்</option>
      </select>
      <span id="nav-dashboard" data-i18n="nav.dashboard">Dashboard</span>
      <span id="nav-logistics" data-i18n="nav.logistics">Logistics Tracker</span>
      <span id="onboarding-title" data-i18n="onboarding.title">Welcome</span>
    `;
  });

  test('All 5 lang JSON files parse without schema errors', () => {
    const requiredKeys = ['nav', 'onboarding', 'nudge', 'modules', 'accessibility'];
    
    [enJson, hiJson, bnJson, mrJson, taJson].forEach((langData) => {
      expect(langData).toBeDefined();
      requiredKeys.forEach((key) => {
        expect(langData[key]).toBeDefined();
        expect(typeof langData[key]).toBe('object');
      });
    });
  });

  test("loadLanguage('hi') populates [data-i18n] elements with Hindi strings", (done) => {
    I18n.loadLanguage('hi').done(() => {
      expect(jQuery('#nav-dashboard').text()).toBe(hiJson.nav.dashboard);
      expect(jQuery('#onboarding-title').text()).toBe(hiJson.onboarding.title);
      done();
    });
  });

  test("loadLanguage('ta') sets html[lang=\"ta\"]", (done) => {
    I18n.loadLanguage('ta').done(() => {
      expect(document.documentElement.getAttribute('lang')).toBe('ta');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      done();
    });
  });

  test("loadLanguage('xx') (invalid code) falls back to English without throwing", (done) => {
    I18n.loadLanguage('xx').done(() => {
      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(jQuery('#nav-dashboard').text()).toBe(enJson.nav.dashboard);
      done();
    });
  });

  test('Language preference persists in localStorage across simulated reloads', (done) => {
    I18n.loadLanguage('bn').done(() => {
      expect(localStorage.getItem('ecotrack_lang')).toBe('bn');
      
      // Simulate reload
      document.documentElement.removeAttribute('lang');
      I18n.initLanguage();
      
      // Since initLanguage calls loadLanguage internally (async), wait a tiny bit
      setTimeout(() => {
        expect(document.documentElement.getAttribute('lang')).toBe('bn');
        done();
      }, 10);
    });
  });
});
