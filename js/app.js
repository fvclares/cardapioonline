/**
 * Controlador Principal do Cardápio Público (app.js)
 * Compatível com file:// e http://
 */

document.addEventListener('DOMContentLoaded', () => {
  const headerContainer = document.getElementById('headerContainer');
  const navContainer = document.getElementById('navContainer');
  const menuContainer = document.getElementById('menuContainer');

  let currentSearchQuery = '';

  // Inicializa os modais
  const productModal = window.setupProductModal ? window.setupProductModal() : null;
  const checkoutModal = window.setupCheckoutModal ? window.setupCheckoutModal() : null;
  const cartDrawer = window.setupCartDrawer ? window.setupCartDrawer(() => {
    if (checkoutModal) checkoutModal.openCheckout();
  }) : null;

  // Função central de renderização do cardápio
  function renderAll() {
    if (window.renderHeader) window.renderHeader(headerContainer);
    if (window.renderCategoryNav) {
      window.renderCategoryNav(navContainer, (query) => {
        currentSearchQuery = query;
        if (window.renderProductSections) {
          window.renderProductSections(menuContainer, currentSearchQuery, (product) => {
            if (productModal) productModal.openModal(product);
          });
        }
      });
    }
    if (window.renderProductSections) {
      window.renderProductSections(menuContainer, currentSearchQuery, (product) => {
        if (productModal) productModal.openModal(product);
      });
    }
  }

  // Primeira renderização
  renderAll();

  // Reage a atualizações de dados da loja
  if (window.appState) {
    window.appState.subscribe(() => {
      if (window.renderHeader) window.renderHeader(headerContainer);
    });
  }
});
