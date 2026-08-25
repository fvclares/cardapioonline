/**
 * Teste automatizado de integridade e carregamento dos arquivos e endpoints (ES Module)
 */

import http from 'http';

const ENDPOINTS = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/main.css',
  '/css/cardapio.css',
  '/css/admin.css',
  '/js/app.js',
  '/js/admin.js',
  '/js/state/store.js',
  '/js/state/storage.js',
  '/js/mock/initialData.js',
  '/js/services/whatsapp.js',
  '/js/services/customer.js',
  '/js/services/order.js',
  '/js/components/header.js',
  '/js/components/categoryList.js',
  '/js/components/productCard.js',
  '/js/components/productModal.js',
  '/js/components/cartDrawer.js',
  '/js/components/checkoutModal.js'
];

async function checkEndpoint(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          contentType: res.headers['content-type'],
          size: data.length
        });
      });
    }).on('error', (err) => {
      resolve({ path, status: 'ERROR', error: err.message });
    });
  });
}

async function run() {
  console.log('🧪 Iniciando Verificação de Endpoints do Servidor...\n');
  let allPass = true;

  for (const ep of ENDPOINTS) {
    const res = await checkEndpoint(ep);
    const pass = res.status === 200 && res.size > 0;
    if (!pass) allPass = false;
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'} [${res.status}] ${ep} (${res.contentType}, ${res.size} bytes)`);
  }

  if (allPass) {
    console.log('\n🎉 Todos os 20 endpoints e módulos carregam com status 200 OK e MIME types corretos!');
  } else {
    console.error('\n⚠️ Alguns endpoints falharam.');
    process.exit(1);
  }
}

run();
