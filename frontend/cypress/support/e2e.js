// You can add custom commands and Cypress configuration here
// e.g., Cypress.Commands.add('login', ...)

Cypress.Commands.add('signup', (email, password) => {
  // Adjust selectors to match your UI
  cy.visit('/signup');
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.get('input[name="confirmPassword"]').type(password);
  cy.contains('button', /sign up/i).click();
});

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login');
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.contains('button', /sign in|log in/i).click();
});

Cypress.Commands.add('addToCartByName', (name) => {
  cy.contains('[data-testid="product-card"]', name)
    .within(() => {
      cy.contains('button', /add to cart/i).click();
    });
});
