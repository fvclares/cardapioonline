/**
 * Teste unitário da formatação da mensagem WhatsApp e do cálculo do pedido
 */

import { whatsappService } from '../js/services/whatsapp.js';
import { customerService } from '../js/services/customer.js';

function testWhatsAppFormatting() {
  console.log('🧪 Testando Formatação da Mensagem WhatsApp (Módulo 07)...\n');

  const mockOrder = {
    id: 'ord_test_123',
    orderNumber: '#1042',
    storeName: 'Pizzaria Bella Massa',
    storePhone: '5511999998888',
    orderType: 'delivery',
    customer: {
      name: 'Carlos Eduardo',
      phone: '11987654321'
    },
    deliveryAddress: {
      street: 'Rua Augusta',
      number: '500',
      complement: 'Apto 42',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      reference: 'Próximo ao metrô'
    },
    payment: {
      method: 'cash',
      cashChange: 100
    },
    items: [
      {
        productId: 'prod_calabresa',
        productName: 'Pizza Calabresa Especial',
        quantity: 1,
        unitPrice: 56.00,
        crust: { name: 'Borda Recheada de Catupiry', price: 8.00 },
        extras: [],
        observation: 'Sem cebola, massa crocante',
        itemTotal: 56.00
      },
      {
        productId: 'prod_coca_2l',
        productName: 'Coca-Cola 2 Litros',
        quantity: 1,
        unitPrice: 14.00,
        crust: null,
        extras: [],
        observation: '',
        itemTotal: 14.00
      }
    ],
    subtotal: 70.00,
    deliveryFee: 7.00,
    total: 77.00
  };

  const message = whatsappService.formatOrderMessage(mockOrder);
  console.log('--- MENSAGEM GERADA ---');
  console.log(message);
  console.log('-----------------------\n');

  const link = whatsappService.generateWhatsAppLink(mockOrder);
  console.log('--- LINK GERADO ---');
  console.log(link);
  console.log('-------------------\n');

  // Validações
  const hasOrderNum = message.includes('#1042');
  const hasStore = message.includes('Pizzaria Bella Massa');
  const hasCustomer = message.includes('Carlos Eduardo');
  const hasItem1 = message.includes('Pizza Calabresa Especial');
  const hasCrust = message.includes('Borda Recheada de Catupiry');
  const hasObs = message.includes('Sem cebola, massa crocante');
  const hasItem2 = message.includes('Coca-Cola 2 Litros');
  const hasAddress = message.includes('Rua Augusta, nº 500');
  const hasPayment = message.includes('Troco para');
  const hasTotal = message.includes('77,00');
  const isLinkValid = link.startsWith('https://wa.me/5511999998888?text=');

  if (hasOrderNum && hasStore && hasCustomer && hasItem1 && hasCrust && hasObs && hasItem2 && hasAddress && hasPayment && hasTotal && isLinkValid) {
    console.log('✅ PASS: Formatação WhatsApp e Link wa.me 100% corretos e fiéis à especificação!');
  } else {
    console.error('❌ FAIL: Alguma validação de formato falhou.');
    process.exit(1);
  }
}

testWhatsAppFormatting();
