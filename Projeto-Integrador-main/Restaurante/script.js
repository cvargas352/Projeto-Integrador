
// Burger House Admin - app.js (todas as páginas)
const defaultConfig = {
  restaurant_name: "🍔 Burger House Admin",
  admin_email: "admin@burgerhouse.com",
  support_phone: "(11) 99999-9999",
  restaurant_open: true
};

// Estado global (em memória)
let orders = [];
let users = [];
let products = [];
let currentProductFilter = 'all';
let orderSearchTerm = '';
let orderStatusFilter = '';
let currentOrderForPrint = null;
let editingProduct = null;

// Mapa de status
const orderStatuses = {
  'Cozinha': { column: 'new', icon: '👨‍🍳', color: 'bg-yellow-100 text-yellow-800' },
  'Aguardando entrega': { column: 'preparing', icon: '⏳', color: 'bg-blue-100 text-blue-800' },
  'Saiu para entrega': { column: 'ready', icon: '🚚', color: 'bg-orange-100 text-orange-800' },
  'Entregue': { column: 'delivered', icon: 'bg-green-100 text-green-800' },
  'Cancelados': { column: 'cancelled', icon: 'bg-red-100 text-red-800' }
};

// Data SDK handler
const dataHandler = {
  onDataChanged(data) {
    if (!data) return;
    orders = data.filter(i => i.type === 'order') || [];
    users = data.filter(i => i.type === 'user') || [];
    products = data.filter(i => i.type === 'product') || [];

    // Re-render por página
    const page = document.body?.dataset?.page;
    if (page === 'orders') {
      renderKanbanBoard();
    } else if (page === 'products') {
      renderProducts();
    } else if (page === 'customers') {
      renderCustomers();
    } else if (page === 'analytics') {
      updateAnalytics();
    }

    // Update header restaurant name if present
    const rn = document.getElementById('restaurant-name');
    if (rn) rn.textContent = (window.elementSdk?.config?.restaurant_name) || defaultConfig.restaurant_name;
  }
};

document.addEventListener('DOMContentLoaded', async function() {
  // Init Data SDK
  if (window.dataSdk) {
    try {
      const init = await window.dataSdk.init(dataHandler);
      if (!init.isOk) console.error('Erro ao inicializar Data SDK');
    } catch (e) { console.warn(e); }
  }

  // Init Element SDK
  if (window.elementSdk) {
    try {
      await window.elementSdk.init({
        defaultConfig,
        onConfigChange: async (config) => {
          const rn = document.getElementById('restaurant-name');
          if (rn) rn.textContent = config.restaurant_name || defaultConfig.restaurant_name;
        },
        mapToCapabilities: (config) => ({
          recolorables: [
            {
              get: () => config.primary_color || "#dc2626",
              set: (value) => {
                config.primary_color = value;
                window.elementSdk.setConfig({ primary_color: value });
              }
            }
          ]
        }),
        mapToEditPanelValues: (config) => new Map([
          ["restaurant_name", config.restaurant_name || defaultConfig.restaurant_name],
          ["admin_email", config.admin_email || defaultConfig.admin_email],
          ["support_phone", config.support_phone || defaultConfig.support_phone]
        ])
      });
    } catch (e) { console.warn(e); }
  }

  wireUpPage();
  // Dados de exemplo (se vazio)
  await createSampleProductsIfNeeded();
  await createSampleOrdersIfNeeded();
});

function wireUpPage() {
  const page = document.body?.dataset?.page;

  // Common nav counter (optional)
  const pendingSpan = document.getElementById('pending-orders-count');
  if (pendingSpan) {
    const pending = orders.filter(o => ['Cozinha','Aguardando entrega','Saiu para entrega'].includes(o.status)).length;
    if (pending > 0) {
      pendingSpan.textContent = pending;
      pendingSpan.classList.remove('hidden');
    } else {
      pendingSpan.classList.add('hidden');
    }
  }

  if (page === 'orders') {
    setupOrdersEvents();
    renderKanbanBoard();
    updateHeaderMetrics();
  }

  if (page === 'products') {
    setupProductsEvents();
    renderProducts();
  }

  if (page === 'customers') {
    setupCustomersEvents();
    renderCustomers();
  }

  if (page === 'analytics') {
    updateAnalytics();
  }
}

