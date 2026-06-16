const { axe, toHaveNoViolations } = require('jest-axe');
const fs = require('fs');
const path = require('path');
const jQuery = require('jquery');

global.jQuery = jQuery;
global.$ = jQuery;
expect.extend(toHaveNoViolations);

describe('Accessibility & WCAG 2.1 Compliance', () => {
  let htmlContent;

  beforeAll(() => {
    // Read the template index.html file to mount in tests
    const filePath = path.join(__dirname, '../index.html');
    htmlContent = fs.readFileSync(filePath, 'utf8');
  });

  beforeEach(() => {
    document.body.innerHTML = htmlContent;
  });

  test('All four main views run through axe-core with zero violations', async () => {
    const views = ['#dashboard', '#logistics', '#digital', '#settings'];

    for (const viewId of views) {
      const element = document.querySelector(viewId);
      expect(element).not.toBeNull();
      
      // Run accessibility audit using axe-core
      const results = await axe(element);
      expect(results).toHaveNoViolations();
    }
  });

  test('All images in index.html have alt attributes (empty permitted for decorative)', () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      expect(img.hasAttribute('alt')).toBe(true);
    });
  });

  test('All form controls (select, input) have associated labels', () => {
    // All inputs/selects/textareas must either have a label with 'for' matching their id,
    // or be wrapped inside a label, or have an aria-label/aria-labelledby attribute.
    const controls = document.querySelectorAll('input, select, textarea');
    
    controls.forEach(control => {
      // If it is a hidden input, skip label check
      if (control.getAttribute('type') === 'hidden') return;

      const id = control.getAttribute('id');
      const hasLabelFor = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
      const isWrapped = control.closest('label') !== null;
      const hasAriaLabel = control.hasAttribute('aria-label') || control.hasAttribute('aria-labelledby');

      expect(hasLabelFor || isWrapped || hasAriaLabel).toBe(true);
    });
  });

  test('aria-live regions exist on nudge container and carbon meter', () => {
    const nudgeContainer = document.querySelector('#nudge-container');
    expect(nudgeContainer).not.toBeNull();
    expect(nudgeContainer.getAttribute('aria-live')).toBe('polite');

    const carbonMeterFill = document.querySelector('#carbon-meter-fill');
    expect(carbonMeterFill).not.toBeNull();
    expect(carbonMeterFill.getAttribute('role')).toBe('progressbar');
    
    // The meter container itself is also a region that could change
    // Let's verify aria attributes are present
    expect(carbonMeterFill.hasAttribute('aria-valuenow')).toBe(true);
    expect(carbonMeterFill.hasAttribute('aria-valuemin')).toBe(true);
    expect(carbonMeterFill.hasAttribute('aria-valuemax')).toBe(true);
  });
});
