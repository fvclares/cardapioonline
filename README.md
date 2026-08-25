# 🍕 Cardápio Online + WhatsApp (MVP)

Um sistema completo, leve e ultra-rápido de **Cardápio Digital para Pizzarias e Restaurantes com envio direto do pedido formatado para o WhatsApp da loja via links `wa.me`**.

Zero atrito para o cliente (sem necessidade de senhas ou cadastros complexos) e gestão completa para a pizzaria.

---

## ⚡ Como Rodar

O projeto possui um servidor HTTP integrado embutido em Node.js (sem necessidade de dependências externas pesadas):

```bash
# Iniciar o servidor local
npm start
# ou
node server.js
```

### Acessos Rápidos no Navegador:
- **📱 Cardápio Público do Cliente:** [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **⚙️ Painel de Gestão da Pizzaria (Admin):** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

Para rodar os testes automatizados:
```bash
npm test
```

---

## 📁 Estrutura do Projeto

```text
Cardápios/
├── index.html                  # Cardápio Público do Cliente
├── admin.html                  # Painel de Gestão da Pizzaria (Admin)
├── server.js                   # Servidor HTTP local (zero dependências)
├── package.json                # Scripts e configurações do projeto
├── css/
│   ├── main.css                # Design system base, tipografia, resets e variáveis
│   ├── cardapio.css            # Estilos do cardápio público, carrinho e modais
│   └── admin.css               # Estilos do painel de administração
├── js/
│   ├── app.js                  # Inicialização e orquestração do cardápio público
│   ├── admin.js                # Lógica do painel de administração (CRUD)
│   ├── state/
│   │   ├── store.js            # Gerenciamento de estado reativo (carrinho, loja, cliente)
│   │   └── storage.js          # Adaptador de persistência (LocalStorage com In-Memory Fallback)
│   ├── services/
│   │   ├── whatsapp.js         # Formatador de Markdown do WhatsApp e construtor wa.me
│   │   ├── customer.js         # Identificação sem senha e gestão de endereços
│   │   └── order.js            # Snapshot imutável de itens, preços e histórico
│   ├── components/
│   │   ├── header.js           # Cabeçalho da loja, status Aberto/Fechado e boas-vindas
│   │   ├── categoryList.js     # Barra de categorias com rolagem e busca em tempo real
│   │   ├── productCard.js      # Grade de produtos por categoria
│   │   ├── productModal.js     # Modal de personalização (bordas, adicionais e observações)
│   │   ├── cartDrawer.js       # Gaveta da sacola, forma de pagamento e taxas
│   │   └── checkoutModal.js    # Identificação rápida, endereço e envio para o WhatsApp
│   └── mock/
│       └── initialData.js      # Dados iniciais realistas (Pizzaria Bella Massa)
└── tests/
    ├── verify_endpoints.js     # Teste automatizado de status 200 e MIME types
    └── verify_whatsapp_logic.js# Teste unitário do gerador de mensagem do WhatsApp
```

---

## 🛠️ Tecnologias
- **Frontend:** HTML5 semântico, CSS3 Moderno (Custom Properties, Glassmorphism, CSS Grid/Flexbox), Vanilla JavaScript (ES Modules nativos).
- **Backend:** Node.js HTTP Server nativo (pronto para exportação estática na Vercel/Cloudflare ou conexão com Supabase).
- **Integração WhatsApp:** Protocolo padrão `https://wa.me/PHONE?text=MENSAGEM`.
