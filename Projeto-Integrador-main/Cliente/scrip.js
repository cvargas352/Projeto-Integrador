 // Configuração padrão
        const defaultConfig = {
            restaurant_name: "🍔 Burger House",
            delivery_fee: "5.00",
            footer_text: "🍔 Delivery rápido e saboroso!"
        };

        // Estado da aplicação
        let currentSection = 'menu';
        let currentFilter = 'all';
        let cart = [];
        let orders = [];
        let users = [];
        let addresses = [];
        let currentUser = null;
        let profile = {
            name: '',
            phone: '',
            address: ''
        };
        let pendingItem = null;
        let modalQuantity = 1;
        let modalExtras = [];
        let modalRemovedIngredients = [];
        let modalObservations = '';
        let showingLogin = false;

        // Produtos do cardápio
        const menuItems = {
            burgers: [
                { id: 'b1', name: 'Burger Clássico', price: 18.90, description: 'Hambúrguer, queijo, alface, tomate e molho especial' },
                { id: 'b2', name: 'Burger Bacon', price: 22.90, description: 'Hambúrguer, bacon, queijo, cebola caramelizada' },
                { id: 'b3', name: 'Burger Duplo', price: 28.90, description: 'Dois hambúrgueres, queijo duplo, molho especial' },
                { id: 'b4', name: 'Burger Vegano', price: 19.90, description: 'Hambúrguer de grão-de-bico, alface, tomate, molho vegano' },
                { id: 'b5', name: 'Burger Picante', price: 24.90, description: 'Hambúrguer, pimenta jalapeño, queijo, molho picante' },
                { id: 'b6', name: 'Burger Gourmet', price: 32.90, description: 'Hambúrguer artesanal, queijo brie, rúcula, geleia' }
            ],
            sides: [
                { id: 's1', name: 'Batata Frita', price: 8.90, description: 'Porção individual' },
                { id: 's2', name: 'Onion Rings', price: 9.90, description: 'Anéis de cebola empanados' },
                { id: 's3', name: 'Nuggets', price: 12.90, description: '8 unidades' },
                { id: 's4', name: 'Batata Doce', price: 10.90, description: 'Fatias de batata doce' }
            ],
            drinks: [
                { id: 'd1', name: 'Coca-Cola', price: 5.90, description: '350ml' },
                { id: 'd2', name: 'Suco Natural', price: 7.90, description: '400ml' },
                { id: 'd3', name: 'Água', price: 3.90, description: '500ml' },
                { id: 'd4', name: 'Milkshake', price: 12.90, description: '400ml - Chocolate ou Morango' }
            ]
        };

        // Data SDK Handler
        const dataHandler = {
            onDataChanged(data) {
                if (!data) return;
                
                // Separar dados por tipo
                orders = data.filter(item => item.type === 'order') || [];
                users = data.filter(item => item.type === 'user') || [];
                addresses = data.filter(item => item.type === 'address') || [];
                
                // Verificar se usuário ainda está logado
                if (currentUser) {
                    const userExists = users.find(u => u.id === currentUser.id);
                    if (!userExists) {
                        currentUser = null;
                        updateLoginState();
                    }
                }
                
                renderOrders();
                renderAddresses();
            }
        };

        // Inicialização
        document.addEventListener('DOMContentLoaded', async function() {
            // Inicializar Data SDK
            if (window.dataSdk) {
                const initResult = await window.dataSdk.init(dataHandler);
                if (!initResult.isOk) {
                    console.error('Erro ao inicializar Data SDK');
                }
            }

            // Inicializar Element SDK
            if (window.elementSdk) {
                await window.elementSdk.init({
                    defaultConfig,
                    onConfigChange: async (config) => {
                        document.getElementById('restaurant-name').textContent = config.restaurant_name || defaultConfig.restaurant_name;
                        document.getElementById('footer-text').textContent = config.footer_text || defaultConfig.footer_text;
                        document.getElementById('delivery-fee-display').textContent = `R$ ${parseFloat(config.delivery_fee || defaultConfig.delivery_fee).toFixed(2).replace('.', ',')}`;
                        updateCartSummary();
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
                        ],
                        borderables: [],
                        fontEditable: undefined,
                        fontSizeable: undefined
                    }),
                    mapToEditPanelValues: (config) => new Map([
                        ["restaurant_name", config.restaurant_name || defaultConfig.restaurant_name],
                        ["delivery_fee", config.delivery_fee || defaultConfig.delivery_fee],
                        ["footer_text", config.footer_text || defaultConfig.footer_text]
                    ])
                });
            }

            renderMenu();
            setupEventListeners();
        });

        function renderMenu() {
            const productsList = document.getElementById('products-list');
            let itemsToShow = [];

            // Filtrar itens baseado no filtro atual
            switch(currentFilter) {
                case 'burgers':
                    itemsToShow = menuItems.burgers.map(item => ({...item, category: 'burger', icon: '🍔'}));
                    break;
                case 'sides':
                    itemsToShow = menuItems.sides.map(item => ({...item, category: 'side', icon: '🍟'}));
                    break;
                case 'drinks':
                    itemsToShow = menuItems.drinks.map(item => ({...item, category: 'drink', icon: '🥤'}));
                    break;
                default:
                    itemsToShow = [
                        ...menuItems.burgers.map(item => ({...item, category: 'burger', icon: '🍔'})),
                        ...menuItems.sides.map(item => ({...item, category: 'side', icon: '🍟'})),
                        ...menuItems.drinks.map(item => ({...item, category: 'drink', icon: '🥤'}))
                    ];
            }

            productsList.innerHTML = itemsToShow.map(item => `
                <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div class="flex items-center space-x-4">
                        <div class="text-3xl">${item.icon}</div>
                        <div>
                            <h4 class="font-bold text-lg text-gray-800">${item.name}</h4>
                            <p class="text-gray-600 text-sm">${item.description}</p>
                            <span class="text-xl font-bold text-green-600">R$ ${item.price.toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>
                    <button onclick="showConfirmation('${item.id}')" class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
                        Adicionar
                    </button>
                </div>
            `).join('');
        }

        function getAllItems() {
            return [...menuItems.burgers, ...menuItems.sides, ...menuItems.drinks];
        }

        function showConfirmation(itemId) {
            const allItems = getAllItems();
            const item = allItems.find(i => i.id === itemId);
            if (item) {
                pendingItem = item;
                modalQuantity = 1;
                modalExtras = [];
                modalRemovedIngredients = [];
                modalObservations = '';
                
                // Atualizar modal
                document.getElementById('modal-icon').textContent = getItemIcon(item.id);
                document.getElementById('modal-product-name').textContent = item.name;
                document.getElementById('modal-product-description').textContent = item.description;
                document.getElementById('modal-product-price').textContent = `R$ ${item.price.toFixed(2).replace('.', ',')}`;
                document.getElementById('modal-quantity').textContent = modalQuantity;
                
                // Limpar checkboxes dos adicionais
                document.querySelectorAll('.extra-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Limpar checkboxes de ingredientes removidos
                document.querySelectorAll('.remove-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Limpar observações
                document.getElementById('modal-observations').value = '';
                
                // Atualizar preço total
                updateModalPrice();
                
                // Mostrar modal
                document.getElementById('confirmation-modal').classList.remove('hidden');
            }
        }

        function updateModalPrice() {
            if (!pendingItem) return;
            
            let basePrice = pendingItem.price;
            let extrasPrice = modalExtras.reduce((sum, extra) => sum + extra.price, 0);
            let totalPrice = (basePrice + extrasPrice) * modalQuantity;
            
            document.getElementById('modal-total-price').textContent = `R$ ${totalPrice.toFixed(2).replace('.', ',')}`;
        }

        function getItemIcon(itemId) {
            if (itemId.startsWith('b')) return '🍔';
            if (itemId.startsWith('s')) return '🍟';
            if (itemId.startsWith('d')) return '🥤';
            return '🍽️';
        }

        function addToCart(item, quantity = 1, extras = [], removedIngredients = [], observations = '') {
            // Criar um ID único para o item com todas as personalizações
            const extrasId = extras.map(e => e.name).sort().join(',');
            const removedId = removedIngredients.sort().join(',');
            const obsId = observations.trim();
            const uniqueId = `${item.id}_${extrasId}_${removedId}_${obsId}`;
            
            // Calcular preço total do item com adicionais
            const extrasPrice = extras.reduce((sum, extra) => sum + extra.price, 0);
            const totalPrice = item.price + extrasPrice;
            
            // Criar nome de exibição com personalizações
            let displayName = item.name;
            let customizations = [];
            
            if (removedIngredients.length > 0) {
                customizations.push(`Sem: ${removedIngredients.join(', ')}`);
            }
            if (extras.length > 0) {
                customizations.push(`+ ${extras.map(e => e.name).join(', ')}`);
            }
            if (observations.trim()) {
                customizations.push(`Obs: ${observations.trim()}`);
            }
            
            if (customizations.length > 0) {
                displayName += ` (${customizations.join(' | ')})`;
            }
            
            // Verificar se já existe um item idêntico no carrinho
            const existingItem = cart.find(c => c.uniqueId === uniqueId);
            
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({
                    ...item,
                    uniqueId: uniqueId,
                    originalId: item.id,
                    quantity: quantity,
                    price: totalPrice,
                    originalPrice: item.price,
                    extras: extras,
                    removedIngredients: removedIngredients,
                    observations: observations,
                    displayName: displayName
                });
            }
            
            updateCartCount();
            renderCart();
            renderCartSidebar();
            showMessage(`${item.name} adicionado ao carrinho! 🛒`, 'success');
        }

        function removeFromCart(uniqueId) {
            cart = cart.filter(item => item.uniqueId !== uniqueId);
            updateCartCount();
            renderCart();
            renderCartSidebar();
        }

        function updateQuantity(uniqueId, change) {
            const item = cart.find(c => c.uniqueId === uniqueId);
            if (item) {
                item.quantity += change;
                if (item.quantity <= 0) {
                    removeFromCart(uniqueId);
                } else {
                    renderCart();
                    renderCartSidebar();
                }
            }
        }

        function updateCartCount() {
            const count = cart.reduce((sum, item) => sum + item.quantity, 0);
            document.getElementById('cart-count').textContent = count;
        }

        function renderCartSidebar() {
            const cartSummarySidebar = document.getElementById('cart-summary-sidebar');
            const cartTotalSidebar = document.getElementById('cart-total-sidebar');
            const sidebarCheckoutBtn = document.getElementById('sidebar-checkout-btn');

            if (cart.length === 0) {
                cartSummarySidebar.innerHTML = '<p class="text-gray-500 text-center py-8">Carrinho vazio</p>';
                cartTotalSidebar.classList.add('hidden');
                sidebarCheckoutBtn.disabled = true;
                return;
            }

            cartSummarySidebar.innerHTML = cart.map(item => `
                <div class="flex justify-between items-start text-sm border-b border-gray-100 pb-2">
                    <div class="flex-1">
                        <p class="font-medium text-gray-800">${item.displayName}</p>
                        <p class="text-gray-500">${item.quantity}x R$ ${item.price.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <p class="font-semibold text-green-600">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                </div>
            `).join('');

            cartTotalSidebar.classList.remove('hidden');
            sidebarCheckoutBtn.disabled = false;
            updateSidebarTotals();
        }

        function updateSidebarTotals() {
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryFee = parseFloat(window.elementSdk?.config?.delivery_fee || defaultConfig.delivery_fee);
            const total = subtotal + deliveryFee;

            document.getElementById('sidebar-subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            document.getElementById('sidebar-delivery-fee').textContent = `R$ ${deliveryFee.toFixed(2).replace('.', ',')}`;
            document.getElementById('sidebar-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }

        function renderCart() {
            const cartItems = document.getElementById('cart-items');
            const cartSummary = document.getElementById('cart-summary');

            if (cart.length === 0) {
                cartItems.innerHTML = '<p class="text-gray-500 text-center py-8">Seu carrinho está vazio</p>';
                cartSummary.classList.add('hidden');
                return;
            }

            cartItems.innerHTML = cart.map(item => `
                <div class="flex justify-between items-center p-4 border border-gray-200 rounded-lg cart-item-enter">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-800">${item.name}</h4>
                        <p class="text-gray-600 text-sm">R$ ${item.price.toFixed(2).replace('.', ',')} cada</p>
                        ${item.extras && item.extras.length > 0 ? `<p class="text-xs text-green-600">+ ${item.extras.map(e => e.name).join(', ')}</p>` : ''}
                        ${item.removedIngredients && item.removedIngredients.length > 0 ? `<p class="text-xs text-red-600">Sem: ${item.removedIngredients.join(', ')}</p>` : ''}
                        ${item.observations && item.observations.trim() ? `<p class="text-xs text-blue-600">Obs: ${item.observations}</p>` : ''}
                    </div>
                    <div class="flex items-center space-x-3">
                        <button onclick="updateQuantity('${item.uniqueId}', -1)" class="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full flex items-center justify-center font-bold">
                            -
                        </button>
                        <span class="font-semibold w-8 text-center">${item.quantity}</span>
                        <button onclick="updateQuantity('${item.uniqueId}', 1)" class="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full flex items-center justify-center font-bold">
                            +
                        </button>
                        <button onclick="removeFromCart('${item.uniqueId}')" class="text-red-600 hover:text-red-700 ml-4">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('');

            cartSummary.classList.remove('hidden');
            updateCartSummary();
        }

        function updateCartSummary() {
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryType = document.querySelector('input[name="delivery-type"]:checked')?.value || 'delivery';
            const deliveryFee = deliveryType === 'delivery' ? parseFloat(window.elementSdk?.config?.delivery_fee || defaultConfig.delivery_fee) : 0;
            const total = subtotal + deliveryFee;

            document.getElementById('subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            document.getElementById('total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }

        function setupEventListeners() {
            // Navegação
            document.getElementById('menu-btn').addEventListener('click', () => showSection('menu'));
            document.getElementById('cart-btn').addEventListener('click', () => showSection('cart'));
            document.getElementById('orders-btn').addEventListener('click', () => showSection('orders'));
            document.getElementById('profile-btn').addEventListener('click', () => showSection('profile'));

            // Filtros
            document.getElementById('filter-all').addEventListener('click', () => setFilter('all'));
            document.getElementById('filter-burgers').addEventListener('click', () => setFilter('burgers'));
            document.getElementById('filter-sides').addEventListener('click', () => setFilter('sides'));
            document.getElementById('filter-drinks').addEventListener('click', () => setFilter('drinks'));

            // Modal de confirmação
            document.getElementById('modal-cancel').addEventListener('click', () => {
                document.getElementById('confirmation-modal').classList.add('hidden');
                pendingItem = null;
                modalQuantity = 1;
                modalExtras = [];
                modalRemovedIngredients = [];
                modalObservations = '';
            });
            
            document.getElementById('modal-confirm').addEventListener('click', () => {
                if (pendingItem) {
                    addToCart(pendingItem, modalQuantity, modalExtras, modalRemovedIngredients, modalObservations);
                    document.getElementById('confirmation-modal').classList.add('hidden');
                    pendingItem = null;
                    modalQuantity = 1;
                    modalExtras = [];
                    modalRemovedIngredients = [];
                    modalObservations = '';
                }
            });

            // Controles de quantidade no modal
            document.getElementById('modal-qty-minus').addEventListener('click', () => {
                if (modalQuantity > 1) {
                    modalQuantity--;
                    document.getElementById('modal-quantity').textContent = modalQuantity;
                    updateModalPrice();
                }
            });

            document.getElementById('modal-qty-plus').addEventListener('click', () => {
                modalQuantity++;
                document.getElementById('modal-quantity').textContent = modalQuantity;
                updateModalPrice();
            });

            // Adicionais no modal
            document.querySelectorAll('.extra-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const extraName = e.target.dataset.name;
                    const extraPrice = parseFloat(e.target.dataset.price);
                    
                    if (e.target.checked) {
                        modalExtras.push({ name: extraName, price: extraPrice });
                    } else {
                        modalExtras = modalExtras.filter(extra => extra.name !== extraName);
                    }
                    
                    updateModalPrice();
                });
            });

            // Ingredientes removidos no modal
            document.querySelectorAll('.remove-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const ingredientName = e.target.dataset.name;
                    
                    if (e.target.checked) {
                        modalRemovedIngredients.push(ingredientName);
                    } else {
                        modalRemovedIngredients = modalRemovedIngredients.filter(ingredient => ingredient !== ingredientName);
                    }
                });
            });

            // Observações no modal
            document.getElementById('modal-observations').addEventListener('input', (e) => {
                modalObservations = e.target.value;
            });

            // Fechar modal clicando no fundo
            document.getElementById('confirmation-modal').addEventListener('click', (e) => {
                if (e.target.id === 'confirmation-modal') {
                    document.getElementById('confirmation-modal').classList.add('hidden');
                    pendingItem = null;
                    modalQuantity = 1;
                    modalExtras = [];
                    modalRemovedIngredients = [];
                    modalObservations = '';
                }
            });

            // Tipo de entrega
            document.querySelectorAll('input[name="delivery-type"]').forEach(radio => {
                radio.addEventListener('change', updateCartSummary);
            });

            // Finalizar pedido
            document.getElementById('place-order').addEventListener('click', placeOrder);

            // Salvar perfil
            document.getElementById('save-profile').addEventListener('click', saveProfile);

            // Login/Cadastro
            document.getElementById('login-tab').addEventListener('click', () => {
                document.getElementById('login-tab').classList.add('bg-white', 'text-gray-800', 'shadow-sm');
                document.getElementById('login-tab').classList.remove('text-gray-600', 'hover:text-gray-800');
                document.getElementById('register-tab').classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
                document.getElementById('register-tab').classList.add('text-gray-600', 'hover:text-gray-800');
                document.getElementById('login-form').classList.remove('hidden');
                document.getElementById('register-form').classList.add('hidden');
            });

            document.getElementById('register-tab').addEventListener('click', () => {
                document.getElementById('register-tab').classList.add('bg-white', 'text-gray-800', 'shadow-sm');
                document.getElementById('register-tab').classList.remove('text-gray-600', 'hover:text-gray-800');
                document.getElementById('login-tab').classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
                document.getElementById('login-tab').classList.add('text-gray-600', 'hover:text-gray-800');
                document.getElementById('register-form').classList.remove('hidden');
                document.getElementById('login-form').classList.add('hidden');
            });

            document.getElementById('login-submit').addEventListener('click', login);
            document.getElementById('register-submit').addEventListener('click', register);
            document.getElementById('login-modal-close').addEventListener('click', hideLoginModal);
            document.getElementById('logout-btn').addEventListener('click', logout);
            document.getElementById('forgot-password-btn').addEventListener('click', showForgotPassword);
            document.getElementById('back-to-login-btn').addEventListener('click', showLoginForm);
            document.getElementById('recovery-submit').addEventListener('click', recoverPassword);

            // Gerenciamento de endereços
            document.getElementById('add-address-btn').addEventListener('click', () => {
                document.getElementById('new-address-form').classList.remove('hidden');
            });

            document.getElementById('cancel-address-btn').addEventListener('click', () => {
                document.getElementById('new-address-form').classList.add('hidden');
                document.getElementById('new-address-name').value = '';
                document.getElementById('new-address-details').value = '';
            });

            document.getElementById('save-address-btn').addEventListener('click', saveNewAddress);

            // Fechar modal de login clicando no fundo
            document.getElementById('login-modal').addEventListener('click', (e) => {
                if (e.target.id === 'login-modal') {
                    hideLoginModal();
                }
            });
        }

        function setFilter(filter) {
            currentFilter = filter;
            
            // Atualizar botões de filtro
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('bg-red-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            });
            
            document.getElementById(`filter-${filter}`).classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            document.getElementById(`filter-${filter}`).classList.add('bg-red-600', 'text-white');
            
            renderMenu();
        }

        function showSection(section) {
            // Esconder todas as seções
            document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
            
            // Mostrar seção selecionada
            document.getElementById(`${section}-section`).classList.remove('hidden');
            currentSection = section;

            if (section === 'menu') {
                document.getElementById('menu-section').classList.remove('hidden');
            }
        }

        async function placeOrder() {
            if (cart.length === 0) {
                showMessage('Adicione itens ao carrinho primeiro', 'error');
                return;
            }

            // Verificar se usuário está logado
            if (!currentUser) {
                showLoginModal();
                return;
            }

            // Obter dados do pedido
            const deliveryType = document.querySelector('input[name="delivery-type"]:checked').value;
            let customerAddress = '';
            
            if (deliveryType === 'delivery') {
                const selectedAddress = document.querySelector('input[name="selected-address"]:checked');
                if (!selectedAddress) {
                    showMessage('Por favor, selecione um endereço para entrega', 'error');
                    return;
                }
                customerAddress = selectedAddress.value;
            }

            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryFee = deliveryType === 'delivery' ? parseFloat(window.elementSdk?.config?.delivery_fee || defaultConfig.delivery_fee) : 0;
            const total = subtotal + deliveryFee;

            const order = {
                type: 'order',
                id: Date.now().toString(),
                user_id: currentUser.id,
                items: JSON.stringify(cart),
                total: total,
                delivery_type: deliveryType,
                delivery_fee: deliveryFee,
                status: 'Pedido recebido',
                customer_name: currentUser.name,
                customer_phone: currentUser.phone,
                customer_address: customerAddress,
                created_at: new Date().toISOString()
            };

            // Mostrar loading
            const button = document.getElementById('place-order');
            const originalText = button.textContent;
            button.textContent = 'Processando...';
            button.disabled = true;

            if (window.dataSdk) {
                const result = await window.dataSdk.create(order);
                if (result.isOk) {
                    cart = [];
                    updateCartCount();
                    renderCart();
                    renderCartSidebar();
                    showMessage('Pedido realizado com sucesso! 🎉', 'success');
                    showSection('orders');
                } else {
                    showMessage('Erro ao processar pedido. Tente novamente.', 'error');
                }
            }

            // Restaurar botão
            button.textContent = originalText;
            button.disabled = false;
        }

        function showLoginModal() {
            document.getElementById('login-modal').classList.remove('hidden');
            showingLogin = true;
        }

        function hideLoginModal() {
            document.getElementById('login-modal').classList.add('hidden');
            showingLogin = false;
        }

        async function login() {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value.trim();

            if (!email || !password) {
                showMessage('Por favor, preencha e-mail e senha', 'error');
                return;
            }

            // Buscar usuário
            const user = users.find(u => u.email === email && u.password === password);
            if (!user) {
                showMessage('E-mail ou senha incorretos', 'error');
                return;
            }

            currentUser = user;
            updateLoginState();
            hideLoginModal();
            showMessage(`Bem-vindo, ${user.name}! 👋`, 'success');
        }

        async function register() {
            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const phone = document.getElementById('register-phone').value.trim();
            const password = document.getElementById('register-password').value.trim();

            if (!name || !email || !phone || !password) {
                showMessage('Por favor, preencha todos os campos', 'error');
                return;
            }

            // Verificar se e-mail já existe
            if (users.find(u => u.email === email)) {
                showMessage('Este e-mail já está cadastrado', 'error');
                return;
            }

            const newUser = {
                type: 'user',
                id: Date.now().toString(),
                name: name,
                email: email,
                phone: phone,
                password: password,
                created_at: new Date().toISOString()
            };

            // Mostrar loading
            const button = document.getElementById('register-submit');
            const originalText = button.textContent;
            button.textContent = 'Criando conta...';
            button.disabled = true;

            if (window.dataSdk) {
                const result = await window.dataSdk.create(newUser);
                if (result.isOk) {
                    currentUser = newUser;
                    updateLoginState();
                    hideLoginModal();
                    showMessage(`Conta criada com sucesso! Bem-vindo, ${name}! 🎉`, 'success');
                } else {
                    showMessage('Erro ao criar conta. Tente novamente.', 'error');
                }
            }

            // Restaurar botão
            button.textContent = originalText;
            button.disabled = false;
        }

        function logout() {
            currentUser = null;
            updateLoginState();
            showMessage('Você saiu da sua conta', 'success');
        }

        function showForgotPassword() {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('forgot-password-form').classList.remove('hidden');
            
            // Resetar abas
            document.getElementById('login-tab').classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
            document.getElementById('login-tab').classList.add('text-gray-600', 'hover:text-gray-800');
            document.getElementById('register-tab').classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
            document.getElementById('register-tab').classList.add('text-gray-600', 'hover:text-gray-800');
        }

        function showLoginForm() {
            document.getElementById('forgot-password-form').classList.add('hidden');
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            
            // Ativar aba de login
            document.getElementById('login-tab').classList.add('bg-white', 'text-gray-800', 'shadow-sm');
            document.getElementById('login-tab').classList.remove('text-gray-600', 'hover:text-gray-800');
            document.getElementById('register-tab').classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
            document.getElementById('register-tab').classList.add('text-gray-600', 'hover:text-gray-800');
        }

        async function recoverPassword() {
            const email = document.getElementById('recovery-email').value.trim();

            if (!email) {
                showMessage('Por favor, digite seu e-mail', 'error');
                return;
            }

            // Verificar se e-mail existe
            const user = users.find(u => u.email === email);
            if (!user) {
                showMessage('E-mail não encontrado em nossa base de dados', 'error');
                return;
            }

            // Mostrar loading
            const button = document.getElementById('recovery-submit');
            const originalText = button.textContent;
            button.textContent = 'Enviando...';
            button.disabled = true;

            // Simular envio de e-mail (em um sistema real, isso seria feito no backend)
            setTimeout(() => {
                // Mostrar a senha atual (em um sistema real, seria enviado um link de reset)
                showMessage(`Sua senha é: ${user.password}`, 'success');
                
                // Voltar para o login
                showLoginForm();
                document.getElementById('login-email').value = email;
                
                // Restaurar botão
                button.textContent = originalText;
                button.disabled = false;
                
                // Limpar campo
                document.getElementById('recovery-email').value = '';
            }, 2000);
        }

        function updateLoginState() {
            const guestCheckout = document.getElementById('guest-checkout');
            const userCheckout = document.getElementById('user-checkout');
            const userInfo = document.getElementById('user-info');

            if (currentUser) {
                guestCheckout.classList.add('hidden');
                userCheckout.classList.remove('hidden');
                userInfo.textContent = `${currentUser.name} - ${currentUser.phone}`;
                renderAddresses();
            } else {
                guestCheckout.classList.remove('hidden');
                userCheckout.classList.add('hidden');
            }
        }

        function renderAddresses() {
            if (!currentUser) return;

            const addressesList = document.getElementById('addresses-list');
            const userAddresses = addresses.filter(addr => addr.user_id === currentUser.id);

            if (userAddresses.length === 0) {
                addressesList.innerHTML = '<p class="text-gray-500 text-sm">Nenhum endereço cadastrado</p>';
                return;
            }

            addressesList.innerHTML = userAddresses.map((addr, index) => `
                <label class="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="radio" name="selected-address" value="${addr.address_details}" ${index === 0 || addr.is_default ? 'checked' : ''} class="mr-3 mt-1">
                    <div class="flex-1">
                        <div class="flex items-center justify-between">
                            <span class="font-medium text-gray-800">${addr.address_name}</span>
                            ${addr.is_default ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Padrão</span>' : ''}
                        </div>
                        <p class="text-sm text-gray-600 mt-1">${addr.address_details}</p>
                    </div>
                </label>
            `).join('');
        }

        async function saveNewAddress() {
            if (!currentUser) return;

            const name = document.getElementById('new-address-name').value.trim();
            const details = document.getElementById('new-address-details').value.trim();

            if (!name || !details) {
                showMessage('Por favor, preencha nome e endereço', 'error');
                return;
            }

            const userAddresses = addresses.filter(addr => addr.user_id === currentUser.id);
            const isFirst = userAddresses.length === 0;

            const newAddress = {
                type: 'address',
                id: Date.now().toString(),
                user_id: currentUser.id,
                address_name: name,
                address_details: details,
                is_default: isFirst,
                created_at: new Date().toISOString()
            };

            // Mostrar loading
            const button = document.getElementById('save-address-btn');
            const originalText = button.textContent;
            button.textContent = 'Salvando...';
            button.disabled = true;

            if (window.dataSdk) {
                const result = await window.dataSdk.create(newAddress);
                if (result.isOk) {
                    document.getElementById('new-address-name').value = '';
                    document.getElementById('new-address-details').value = '';
                    document.getElementById('new-address-form').classList.add('hidden');
                    showMessage('Endereço salvo com sucesso! 📍', 'success');
                } else {
                    showMessage('Erro ao salvar endereço. Tente novamente.', 'error');
                }
            }

            // Restaurar botão
            button.textContent = originalText;
            button.disabled = false;
        }

        function renderOrders() {
            const ordersList = document.getElementById('orders-list');
            
            // Filtrar pedidos do usuário atual
            const userOrders = currentUser ? orders.filter(order => order.user_id === currentUser.id) : [];
            
            if (userOrders.length === 0) {
                ordersList.innerHTML = currentUser ? 
                    '<p class="text-gray-500 text-center py-8">Você ainda não fez nenhum pedido</p>' :
                    '<p class="text-gray-500 text-center py-8">Faça login para ver seus pedidos</p>';
                return;
            }

            ordersList.innerHTML = userOrders.map(order => {
                const items = JSON.parse(order.items);
                const date = new Date(order.created_at).toLocaleString('pt-BR');
                
                return `
                    <div class="border border-gray-200 rounded-lg p-6 space-y-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-lg">Pedido #${order.id.slice(-6)}</h3>
                                <p class="text-gray-600">${date}</p>
                                <p class="text-gray-600">${order.customer_name} - ${order.customer_phone}</p>
                            </div>
                            <div class="text-right">
                                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold status-badge ${getStatusColor(order.status)}">
                                    ${order.status}
                                </span>
                                <p class="font-bold text-lg mt-2">R$ ${order.total.toFixed(2).replace('.', ',')}</p>
                            </div>
                        </div>
                        
                        <div class="border-t pt-4">
                            <h4 class="font-semibold mb-2">Itens do pedido:</h4>
                            <div class="space-y-1">
                                ${items.map(item => `
                                    <div class="flex justify-between text-sm">
                                        <span>${item.quantity}x ${item.name}</span>
                                        <span>R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="flex justify-between text-sm mt-2 pt-2 border-t">
                                <span>Entrega: ${order.delivery_type === 'delivery' ? '🚚 Delivery' : '🏪 Retirada'}</span>
                                <span>Taxa: R$ ${order.delivery_fee.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function getStatusColor(status) {
            switch(status) {
                case 'Pedido recebido': return 'bg-blue-100 text-blue-800';
                case 'Preparando': return 'bg-yellow-100 text-yellow-800';
                case 'Saiu para entrega': return 'bg-orange-100 text-orange-800';
                case 'Entregue': return 'bg-green-100 text-green-800';
                default: return 'bg-gray-100 text-gray-800';
            }
        }

        function saveProfile() {
            const name = document.getElementById('profile-name').value.trim();
            const phone = document.getElementById('profile-phone').value.trim();
            const address = document.getElementById('profile-address').value.trim();

            profile = { name, phone, address };
            
            // Preencher dados no carrinho se estiverem vazios
            if (name && !document.getElementById('customer-name').value) {
                document.getElementById('customer-name').value = name;
            }
            if (phone && !document.getElementById('customer-phone').value) {
                document.getElementById('customer-phone').value = phone;
            }
            if (address && !document.getElementById('customer-address').value) {
                document.getElementById('customer-address').value = address;
            }

            showMessage('Dados salvos com sucesso! 💾', 'success');
        }

        function showMessage(message, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 ${
                type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`;
            messageDiv.textContent = message;
            
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                messageDiv.remove();
            }, 3000);
        }

        // Inicializar na seção do menu
        showSection('menu');