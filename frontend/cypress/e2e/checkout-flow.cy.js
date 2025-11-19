/// <reference types="cypress" />

/**
 * Cypress E2E: signup -> add to cart -> checkout (skeleton)
 *
 * Set env vars before running:
 *  - CYPRESS_BASE_URL (CloudFront URL or local dev server)
 *  - CYPRESS_API_BASE_URL (API Gateway base URL for API verifications, optional)
 *  - CYPRESS_USERNAME / CYPRESS_PASSWORD (test user)
 */

describe('E2E: Signup → Add to Cart → Checkout', () => {
  const email = Cypress.env('username');
  const password = Cypress.env('password');

  it('Sign up (first run only) or Login', () => {
    // If your app merges signup + login or uses Hosted UI, adjust accordingly
    cy.visit('/');
    cy.contains(/sign in|log in|profile/i).then(($el) => {
      const txt = $el.text().toLowerCase();
      if (txt.includes('sign') || txt.includes('log')) {
        cy.login(email, password);
      } else {
        // already logged in or profile present
        cy.wrap(true).should('be.true');
      }
    });
  });

  it('Browse products and add to cart', () => {
    cy.visit('/');
    // Wait for product grid
    cy.get('[data-testid="product-card"]').should('exist');

    // Add first product to cart
    cy.get('[data-testid="product-card"]').first().within(() => {
      cy.contains('button', /add to cart/i).click();
    });

    // Open cart and verify item present
    cy.contains(/cart/i).click();
    cy.contains(/subtotal|total/i).should('exist');
  });

  it('Proceed to checkout and submit', () => {
    cy.contains(/checkout/i).click();

    // Fill shipping form (adjust selectors to match your UI)
    cy.get('input[name="street"]').type('1 Test St');
    cy.get('input[name="city"]').type('Testville');
    cy.get('input[name="state"]').type('CA');
    cy.get('input[name="zipCode"]').type('90001');

    // Payment method selection (if required)
    cy.get('select[name="paymentMethod"]').select('card');

    // Submit checkout
    cy.contains('button', /place order|pay|continue/i).click();

    // Expect success indicator (tweak to your UI)
    cy.contains(/order|processing|confirmation/i, { timeout: 20000 }).should('exist');
  });
});
