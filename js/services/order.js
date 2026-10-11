/**
 * Motor de Pedidos & Criação de Snapshot Imutável
 * Compatível com file:// e http://
 */

const orderService = {
  // Cria um snapshot completo e congelado do pedido
  async createOrderSnapshot({ customer, address, paymentMethod, cashChange, notes }) {
    const store = window.appState.store;
    const items = window.appState.cart.items;
    const orderType = window.appState.cart.orderType;
    const subtotal = window.appState.getSubtotal();
    const feePending = orderType === 'delivery' && window.appState.isDeliveryFeeByStore && window.appState.isDeliveryFeeByStore();
    const deliveryFee = feePending ? 0 : window.appState.getDeliveryFee();
    const total = window.appState.getTotal();

    const orderNumber = null;
    const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    // Congela itens com nomes e preços exatos no momento da compra (Módulo 06) — inclui ofertas
    const itemsSnapshot = items.map(item => ({
      productId: item.productId,
      size: item.size || null,
      flavorIds: item.flavorIds || [],
      fractionValue: item.fractionValue ?? 1,
      productName: item.productName,
      productCodigo: item.originalProduct?.codigo || item.codigo || null,
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      crust: item.crust ? { ...item.crust } : null,
      extras: item.extras ? item.extras.map(e => ({ ...e })) : [],
      observation: item.observation || '',
      isOffer: !!item.isOffer,
      offerId: item.offerId || null,
      offerGroups: item.offerGroups ? JSON.parse(JSON.stringify(item.offerGroups)) : null,
      offerPrice: item.offerPrice != null ? Number(item.offerPrice) : null,
      itemTotal: Number(item.itemTotal)
    }));

    const fingerprint=JSON.stringify([itemsSnapshot,customer,address,paymentMethod,cashChange,notes,window.appState.cart.neighborhood?.id]);
    if(window.appState.checkoutFingerprint!==fingerprint){
      window.appState.checkoutRequestId=crypto.randomUUID();
      window.appState.checkoutFingerprint=fingerprint;
    }

    const orderSnapshot = {
      id: orderId,
      requestId: window.appState.checkoutRequestId || (window.appState.checkoutRequestId=crypto.randomUUID()),
      neighborhoodId: window.appState.cart.neighborhood?.id || null,
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
      deliveryFeePending: !!feePending,
      total,
      notes: (notes || '').trim(),
      status: 'enviado_whatsapp',
      createdAt: new Date().toISOString()
    };

    // Salva no histórico de pedidos
    const saved=await window.storage.saveOrder(orderSnapshot);

    return saved;
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
