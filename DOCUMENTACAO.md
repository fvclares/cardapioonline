# 🍕 Documentação Técnica & Operacional — Cardápio Online + WhatsApp (MVP)

> **Versão:** 2.1.0  
> **Status:** MVP Completo e Funcional  
> **Stack:** HTML5, CSS3 Moderno (Vanilla), JavaScript Universal (ES5/ES6 compatível), Node.js (Servidor Zero-Dependencies opcional)  
> **Compatibilidade:** Funciona 100% via duplo-clique no Windows (`file://`) e via servidor web (`http://`).

---

## 📌 1. Visão Geral do Produto

O **Cardápio Online + WhatsApp** é uma solução de delivery direto com foco em **zero atrito**, permitindo que restaurantes e pizzarias divulguem um link exclusivo em suas redes sociais e WhatsApp.

O cliente acessa o cardápio no celular, monta sua pizza (inclusive com meio a meio, bordas e adicionais), informa o endereço uma única vez e o sistema gera automaticamente a mensagem formatada para o WhatsApp da loja via link `wa.me`.

```text
┌────────────────────────┐
│  PAINEL DA PIZZARIA    │
│  (Gestão do Cardápio)  │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ LINK EXCLUSIVO DA LOJA │ (Ex: Instagram / WhatsApp Bio)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│   CARDÁPIO PÚBLICO     │ • 8 Categorias & +30 Itens
│   (Mobile-First)       │ • Tamanhos (Média, Grande, Gigante)
└───────────┬────────────┘ • Meio a Meio (2 Sabores) & Bordas
            │
            ▼
┌────────────────────────┐
│   SACOLA & ENTREGA     │ • Identificação sem senha (customer_token)
│                        │ • Múltiplos endereços salvos
└───────────┬────────────┘ • PIX, Cartão ou Dinheiro com troco
            │
            ▼
┌────────────────────────┐
│   LINK DIRETO WA.ME    │ • Mensagem estruturada em Markdown
│                        │ • Abertura com 1 toque no WhatsApp
└────────────────────────┘
```

---

## 📁 2. Estrutura de Arquivos do Projeto

```text
Cardápios/
├── index.html                  # Interface pública do cardápio para o cliente final
├── admin.html                  # Painel de controle do lojista (Pizzaria)
├── server.js                   # Servidor HTTP local nativo (Zero dependências)
├── package.json                # Metadados e scripts de execução e teste
├── README.md                   # Guia de início rápido
├── DOCUMENTACAO.md             # Esta documentação completa
│
├── css/
│   ├── main.css                # Design System global, variáveis, tipografia e resets
│   ├── cardapio.css            # Estilos da visão do cliente, modais, sacola e animações
│   └── admin.css               # Estilos do painel de administração da pizzaria
│
├── js/
│   ├── app.js                  # Orquestrador do cardápio público
│   ├── admin.js                # Lógica do painel de administração (CRUD)
│   │
│   ├── state/
│   │   ├── storage.js          # Persistência (LocalStorage + Fallback + Sync de versão)
│   │   └── store.js            # Estado reativo da sacola, loja e cliente (appState)
│   │
│   ├── services/
│   │   ├── customer.js         # Reconhecimento por token, formatação e endereços
│   │   ├── order.js            # Congelamento de preços/itens (Snapshot) e histórico
│   │   └── whatsapp.js         # Formatador de Markdown e gerador do link wa.me
│   │
│   ├── components/
│   │   ├── header.js           # Banner, logo, status Aberto/Fechado e boas-vindas
│   │   ├── categoryList.js     # Barra de categorias deslizante com busca em tempo real
│   │   ├── productCard.js      # Grade de produtos por categoria
│   │   ├── productModal.js     # Modal de personalização (Tamanho, Meio a Meio, Bordas, Extras)
│   │   ├── cartDrawer.js       # Gaveta da sacola, seleção de entrega/retirada e pagamento
│   │   └── checkoutModal.js    # Identificação rápida, endereço e confirmação pós-pedido
│   │
│   └── mock/
│       └── initialData.js      # Base de dados inicial da Pizzaria Bella Massa
│
└── tests/
    ├── verify_endpoints.js     # Teste de integridade de rotas e MIME types
    └── verify_whatsapp_logic.js# Teste unitário de formatação de mensagem WhatsApp
```

---

## ⚙️ 3. Detalhamento dos 8 Módulos do Pipeline