/* =================== ORDERS (KANBAN) =================== */
function setupOrdersEvents() {
  const orderSearch = document.getElementById('order-search');
  const statusFilter = document.getElementById('status-filter');
  const clearSearch = document.getElementById('clear-search');
  const statusBtn = document.getElementById('restaurant-status-btn');
  const detailsClose = document.getElementById('order-details-close');
  const printBtn = document.getElementById('print-order-btn');

  orderSearch && orderSearch.addEventListener('input', (e) => {
    orderSearchTerm = e.target.value.toLowerCase();
    renderKanbanBoard();
  });
  statusFilter && statusFilter.addEventListener('change', (e) => {
    orderStatusFilter = e.target.value;
    renderKanbanBoard();
  });
  clearSearch && clearSearch.addEventListener('click', () => {
    if (orderSearch) orderSearch.value = '';
    if (statusFilter) statusFilter.value = '';
    orderSearchTerm = ''; orderStatusFilter = '';
    renderKanbanBoard();
  });
  statusBtn && statusBtn.addEventListener('click', toggleRestaurantStatus);
  detailsClose && detailsClose.addEventListener('click', () => {
    document.getElementById('order-details-modal')?.classList.add('hidden');
  });
  printBtn && printBtn.addEventListener('click', printCurrentOrder);

  updateRestaurantStatusDisplay(window.elementSdk?.config?.restaurant_open ?? defaultConfig.restaurant_open);
}

function renderKanbanBoard() {
  const columns = {
    new: document.getElementById('new-orders'),
    preparing: document.getElementById('preparing-orders'),
    ready: document.getElementById('ready-orders'),
    delivered: document.getElementById('delivered-orders'),
    cancelled: document.getElementById('cancelled-orders')
  };
  if (!columns.new) return;

  const counts = { new:0, preparing:0, ready:0, delivered:0, cancelled:0 };

  Object.values(columns).forEach(c => c.innerHTML = '');

  let filtered = orders;

  if (orderSearchTerm) {
    filtered = filtered.filter(order => {
      const searchable = [
        order.id.slice(-6),
        order.customer_name,
        order.customer_phone,
        order.status,
        order.customer_address || ''
      ].join(' ').toLowerCase();
      return searchable.includes(orderSearchTerm);
    });
  }
  if (orderStatusFilter) {
    filtered = filtered.filter(o => o.status === orderStatusFilter);
  }

  filtered.forEach(order => {
    const info = orderStatuses[order.status];
    if (info && columns[info.column]) {
      counts[info.column]++;
      columns[info.column].appendChild(createOrderCard(order));
    }
  });

  if (filtered.length === 0 && (orderSearchTerm || orderStatusFilter)) {
    const div = document.createElement('div');
    div.className = 'text-center py-8 text-gray-500';
    div.innerHTML = '<div class="text-4xl mb-2">🔍</div><p class="text-lg font-semibold">Nenhum pedido encontrado</p><p class="text-sm">Tente ajustar os filtros</p>';
    columns.new.appendChild(div);
  }

  ['new','preparing','ready','delivered','cancelled'].forEach(k => {
    const el = document.getElementById(`${k}-orders-count`);
    if (el) el.textContent = counts[k];
  });
  const pendingEl = document.getElementById('pending-orders-count');
  if (pendingEl) {
    pendingEl.textContent = counts.new + counts.preparing + counts.ready;
    pendingEl.classList.toggle('hidden', (counts.new + counts.preparing + counts.ready) === 0);
  }

  updateHeaderMetrics();
}

