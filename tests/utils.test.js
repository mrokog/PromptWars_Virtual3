const jQuery = require('jquery');
global.jQuery = jQuery;
global.$ = jQuery;

const Utils = require('../js/utils.js');

describe('utils.js Shared Utilities', () => {
  describe('clamp', () => {
    test('clamps value within range', () => {
      expect(Utils.clamp(5, 1, 10)).toBe(5);
      expect(Utils.clamp(-5, 1, 10)).toBe(1);
      expect(Utils.clamp(15, 1, 10)).toBe(10);
    });
  });

  describe('formatEmissions', () => {
    test('formats grams correctly', () => {
      expect(Utils.formatEmissions(500)).toBe('500g CO₂ (≈ 2.8 km of car travel)');
      expect(Utils.formatEmissions(1500)).toBe('1,500g CO₂ (≈ 8.3 km of car travel)');
      expect(Utils.formatEmissions(0)).toBe('0g CO₂ (≈ 0.0 km of car travel)');
    });
  });

  describe('toRelatableComparison', () => {
    test('returns correct relatable carbon diet comparison string', () => {
      expect(Utils.toRelatableComparison(200)).toContain('km of car travel');
      expect(Utils.toRelatableComparison(150000)).toContain('km of car travel');
      expect(Utils.toRelatableComparison(0)).toBe('≈ 0.0 km of car travel');
    });
  });

  describe('safeAjax', () => {
    let ajaxMock;

    beforeEach(() => {
      ajaxMock = jest.fn();
      jQuery.ajax = ajaxMock;
    });

    test('calls jQuery.ajax when online', () => {
      const successCb = jest.fn();
      const failCb = jest.fn();
      const options = { url: '/api/test', method: 'GET' };

      ajaxMock.mockReturnValue({
        done: jest.fn().mockImplementation((cb) => { cb({ data: 'ok' }); return { fail: jest.fn() }; })
      });

      Utils.safeAjax(options, successCb, failCb);
      expect(ajaxMock).toHaveBeenCalledWith(options);
    });

    test('falls back to error handler on network fail', () => {
      const successCb = jest.fn();
      const failCb = jest.fn();
      const options = { url: '/api/test', method: 'GET' };

      ajaxMock.mockReturnValue({
        done: jest.fn().mockReturnValue({
          fail: jest.fn().mockImplementation((cb) => { cb('error'); })
        })
      });

      Utils.safeAjax(options, successCb, failCb);
      expect(failCb).toHaveBeenCalled();
    });
  });

  describe('safeGetJSON', () => {
    let getJSONMock;

    beforeEach(() => {
      getJSONMock = jest.fn();
      jQuery.getJSON = getJSONMock;
    });

    test('fetches JSON successfully', async () => {
      const successCb = jest.fn();
      const failCb = jest.fn();

      getJSONMock.mockReturnValue({
        done: jest.fn().mockImplementation((cb) => { cb({ hello: 'world' }); return { fail: jest.fn() }; })
      });

      Utils.safeGetJSON('/lang/en.json', successCb, failCb);
      expect(getJSONMock).toHaveBeenCalledWith('/lang/en.json');
    });
  });
});