### 01 — Estrutura & Design System Gastronômico
- **Tipografia:** Google Font *Plus Jakarta Sans*.
- **Paleta Visual:** Fundo escuro premium (`#0e1117`, `#171b24`), detalhes em terracota (`#ff4722`), dourado (`#ffb800`) e verde WhatsApp (`#25d366`).
- **Arquitetura Universal:** Todos os arquivos JavaScript são executáveis tanto sob `file://` (duplo clique no Windows) quanto em servidores web `http://` sem erros de CORS.

### 02 — Identidade da Loja & Configurações
- **Status em Tempo Real:** Badge pulsante `Aberto Agora` ou aviso informativo `Fechado no Momento`.
- **Informações Exibidas:** Nome da loja, WhatsApp de atendimento, endereço físico, horário de funcionamento e valor do pedido mínimo.

### 03 — Catálogo de Produtos & Motor de Customização
- **Categorias Deslizantes:** Barra de navegação fixa (Sticky nav) com rolagem suave até a seção correspondente.
- **Busca em Tempo Real:** Filtro instantâneo por nome ou ingredientes.
- **Personalização Completa de Pizzas:**
  - 📏 **Tamanhos:** Média (6 fatias • -R$ 6,00), Grande (8 fatias • Padrão) e Família/Gigante (12 fatias • +R$ 14,00).
  - 🍕 **Pizza Meio a Meio:** Permite selecionar um 2º sabor da lista de pizzas disponíveis. O cálculo base é feito pelo maior valor entre os dois sabores.
  - 🧀 **Bordas Recheadas:** Catupiry, Cheddar, Chocolate, Doce de Leite e Vulcão de Catupiry com Bacon.
  - 🥓 **Adicionais Extras:** Bacon em cubos, Mussarela extra, Parmesão ralado, Alho frito, Tomate seco, etc.
  - 💬 **Observações do Item:** Campo aberto para pedidos especiais ("Sem cebola", "Massa bem dourada").

### 04 — Motor do Carrinho & Cálculos Financeiros
- **Barra Flutuante:** Exibe quantidade de itens e valor acumulado sempre visível na parte inferior da tela.
- **Gaveta da Sacola (Cart Drawer):**
  - Controle de quantidade (`+` / `-`) e remoção de itens.
  - Alternância entre **🛵 Entrega em Casa** e **🏪 Retirar no Balcão**.
  - Cálculo dinâmico da taxa de entrega por bairro.
  - Seleção da forma de pagamento (**PIX**, **Cartão na Entrega** ou **Dinheiro com campo para informar troco**).
  - Verificação de valor mínimo de pedido.

### 05 — Identificação Sem Senha (`customer_token`)
- Gera um identificador único persistente no navegador do cliente (`customer_token`).
- O cliente informa apenas **Nome** e **WhatsApp** (com máscara automática `(11) 99999-9999`).
- **Múltiplos Endereços:** Salva os endereços utilizados (Rua, Número, Bairro, Complemento, Referência) para que em compras futuras o cliente apenas clique no endereço desejado.

### 06 — Snapshot Imutável do Pedido
- Ao finalizar a compra, o sistema gera uma **cópia congelada (Snapshot)** com o nome, tamanho, sabores, adicionais e preço unitário vigentes naquele instante.
- Gera número sequencial de pedido (ex: `#1042`).
- Protege o histórico contra futuras alterações de preços feitas pelo lojista.

### 07 — Gerador de Mensagem WhatsApp
- Constrói uma mensagem padronizada em Markdown com emojis:

```text
🍕 *NOVO PEDIDO #1042*
📍 *Pizzaria Bella Massa*
────────────────────────

👤 *CLIENTE:* Carlos Eduardo
📱 *TELEFONE:* (11) 98765-4321

📋 *ITENS DO PEDIDO:*
1x *Pizza ½ Calabresa Especial + ½ Frango com Catupiry [Grande]*
   └ Borda: Borda Recheada de Catupiry (+ R$ 8,00)
   └ 💬 Obs: _Sem cebola, massa crocante_
   💰 R$ 62,00

1x *Coca-Cola Original 2 Litros*
   💰 R$ 14,00

────────────────────────
🛵 *ENTREGA EM DOMICÍLIO:*
Rua: Rua Augusta, nº 500
Compl: Apto 42
Bairro: Consolação - São Paulo
Ref: Próximo ao metrô

💳 *FORMA DE PAGAMENTO:*
• Dinheiro (Troco para R$ 100,00)

💰 *RESUMO DO PEDIDO:*
Subtotal: R$ 76,00
Taxa de Entrega: R$ 7,00
*TOTAL A PAGAR: R$ 83,00*
────────────────────────
_Pedido gerado via ZapMenu_
```