function createOrderCard(order) {
  const date = new Date(order.created_at);
  const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateString = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const card = document.createElement('div');
  card.className = 'order-card bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow fade-in cursor-pointer';
  card.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    showOrderDetails(order);
  });
  card.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-start">
        <div>
          <h4 class="font-bold text-lg text-gray-800">#${order.id.slice(-6)}</h4>
          <p class="text-sm text-gray-600">${order.customer_name}</p>
        </div>
        <span class="text-lg font-bold text-green-600">R$ ${order.total.toFixed(2).replace('.', ',')}</span>
      </div>
      <div class="flex items-center space-x-2">
        ${order.delivery_type === 'delivery' ?
          '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-semibold">🚚 Entrega</span>' :
          '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-semibold">🏪 Retirada</span>'
        }
      </div>
      <div class="text-sm text-gray-500"><p>${dateString} às ${timeString}</p></div>
      <div class="text-xs text-gray-400 text-center">👆 Clique para ver detalhes</div>
      <div class="pt-2 border-t border-gray-100">${getOrderActionButtons(order)}</div>
    </div>`;
  return card;
}

function getOrderActionButtons(order) {
  const status = order.status;
  if (status === 'Cozinha') {
    return `<div class="flex space-x-2">
      <button onclick="updateOrderStatus('${order.id}', 'Aguardando entrega')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded-lg font-medium">⏳ Pronto</button>
      <button onclick="updateOrderStatus('${order.id}', 'Cancelados')" class="bg-red-500 hover:bg-red-600 text-white text-sm py-2 px-3 rounded-lg font-medium">❌</button>
    </div>`;
  } else if (status === 'Aguardando entrega') {
    return `<div class="flex space-x-2">
      <button onclick="updateOrderStatus('${order.id}', 'Saiu para entrega')" class="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm py-2 px-3 rounded-lg font-medium">🚚 Enviar</button>
      <button onclick="updateOrderStatus('${order.id}', 'Cancelados')" class="bg-red-500 hover:bg-red-600 text-white text-sm py-2 px-3 rounded-lg font-medium">❌</button>
    </div>`;
  } else if (status === 'Saiu para entrega') {
    return `<button onclick="updateOrderStatus('${order.id}', 'Entregue')" class="w-full bg-green-500 hover:bg-green-600 text-white text-sm py-2 px-3 rounded-lg font-medium">✅ Entregar</button>`;
  }
  return '<p class="text-sm text-gray-500 text-center py-2">Pedido finalizado</p>';
}

async function updateOrderStatus(orderId, newStatus) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  order.status = newStatus;
  if (window.dataSdk) {
    const result = await window.dataSdk.update(order);
    if (result.isOk) {
      showMessage(`Pedido #${orderId.slice(-6)} atualizado para: ${newStatus}`, 'success');
    } else {
      showMessage('Erro ao atualizar pedido', 'error');
    }
  }
  renderKanbanBoard();
}

