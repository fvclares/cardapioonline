/**
 * Gerador de Mensagem e Link Direto para WhatsApp (Módulo 07)
 * Compatível com file:// e http://
 */

const whatsappService = {
  // Formata a mensagem completa do pedido em texto Markdown para o WhatsApp
  formatOrderMessage(order) {
    const lines = [];
    const cs = window.customerService;

    // Cabeçalho do Pedido
    lines.push(`*NOVO PEDIDO ${order.orderNumber}*`);
    lines.push(`*${order.storeName}*`);
    lines.push(`────────────────────────`);
    lines.push(``);

    // Dados do Cliente
    lines.push(`*CLIENTE:* ${order.customer.name}`);
    lines.push(`*TELEFONE:* ${cs ? cs.formatPhone(order.customer.phone) : order.customer.phone}`);
    lines.push(``);

    // Itens do Pedido — um item por linha para facilitar leitura
    lines.push(`*ITENS DO PEDIDO:*`);
    order.items.forEach((item, index) => {
      const codigoStr = item.productCodigo ? `#${String(item.productCodigo).padStart(3,'0')} ` : '';
      const qty = item.quantity || 1;
      lines.push(`${qty}x *${codigoStr}${item.productName}*`);
      
      if (item.isOffer && item.offerGroups) {
        item.offerGroups.forEach(g=>{
          lines.push(`   - ${g.groupName}:`);
          g.items.forEach(it=>{
            lines.push(`     • ${it.name}${it.extra_price>0?` (+${cs?cs.formatCurrency(it.extra_price):'R$ '+it.extra_price})`:''}`);
          });
        });
        if(item.offerPrice) lines.push(`   - Preço combo: ${cs?cs.formatCurrency(item.offerPrice):'R$ '+item.offerPrice}${item.unitPrice>item.offerPrice?` + extras = ${cs?cs.formatCurrency(item.unitPrice - item.offerPrice):'R$ '+(item.unitPrice-item.offerPrice)}`:''}`);
      } else {
        if (item.crust && item.crust.name && item.crust.price > 0) {
          lines.push(`   - Borda: ${item.crust.name} (+ ${cs ? cs.formatCurrency(item.crust.price) : 'R$ ' + item.crust.price})`);
        }
        if (item.extras && item.extras.length > 0) {
          lines.push(`   - Extras:`);
          item.extras.forEach(e => {
            lines.push(`     • ${e.name} (+ ${cs ? cs.formatCurrency(e.price) : 'R$ ' + e.price})`);
          });
        }
      }

      if (item.observation) {
        lines.push(`   - Obs: _${item.observation}_`);
      }

      lines.push(`   Valor: ${cs ? cs.formatCurrency(item.itemTotal) : 'R$ ' + item.itemTotal}`);
      lines.push(``);
    });

    lines.push(`────────────────────────`);

    // Tipo de Atendimento & Endereço
    if (order.orderType === 'delivery') {
      const addr = order.deliveryAddress;
      lines.push(`*ENTREGA EM DOMICILIO:*`);
      if (addr && addr.street) {
        lines.push(`Rua: ${addr.street}, nº ${addr.number}`);
        if (addr.complement) lines.push(`Compl: ${addr.complement}`);
        lines.push(`Bairro: ${addr.neighborhood} - ${addr.city}`);
        if (addr.reference) lines.push(`Ref: ${addr.reference}`);
      } else {
        lines.push(`Endereco: nao informado (verificar com cliente)`);
      }
    } else {
      lines.push(`*RETIRADA NO BALCAO DA LOJA*`);
    }
    lines.push(``);

    // Forma de Pagamento
    lines.push(`*FORMA DE PAGAMENTO:*`);
    if (order.payment.method === 'pix') {
      lines.push(`• PIX (Chave solicitada no atendimento)`);
    } else if (order.payment.method === 'card') {
      lines.push(`• Cartão Débito/Crédito na Entrega (levar maquininha)`);
    } else if (order.payment.method === 'cash') {
      if (order.payment.cashChange) {
        lines.push(`• Dinheiro (Troco para ${cs ? cs.formatCurrency(order.payment.cashChange) : 'R$ ' + order.payment.cashChange})`);
      } else {
        lines.push(`• Dinheiro (Não precisa de troco)`);
      }
    }
    lines.push(``);

    // Resumo Financeiro
    lines.push(`*RESUMO DO PEDIDO:*`);
    lines.push(`Subtotal: ${cs ? cs.formatCurrency(order.subtotal) : 'R$ ' + order.subtotal}`);
    if (order.orderType === 'delivery') {
      lines.push(`Taxa de Entrega: ${cs ? cs.formatCurrency(order.deliveryFee) : 'R$ ' + order.deliveryFee}`);
    }
    lines.push(`*TOTAL A PAGAR: ${cs ? cs.formatCurrency(order.total) : 'R$ ' + order.total}*`);
    lines.push(`────────────────────────`);
    lines.push(`_Pedido gerado via ZapMenu_`);

    return lines.join('\n');
  },

  // Gera o link wa.me pronto com a mensagem codificada
  generateWhatsAppLink(order) {
    const rawMessage = this.formatOrderMessage(order);
    const encodedMessage = encodeURIComponent(rawMessage);
    
    // Higieniza o número da loja
    let storePhone = (order.storePhone || '5511999998888').replace(/\D/g, '');
    if (!storePhone.startsWith('55') && storePhone.length <= 11) {
      storePhone = '55' + storePhone;
    }

    return `https://wa.me/${storePhone}?text=${encodedMessage}`;
  },

  // Dispara a abertura do WhatsApp no navegador / app nativo
  openWhatsApp(order) {
    const link = this.generateWhatsAppLink(order);
    window.open(link, '_blank');
  }
};

window.whatsappService = whatsappService;