- Gera a URL codificada `https://wa.me/5511999998888?text=...` e dispara a abertura direta no app do WhatsApp.

### 08 — Pós-Pedido & Repetir Pedido
- Exibe tela de confirmação com resumo do pedido enviado.
- Adiciona o botão **"🔄 Repetir último pedido"** no topo do cardápio, que reconstrói a sacola inteira em visitas futuras com 1 clique.

---

## 🛠️ 4. Painel de Gestão da Pizzaria (`admin.html`)

O lojista possui um painel completo para gerenciar seu negócio:

1. **Configurações da Loja:** Alterar nome, número do WhatsApp de atendimento, status Aberto/Fechado, horários, fotos de capa e logo, taxa de entrega padrão e pedido mínimo.
2. **Gestão de Categorias:** Criar, editar nome/ordem e excluir categorias.
3. **Catálogo de Produtos & Preços:**
   - Adicionar novos produtos com fotos, preços, descrição e categoria.
   - Ativar/desativar permissão de bordas recheadas e extras.
   - Pausar vendas de itens esgotados (switch de disponibilidade).
   - Filtro por categoria e busca por nome.
4. **Histórico de Pedidos:** Log auditável de todos os pedidos montados e enviados pelos clientes.
5. **Link Exclusivo:** Visualização do link público com botão de 1 clique para copiar para a Bio do Instagram ou WhatsApp.
6. **Restaurar Demonstração:** Botão para resetar o banco de dados local para os dados padrão da Pizzaria Bella Massa a qualquer momento.

---

## 🍕 5. Catálogo Cadastrado na Base Inicial

* **🥖 Entradas & Aperitivos (4 itens):** Pão de Calabresa Recheado, Crostini de Parmesão, Mini Coxinhas (8 un), Focaccia Genovese.
* **🍕 Pizzas Tradicionais (8 sabores):** Calabresa Especial, Frango com Catupiry, Portuguesa Imperial, Marguerita Gourmet, Mussarela Clássica, Napolitana, Baiana Picante, Milho com Bacon & Catupiry.
* **⭐ Pizzas Especiais (6 sabores):** 4 Queijos Nobres, Parma com Rúcula & Grana Padano, Pepperoni com Cream Cheese, Carne Seca com Cream Cheese, Brócolis com Bacon & Catupiry, Cogumelos Shimeji com Brie.
* **🍫 Pizzas Doces (4 sabores):** Nutella com Morangos Frescos, Romeu & Julieta, Banana Caramelizada com Canela & Doce de Leite, Ninho Trufado com Nutella.
* **🥟 Calzones Artesanais (2 itens):** Calzone Clássico Presunto e Ricota, Calzone Frango com Catupiry e Bacon.
* **🔥 Combos & Promoções (3 combos):** Combo Família Perfeita, Combo Casal, Combo Galera.
* **🍰 Sobremesas & Gelatos (3 itens):** Petit Gâteau de Chocolate, Mousse de Maracujá, Brownie Recheado com Nutella.
* **🥤 Bebidas & Cervejas (10 itens):** Coca-Cola 2L, Coca-Cola Zero 2L, Guaraná Antarctica 2L, Latas 350ml, Sucos Naturais 500ml e 300ml, Cervejas Heineken, Corona e Água Mineral.

---

## 🚀 6. Como Executar e Testar

### Opção A — Duplo Clique Direto (Sem necessidade de terminal)
- Abra o arquivo `index.html` para acessar o **Cardápio do Cliente**.
- Abra o arquivo `admin.html` para acessar o **Painel do Lojista**.

### Opção B — Servidor Local Integrado (Node.js)
```bash
# Iniciar o servidor local na porta 3000
npm start
# ou
node server.js
```
Acessos:
- **Cardápio:** `http://localhost:3000/index.html`
- **Admin:** `http://localhost:3000/admin.html`

### Testes Automatizados
```bash
npm test
```
Executa a validação de todos os 20 arquivos/rotas e a formatação das mensagens WhatsApp.