function showOrderDetails(order) {
  currentOrderForPrint = order;
  const items = JSON.parse(order.items);
  const date = new Date(order.created_at).toLocaleString('pt-BR');
  const content = `
    <div class="space-y-4">
      <div class="flex justify-between items-start">
        <div>
          <h4 class="text-xl font-bold">Pedido #${order.id.slice(-6)}</h4>
          <p class="text-gray-600">${date}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-sm font-semibold ${orderStatuses[order.status]?.color || 'bg-gray-100 text-gray-800'}">${order.status}</span>
      </div>
      <div class="border-t pt-4">
        <h5 class="font-semibold mb-2">👤 Cliente</h5>
        <p><strong>Nome:</strong> ${order.customer_name}</p>
        <p><strong>Telefone:</strong> ${order.customer_phone}</p>
        <p><strong>Entrega:</strong> ${order.delivery_type === 'delivery' ? '🚚 Delivery' : '🏪 Retirada'}</p>
        ${order.delivery_type === 'delivery' ? `<p><strong>Endereço:</strong> ${order.customer_address}</p>` : ''}
      </div>
      <div class="border-t pt-4">
        <h5 class="font-semibold mb-3">🍔 Itens do Pedido</h5>
        <div class="space-y-2">
          ${items.map(item => `
            <div class="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
              <div class="flex-1">
                <p class="font-medium">${item.name}</p>
                ${item.extras?.length ? `<p class="text-xs text-green-600">+ ${item.extras.map(e => e.name).join(', ')}</p>` : ''}
                ${item.removedIngredients?.length ? `<p class="text-xs text-red-600">Sem: ${item.removedIngredients.join(', ')}</p>` : ''}
                ${item.observations?.trim() ? `<p class="text-xs text-blue-600">Obs: ${item.observations}</p>` : ''}
                <p class="text-sm text-gray-600">${item.quantity}x R$ ${item.price.toFixed(2).replace('.', ',')}</p>
              </div>
              <p class="font-semibold text-green-600">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="border-t pt-4">
        <div class="space-y-2">
          <div class="flex justify-between"><span>Subtotal:</span><span>R$ ${(order.total - order.delivery_fee).toFixed(2).replace('.', ',')}</span></div>
          <div class="flex justify-between"><span>Taxa de entrega:</span><span>R$ ${order.delivery_fee.toFixed(2).replace('.', ',')}</span></div>
          <div class="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span class="text-green-600">R$ ${order.total.toFixed(2).replace('.', ',')}</span></div>
        </div>
      </div>
      ${order.status !== 'Entregue' ? `<div class="border-t pt-4"><h5 class="font-semibold mb-3">⚡ Ações Rápidas</h5><div class="space-y-2">${getDetailedOrderActions(order)}</div></div>` : ''}
    </div>`;
  const container = document.getElementById('order-details-content');
  if (container) {
    container.innerHTML = content;
    document.getElementById('order-details-modal')?.classList.remove('hidden');
  }
}

function getDetailedOrderActions(order) {
  const s = order.status;
  if (s === 'Cozinha') {
    return `<button onclick="updateOrderStatus('${order.id}', 'Aguardando entrega'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold mb-2">⏳ Marcar como Pronto</button>
            <button onclick="updateOrderStatus('${order.id}', 'Cancelados'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-semibold">❌ Cancelar Pedido</button>`;
  } else if (s === 'Aguardando entrega') {
    return `<button onclick="updateOrderStatus('${order.id}', 'Saiu para entrega'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg font-semibold mb-2">🚚 Enviar para Entrega</button>
            <button onclick="updateOrderStatus('${order.id}', 'Cancelados'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-semibold">❌ Cancelar Pedido</button>`;
  } else if (s === 'Saiu para entrega') {
    return `<button onclick="updateOrderStatus('${order.id}', 'Entregue'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-semibold">✅ Marcar como Entregue</button>`;
  }
  return '';
}

function updateHeaderMetrics() {
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const elOrders = document.getElementById('total-orders-today');
  const elRevenue = document.getElementById('revenue-today');
  if (elOrders) elOrders.textContent = todayOrders.length;
  if (elRevenue) elRevenue.textContent = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
}

async function toggleRestaurantStatus() {
  const currentStatus = window.elementSdk ? 
    (window.elementSdk.config.restaurant_open !== undefined ? window.elementSdk.config.restaurant_open : defaultConfig.restaurant_open) :
    defaultConfig.restaurant_open;
  const newStatus = !currentStatus;
  if (window.elementSdk) await window.elementSdk.setConfig({ restaurant_open: newStatus });
  updateRestaurantStatusDisplay(newStatus);
  showMessage(newStatus ? 'Restaurante ABERTO! 🟢' : 'Restaurante FECHADO! 🔴', 'success');
}

function updateRestaurantStatusDisplay(isOpen) {
  const statusBtn = document.getElementById('restaurant-status-btn');
  const statusToggle = document.getElementById('status-toggle');
  const statusText = document.getElementById('status-text');
  if (!statusBtn || !statusToggle || !statusText) return;
  if (isOpen) {
    statusBtn.className = 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 bg-green-500';
    statusToggle.className = 'inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6';
    statusText.textContent = 'ABERTO';
    statusText.className = 'ml-3 text-sm font-medium text-green-600';
  } else {
    statusBtn.className = 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 bg-red-500';
    statusToggle.className = 'inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1';
    statusText.textContent = 'FECHADO';
    statusText.className = 'ml-3 text-sm font-medium text-red-600';
  }
}

function printCurrentOrder() {
  if (!currentOrderForPrint) return;
  const order = currentOrderForPrint;
  const items = JSON.parse(order.items);
  const date = new Date(order.created_at);
  const dateString = date.toLocaleDateString('pt-BR');
  const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const printContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pedido #${order.id.slice(-6)} - ${order.customer_name}</title>
  <style>
    body {{ font-family: 'Courier New', monospace; font-size: 12px; margin:0; padding:20px; max-width:300px; }}
    .header {{ text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:15px; }}
    .restaurant-name {{ font-size:18px; font-weight:bold; margin-bottom:5px; }}
    .section {{ margin-bottom:15px; border-bottom:1px dashed #000; padding-bottom:10px; }}
    .items .item {{ margin-bottom:8px; padding-bottom:5px; border-bottom:1px dotted #ccc; }}
    .item-details {{ font-size:10px; color:#666; margin-top:2px; }}
    .totals {{ border-top:2px solid #000; padding-top:10px; }}
    .line {{ display:flex; justify-content:space-between; margin-bottom:3px; }}
    .final {{ font-weight:bold; font-size:14px; border-top:1px solid #000; padding-top:5px; margin-top:5px; }}
  </style></head><body>
  <div class="header"><div class="restaurant-name">🍔 BURGER HOUSE</div><div>Pedido para ${order.delivery_type === 'delivery' ? 'ENTREGA' : 'RETIRADA'}</div><div>${order.status.toUpperCase()}</div></div>
  <div class="section"><div><strong>Pedido:</strong> #${order.id.slice(-6)}</div><div><strong>Data:</strong> ${dateString}</div><div><strong>Hora:</strong> ${timeString}</div></div>
  <div class="section"><div><strong>Cliente:</strong> ${order.customer_name}</div><div><strong>Telefone:</strong> ${order.customer_phone}</div>${order.delivery_type === 'delivery' ? `<div><strong>Endereço:</strong> ${order.customer_address}</div>` : ''}</div>
  <div class="items"><div style="font-weight:bold;margin-bottom:10px;">ITENS DO PEDIDO:</div>
  ${items.map(item => `<div class="item"><div>${item.quantity}x ${item.name}</div>
  ${item.extras?.length ? `<div class="item-details">+ ${item.extras.map(e => e.name).join(', ')}</div>` : ''}
  ${item.removedIngredients?.length ? `<div class="item-details">Sem: ${item.removedIngredients.join(', ')}</div>` : ''}
  ${item.observations?.trim() ? `<div class="item-details">Obs: ${item.observations}</div>` : ''}
  <div class="item-details">R$ ${item.price.toFixed(2).replace('.', ',')} cada = R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</div></div>`).join('')}
  </div>
  <div class="totals"><div class="line"><span>Subtotal:</span><span>R$ ${(order.total - order.delivery_fee).toFixed(2).replace('.', ',')}</span></div>
  <div class="line"><span>Taxa de entrega:</span><span>R$ ${order.delivery_fee.toFixed(2).replace('.', ',')}</span></div>
  <div class="line final"><span>TOTAL:</span><span>R$ ${order.total.toFixed(2).replace('.', ',')}</span></div></div>
  <div style="text-align:center; margin-top:20px; font-size:10px;">Obrigado! Impresso em: ${new Date().toLocaleString('pt-BR')}</div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write(printContent);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); w.onafterprint = () => w.close(); };
}

/* =================== PRODUCTS =================== */
function setupProductsEvents() {
  const addBtn = document.getElementById('add-product-btn');
  const cancelBtn = document.getElementById('product-modal-cancel');
  const saveBtn = document.getElementById('product-modal-save');
  const allBtn = document.getElementById('filter-all-products');
  const burgersBtn = document.getElementById('filter-burgers-products');
  const sidesBtn = document.getElementById('filter-sides-products');
  const drinksBtn = document.getElementById('filter-drinks-products');

  addBtn && addBtn.addEventListener('click', () => showProductModal());
  cancelBtn && cancelBtn.addEventListener('click', hideProductModal);
  saveBtn && saveBtn.addEventListener('click', saveProduct);

  allBtn && allBtn.addEventListener('click', () => setProductFilter('all'));
  burgersBtn && burgersBtn.addEventListener('click', () => setProductFilter('burger'));
  sidesBtn && sidesBtn.addEventListener('click', () => setProductFilter('side'));
  drinksBtn && drinksBtn.addEventListener('click', () => setProductFilter('drink'));
}

function renderProducts() {
  const list = document.getElementById('products-list');
  if (!list) return;
  let filtered = products;
  if (currentProductFilter !== 'all') filtered = products.filter(p => p.category === currentProductFilter);
  if (filtered.length === 0) { list.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum produto encontrado</p>'; return; }
  list.innerHTML = filtered.map(product => `
    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <div class="flex items-center space-x-4">
        <div class="text-3xl">${getCategoryIcon(product.category)}</div>
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <h4 class="font-bold text-lg text-gray-800">${product.name}</h4>
            ${!product.available ? '<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Indisponível</span>' : ''}
          </div>
          <p class="text-gray-600 text-sm">${product.description}</p>
          <div class="flex items-center space-x-4 mt-1">
            <span class="text-xl font-bold text-green-600">R$ ${product.price.toFixed(2).replace('.', ',')}</span>
            <span class="text-sm text-gray-500">${getCategoryName(product.category)}</span>
          </div>
        </div>
      </div>
      <div class="flex space-x-2">
        <button onclick="editProduct('${product.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">✏️ Editar</button>
        <button onclick="toggleProductAvailability('${product.id}')" class="${product.available ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-lg font-semibold transition-colors">
          ${product.available ? '❌ Desativar' : '✅ Ativar'}
        </button>
      </div>
    </div>
  `).join('');
}

function getCategoryIcon(category) { return ({burger:'🍔', side:'🍟', drink:'🥤'})[category] || '🍽️'; }
function getCategoryName(category) { return ({burger:'Hambúrguer', side:'Acompanhamento', drink:'Bebida'})[category] || 'Produto'; }

function setProductFilter(filter) {
  currentProductFilter = filter;
  document.querySelectorAll('.product-filter-btn').forEach(btn => {
    btn.classList.remove('bg-red-600','text-white');
    btn.classList.add('bg-gray-200','text-gray-700','hover:bg-gray-300');
  });
  const activeBtn = filter === 'all' ? document.getElementById('filter-all-products') : document.getElementById(`filter-${filter}s-products`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-200','text-gray-700','hover:bg-gray-300');
    activeBtn.classList.add('bg-red-600','text-white');
  }
  renderProducts();
}

function showProductModal(productId=null) {
  editingProduct = productId;
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  if (productId) {
    const p = products.find(x => x.id === productId);
    if (p) {
      document.getElementById('product-modal-title').textContent = '✏️ Editar Produto';
      document.getElementById('product-name').value = p.name;
      document.getElementById('product-category').value = p.category;
      document.getElementById('product-price').value = p.price;
      document.getElementById('product-description').value = p.description;
      document.getElementById('product-image').value = p.image_url || '';
      document.getElementById('product-available').checked = p.available;
    }
  } else {
    document.getElementById('product-modal-title').textContent = '➕ Novo Produto';
    document.getElementById('product-form').reset();
    document.getElementById('product-available').checked = true;
  }
  modal.classList.remove('hidden');
}
function hideProductModal(){ document.getElementById('product-modal')?.classList.add('hidden'); editingProduct = null; }

async function saveProduct() {
  const name = document.getElementById('product-name')?.value.trim();
  const category = document.getElementById('product-category')?.value;
  const price = parseFloat(document.getElementById('product-price')?.value || '0');
  const description = document.getElementById('product-description')?.value.trim();
  const imageUrl = document.getElementById('product-image')?.value.trim();
  const available = document.getElementById('product-available')?.checked;
  if (!name || !category || !price || !description) { showMessage('Preencha todos os campos obrigatórios', 'error'); return; }
  try {
    if (editingProduct) {
      const p = products.find(x => x.id === editingProduct);
      if (p) {
        Object.assign(p, { name, category, price, description, image_url: imageUrl, available });
        if (window.dataSdk) { const r = await window.dataSdk.update(p); if (r.isOk) { showMessage('Produto atualizado! ✅','success'); hideProductModal(); } else { showMessage('Erro ao atualizar produto','error'); } }
      }
    } else {
      const newProduct = { type:'product', id: Date.now().toString()+Math.random().toString(36).slice(2,9), name, category, price, description, image_url:imageUrl, available, created_at: new Date().toISOString() };
      if (window.dataSdk) { const r = await window.dataSdk.create(newProduct); if (r.isOk) { showMessage('Produto criado! 🎉','success'); hideProductModal(); } else { showMessage('Erro ao criar produto','error'); } }
    }
  } catch(e){ showMessage('Erro ao salvar produto','error'); }
}

/* toggle */
async function toggleProductAvailability(id){
  const p = products.find(x=>x.id===id); if(!p) return;
  p.available = !p.available;
  if (window.dataSdk) {
    const r = await window.dataSdk.update(p);
    if (r.isOk) showMessage(`Produto ${p.available?'ativado':'desativado'}!`, 'success');
    else showMessage('Erro ao atualizar produto','error');
  }
  renderProducts();
}
function editProduct(id){ showProductModal(id); }

/* =================== CUSTOMERS =================== */
function setupCustomersEvents() {
  const search = document.getElementById('customer-search');
  const exportBtn = document.getElementById('export-customers-btn');
  search && search.addEventListener('input', (e)=> renderCustomers(e.target.value));
  exportBtn && exportBtn.addEventListener('click', exportCustomers);
}

function renderCustomers(term='') {
  const body = document.getElementById('customers-table-body'); if (!body) return;
  let filtered = users;
  if (term) filtered = users.filter(u => u.name.toLowerCase().includes(term.toLowerCase()) || u.email.toLowerCase().includes(term.toLowerCase()) || (u.phone||'').includes(term));
  if (filtered.length === 0){ body.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">Nenhum cliente encontrado</td></tr>'; return; }
  body.innerHTML = filtered.map(user => {
    const uOrders = orders.filter(o => o.user_id === user.id);
    const totalSpent = uOrders.reduce((s,o)=>s+o.total, 0);
    const lastOrder = uOrders.length ? new Date(Math.max(...uOrders.map(o=>new Date(o.created_at)))).toLocaleDateString('pt-BR') : 'Nunca';
    return `<tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-4 px-4"><div><p class="font-semibold text-gray-800">${user.name}</p><p class="text-sm text-gray-600">${user.email}</p></div></td>
      <td class="py-4 px-4"><p class="text-gray-800">${user.phone||''}</p></td>
      <td class="py-4 px-4"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-semibold">${uOrders.length}</span></td>
      <td class="py-4 px-4"><span class="font-semibold text-green-600">R$ ${totalSpent.toFixed(2).replace('.', ',')}</span></td>
      <td class="py-4 px-4"><span class="text-gray-600">${lastOrder}</span></td>
      <td class="py-4 px-4"><button onclick="viewCustomerDetails('${user.id}')" class="text-blue-600 hover:text-blue-700 font-medium">👁️ Ver Detalhes</button></td>
    </tr>`;
  }).join('');
}

function viewCustomerDetails(userId) {
  const user = users.find(u=>u.id===userId); const uOrders = orders.filter(o=>o.user_id===userId);
  if (!user) return;
  const totalSpent = uOrders.reduce((s,o)=>s+o.total, 0);
  const avg = uOrders.length ? totalSpent/uOrders.length : 0;
  showMessage(`Cliente: ${user.name}\nE-mail: ${user.email}\nTelefone: ${user.phone||''}\nTotal de Pedidos: ${uOrders.length}\nTotal Gasto: R$ ${totalSpent.toFixed(2).replace('.', ',')}\nTicket Médio: R$ ${avg.toFixed(2).replace('.', ',')}`, 'success');
}

function exportCustomers() {
  const rows = ["Nome,Email,Telefone,Pedidos,Total Gasto,Último Pedido"].concat(users.map(u => {
    const uOrders = orders.filter(o=>o.user_id===u.id);
    const total = uOrders.reduce((s,o)=>s+o.total,0);
    const last = uOrders.length ? new Date(Math.max(...uOrders.map(o=>new Date(o.created_at)))).toLocaleDateString('pt-BR') : 'Nunca';
    return `"${u.name}","${u.email}","${u.phone||''}",${uOrders.length},"R$ ${total.toFixed(2).replace('.', ',')}","${last}"`;
  }));
  const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
  const link = document.createElement("a");
  link.href = encodeURI(csvContent);
  link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  showMessage('Lista de clientes exportada! 📊', 'success');
}

/* =================== ANALYTICS =================== */
function updateAnalytics() {
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
  const todayRevenue = todayOrders.reduce((s,o)=>s+o.total,0);
  const avg = todayOrders.length ? todayRevenue/todayOrders.length : 0;
  const activeCustomers = new Set(orders.map(o=>o.user_id)).size;
  const el1 = document.getElementById('analytics-orders-today');
  const el2 = document.getElementById('analytics-revenue-today');
  const el3 = document.getElementById('analytics-avg-ticket');
  const el4 = document.getElementById('analytics-active-customers');
  if (el1) el1.textContent = todayOrders.length;
  if (el2) el2.textContent = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
  if (el3) el3.textContent = `R$ ${avg.toFixed(2).replace('.', ',')}`;
  if (el4) el4.textContent = activeCustomers;
  updateTopProducts();
  updatePeakHours();
}

function updateTopProducts() {
  const topEl = document.getElementById('top-products'); if (!topEl) return;
  const sales = {};
  orders.forEach(o => {
    JSON.parse(o.items).forEach(item => {
      if (!sales[item.name]) sales[item.name] = { quantity:0, revenue:0 };
      sales[item.name].quantity += item.quantity;
      sales[item.name].revenue += item.price * item.quantity;
    });
  });
  const sorted = Object.entries(sales).sort((a,b)=>b[1].quantity-a[1].quantity).slice(0,5);
  if (!sorted.length) { topEl.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum produto vendido ainda</p>'; return; }
  topEl.innerHTML = sorted.map((p,i)=>`
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div class="flex items-center space-x-3">
        <span class="text-2xl font-bold text-gray-400">#${i+1}</span>
        <div><p class="font-semibold text-gray-800">${p[0]}</p><p class="text-sm text-gray-600">${p[1].quantity} vendidos</p></div>
      </div>
      <span class="font-bold text-green-600">R$ ${p[1].revenue.toFixed(2).replace('.', ',')}</span>
    </div>`).join('');
}

function updatePeakHours() {
  const container = document.getElementById('peak-hours'); if (!container) return;
  const counts = {};
  orders.forEach(o => { const h = new Date(o.created_at).getHours(); counts[h] = (counts[h]||0)+1; });
  const ranges = ['06-09','09-12','12-15','15-18','18-21','21-24'];
  container.innerHTML = ranges.map(r => {
    const [s,e] = r.split('-').map(Number); let c=0; for (let h=s; h<e; h++) c += counts[h]||0;
    return `<div class="bg-gray-50 rounded-lg p-4 text-center"><p class="text-2xl font-bold text-blue-600">${c}</p><p class="text-sm text-gray-600">${r}h</p></div>`;
  }).join('');
}

/* =================== SAMPLES =================== */
async function createSampleProductsIfNeeded() {
  if (products.length > 0) return;
  const sample = [
    { name:'Burger Clássico', category:'burger', price:18.90, description:'Hambúrguer, queijo, alface, tomate e molho especial', available:true },
    { name:'Burger Bacon', category:'burger', price:22.90, description:'Hambúrguer, bacon, queijo, cebola caramelizada', available:true },
    { name:'Batata Frita', category:'side', price:8.90, description:'Porção individual de batatas fritas crocantes', available:true },
    { name:'Coca-Cola', category:'drink', price:5.90, description:'Refrigerante 350ml gelado', available:true }
  ];
  if (window.dataSdk) {
    for (const p of sample) {
      await window.dataSdk.create({ type:'product', id: Date.now().toString()+Math.random().toString(36).slice(2,9), ...p, image_url:'', created_at: new Date().toISOString() });
    }
  }
}

async function createSampleOrdersIfNeeded() {
  if (orders.length > 0) return;
  const now = Date.now();
  const sampleOrders = [
    {
      type:'order', id:'ORD'+now+'001', user_id:'user_001', customer_name:'João Silva', customer_phone:'(11) 99999-1234',
      customer_address:'Rua das Flores, 123 - Vila Madalena', delivery_type:'delivery', delivery_fee:5.00, status:'Cozinha', total:32.80,
      items: JSON.stringify([{ name:'Burger Clássico', price:18.90, quantity:1 },{ name:'Batata Frita', price:8.90, quantity:1 },{ name:'Coca-Cola', price:5.90, quantity:1 }]),
      created_at: new Date().toISOString()
    },
    {
      type:'order', id:'ORD'+now+'002', user_id:'user_002', customer_name:'Maria Santos', customer_phone:'(11) 98888-5678',
      customer_address:'', delivery_type:'pickup', delivery_fee:0.00, status:'Aguardando entrega', total:22.90,
      items: JSON.stringify([{ name:'Burger Bacon', price:22.90, quantity:1 }]),
      created_at: new Date(now - 15*60*1000).toISOString()
    },
    {
      type:'order', id:'ORD'+now+'003', user_id:'user_003', customer_name:'Pedro Costa', customer_phone:'(11) 97777-9012',
      customer_address:'Av. Paulista, 1000 - Bela Vista', delivery_type:'delivery', delivery_fee:7.00, status:'Saiu para entrega', total:54.70,
      items: JSON.stringify([{ name:'Burger Clássico', price:18.90, quantity:2 },{ name:'Batata Frita', price:8.90, quantity:1 },{ name:'Coca-Cola', price:5.90, quantity:2 }]),
      created_at: new Date(now - 30*60*1000).toISOString()
    }
  ];
  if (window.dataSdk) {
    for (const o of sampleOrders) await window.dataSdk.create(o);
  }
}

/* =================== UTIL =================== */
function showMessage(message, type) {
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 max-w-md ${type==='success'?'bg-green-500 text-white':'bg-red-500 text-white'}`;
  div.style.whiteSpace = 'pre-line';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(), 4000);
}
