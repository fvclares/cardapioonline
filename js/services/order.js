/**
 * Motor de Pedidos & Criação de Snapshot Imutável
 * Compatível com file:// e http://
 */

const orderService = {
  // Gera identificador sequencial (evita NaN quando storage é assíncrono)
  generateOrderNumber() {
    try {
      const existing = window.storage?.getOrders();
      if (Array.isArray(existing)) return '#' + (1040 + existing.length + 1);
      // storage assíncrono (Supabase) -> usa contador local
      const local = JSON.parse(localStorage.getItem('cardapio_orders') || '[]');
      if (Array.isArray(local) && local.length) return '#' + (1040 + local.length + 1);
    } catch {}
    return '#' + Date.now().toString().slice(-6);
  },

  // Cria um snapshot completo e congelado do pedido
  createOrderSnapshot({ customer, address, paymentMethod, cashChange, notes }) {
    const store = window.appState.store;
    const items = window.appState.cart.items;
    const orderType = window.appState.cart.orderType;
    const subtotal = window.appState.getSubtotal();
    const deliveryFee = window.appState.getDeliveryFee();
    const total = window.appState.getTotal();

    const orderNumber = this.generateOrderNumber();
    const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    // Congela itens com nomes e preços exatos no momento da compra (Módulo 06)
    const itemsSnapshot = items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productCodigo: item.originalProduct?.codigo || item.codigo || null,
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      crust: item.crust ? { ...item.crust } : null,
      extras: item.extras ? item.extras.map(e => ({ ...e })) : [],
      observation: item.observation || '',
      itemTotal: Number(item.itemTotal)
    }));

    const orderSnapshot = {
      id: orderId,
      orderNumber,
      storeId: store.id,
      storeName: store.name,
      storePhone: store.phone,
      orderType, // 'delivery' | 'pickup'
      customer: {
        token: customer.token,
        name: customer.name,
        phone: customer.phone
      },
      deliveryAddress: orderType === 'delivery' && address ? {
        street: address.street,
        number: address.number,
        complement: address.complement || '',
        neighborhood: address.neighborhood,
        city: address.city,
        reference: address.reference || ''
      } : null,
      payment: {
        method: paymentMethod, // 'pix' | 'card' | 'cash'
        cashChange: paymentMethod === 'cash' ? cashChange : null
      },
      items: itemsSnapshot,
      subtotal,
      deliveryFee,
      total,
      notes: (notes || '').trim(),
      status: 'enviado_whatsapp',
      createdAt: new Date().toISOString()
    };

    // Salva no histórico de pedidos
    window.storage?.saveOrder(orderSnapshot);

    return orderSnapshot;
  },

  // Histórico de pedidos
  getOrders() {
    return window.storage?.getOrders() || [];
  },

  getLastOrder() {
    return window.storage?.getLastOrder() || null;
  }
};

window.orderService = orderService;
