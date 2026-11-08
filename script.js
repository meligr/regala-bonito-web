/*
  Project:      Regala Bonito - El Arte de Regalar
  Description:  Client logic for the Luxe Celebration boutique app.
                Handles catalog filtering, persistent shopping cart, drawer toggles,
                toast notifications, and WhatsApp order generator.
*/

// Initialize cart from localStorage with defensive error handling
let cart = [];
try {
  const stored = localStorage.getItem("regala_bonito_cart");
  if (stored) {
    cart = JSON.parse(stored);
  }
} catch (e) {
  cart = [];
}

// WhatsApp phone contact
const WHATSAPP_PHONE = "53782767";

// Catalog data sources
const CATALOG_URLS = {
  categories: "data/categories.json",
  products: "data/products.json",
};

// Inline placeholder used when a product image cannot be loaded
const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 545" role="img" aria-label="Imagen no disponible">
  <rect width="600" height="545" fill="#f5eedf"/>
  <g fill="none" stroke="#c5a043" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <rect x="195" y="230" width="210" height="155" rx="16"/>
    <path d="M300 230v155M195 285h210"/>
    <path d="M300 230c-26-46-92-46-92-6 0 29 51 21 92 6zM300 230c26-46 92-46 92-6 0 29-51 21-92 6z"/>
  </g>
  <text x="300" y="445" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#947413">Imagen no disponible</text>
</svg>
`)}`;

// Catalog state
let catalogProducts = [];
let activeCategory = "all";
let itemsToShow = 6;

/**
 * Formats a numeric value using the catalog currency.
 * @param {number|string} value
 * @returns {string}
 */
function formatPrice(value) {
  const amount = Number(value);
  return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"} CUP`;
}

/**
 * Escapes text before inserting it into an HTML template.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

/**
 * Displays an elegant non-blocking boutique toast message
 * @param {string} message - Notification text
 * @param {'info' | 'success' | 'error'} type - Style modifier
 */
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;

  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg width="20" height="20" fill="none" stroke="#25d366" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>`;
  } else {
    iconSvg = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 4000);
}

/**
 * Toggles the sliding animation on the cart drawer.
 */
function toggleCart() {
  const cartSidebar = document.getElementById("cart-sidebar");
  const cartOverlay = document.getElementById("cart-overlay");
  if (!cartSidebar || !cartOverlay) return;

  const isClosed = !cartSidebar.classList.contains("cart-sidebar--active");

  if (isClosed) {
    cartSidebar.classList.add("cart-sidebar--active");
    cartOverlay.classList.add("cart-overlay--active");
    document.body.style.overflow = "hidden";
    renderCart();
  } else {
    cartSidebar.classList.remove("cart-sidebar--active");
    cartOverlay.classList.remove("cart-overlay--active");
    document.body.style.overflow = "";
  }
}

/**
 * Toggles the mobile navigation slide-out menu drawer.
 */
function toggleMobileMenu() {
  const mobileMenuSidebar = document.getElementById("mobile-menu-sidebar");
  const mobileMenuOverlay = document.getElementById("mobile-menu-overlay");
  if (!mobileMenuSidebar || !mobileMenuOverlay) return;

  const isClosed = !mobileMenuSidebar.classList.contains(
    "mobile-menu-sidebar--active",
  );

  if (isClosed) {
    mobileMenuSidebar.classList.add("mobile-menu-sidebar--active");
    mobileMenuOverlay.classList.add("mobile-menu-overlay--active");
    document.body.style.overflow = "hidden";
  } else {
    mobileMenuSidebar.classList.remove("mobile-menu-sidebar--active");
    mobileMenuOverlay.classList.remove("mobile-menu-overlay--active");
    document.body.style.overflow = "";
  }
}

/**
 * Builds the category filter buttons from the categories JSON.
 * @param {Array<{id: string, name: string}>} categories
 */
function renderCategories(categories) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  const normalizedCategories = categories
    .filter((category) => category && category.id && category.name)
    .map((category) => ({
      id: String(category.id),
      name: String(category.name),
    }));

  const items = [{ id: "all", name: "Todos" }, ...normalizedCategories];

  container.innerHTML = items
    .map((category) => {
      const isActive = category.id === activeCategory;
      return `
      <button type="button"
              class="catalog__filter-btn${isActive ? " catalog__filter-btn--active" : ""}"
              data-category="${escapeHtml(category.id)}"
              aria-pressed="${isActive}">
        ${escapeHtml(category.name)}
      </button>
    `;
    })
    .join("");
}

/**
 * Creates the markup for a single product card.
 * @param {{id?: string, name?: string, description?: string, price?: number, category_id?: string, image_url?: string}} product
 * @returns {string}
 */
function createProductCard(product) {
  const name = String(product.name ?? "Producto");
  const description = String(product.description ?? "");
  const price = Number(product.price);
  const safePrice = Number.isFinite(price) ? price : 0;
  const safeName = escapeHtml(name);
  const safeDescription = escapeHtml(description);
  const safeId = escapeHtml(product.id ?? "");
  const safeCategory = escapeHtml(product.category_id ?? "");

  const isPlaceholder =
    !product.image_url ||
    product.image_url === "placeholder.jpg" ||
    product.image_url.trim() === "";
  const imageUrl = isPlaceholder
    ? PLACEHOLDER_IMAGE
    : escapeHtml(product.image_url);
  const placeholderClass = isPlaceholder
    ? " product-card__image--placeholder"
    : "";

  return `
    <article class="product-card"
             tabindex="0" 
             data-category="${safeCategory}"
             data-product-id="${safeId}"
             data-product-name="${safeName}"
             data-product-price="${safePrice}">
      <div class="product-card__wrapper">
        <img src="${imageUrl}"
             alt="${safeName}"
             class="product-card__image${placeholderClass}"
             loading="lazy"
             decoding="async">
      </div>
      <div class="product-card__body">
        <h3 class="product-card__title">${safeName}</h3>
        <p class="product-card__description">${safeDescription}</p>
        <div class="product-card__footer">
          <span class="product-card__price">${formatPrice(safePrice)}</span>
          <button type="button"
                  class="product-card__button"
                  data-cart-action="add"
                  data-product-name="${safeName}"
                  data-product-price="${safePrice}"
                  aria-label="Agregar ${safeName} al carrito">
                  <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg> Agregar
          </button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Renders the products that match the active category.
 */
function renderProducts() {
  const grid = document.getElementById("product-grid");
  const toggleBtn = document.getElementById("load-toggle-btn");
  if (!grid) return;

  const allFiltered =
    activeCategory === "all"
      ? catalogProducts
      : catalogProducts.filter(
          (product) => String(product.category_id) === activeCategory,
        );

  const productsToDisplay = allFiltered.slice(0, itemsToShow);

  if (allFiltered.length === 0) {
    grid.innerHTML =
      '<p class="catalog__status">No hay productos disponibles en esta categoría.</p>';
    if (toggleBtn) toggleBtn.style.display = "none";
    return;
  }

  grid.innerHTML = productsToDisplay
    .map((product) => createProductCard(product))
    .join("");

  // Lógica del botón inteligente (Camaleón)
  if (toggleBtn) {
    if (allFiltered.length <= 6) {
      // Si hay 6 o menos productos, no hace falta el botón
      toggleBtn.style.display = "none";
    } else {
      toggleBtn.style.display = "inline-block";

      if (itemsToShow >= allFiltered.length) {
        // Si ya se muestran todos, cambia a "Mostrar menos"
        toggleBtn.innerHTML = "Mostrar menos ↑";
      } else {
        // Si faltan productos, se queda en "Ver más"
        toggleBtn.innerHTML = "Ver más productos ↓";
      }
    }
  }

  // Swap broken images for the inline placeholder.
  grid.querySelectorAll(".product-card__image").forEach((image) => {
    const usePlaceholder = () => {
      image.removeEventListener("error", usePlaceholder);
      image.src = PLACEHOLDER_IMAGE;
      image.classList.add("product-card__image--placeholder");
    };
    image.addEventListener("error", usePlaceholder);
    if (image.complete && image.naturalWidth === 0) {
      usePlaceholder();
    }
  });

  updateCatalogCardControls();
}

/**
 * Catalog filter categorization controller.
 * @param {string} categoryName
 */
function filterCatalog(categoryName) {
  activeCategory = categoryName || "all";
  itemsToShow = 6;

  document.querySelectorAll(".catalog__filter-btn").forEach((button) => {
    const isActive = button.dataset.category === activeCategory;
    button.classList.toggle("catalog__filter-btn--active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  renderProducts();
}

/**
 * Wires the delegated listeners for the dynamically rendered catalog.
 */
function setupCatalogListeners() {
  const filters = document.getElementById("category-filters");
  if (filters) {
    filters.addEventListener("click", (event) => {
      const button = event.target.closest(".catalog__filter-btn");
      if (!button || !filters.contains(button)) return;
      filterCatalog(button.dataset.category);
    });
  }

  const grid = document.getElementById("product-grid");
  if (grid) {
    grid.addEventListener("click", (event) => {
      const control = event.target.closest("[data-cart-action]");
      if (control) {
        const productName = control.dataset.productName;
        const action = control.dataset.cartAction;
        if (!productName) return;

        if (action === "add") {
          addToCart(productName, Number(control.dataset.productPrice), control);
        } else if (action === "increase") {
          increaseQuantity(productName);
        } else if (action === "decrease") {
          decreaseQuantity(productName);
        }
        return;
      }

      const card = event.target.closest(".product-card");
      if (card) {
        const productId = card.dataset.productId;
        if (productId) {
          window.openProductModal(productId);
        }
      }
    });

    grid.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        const card = event.target.closest(".product-card");
        if (card) {
          event.preventDefault();
          window.openProductModal(card.dataset.productId);
        }
      }
    });
  }
}

/**
 * Fetches categories and products, then renders the catalog.
 */
async function loadCatalog() {
  const grid = document.getElementById("product-grid");
  if (grid) {
    grid.innerHTML = '<p class="catalog__status">Cargando catálogo…</p>';
  }

  try {
    const [categoriesResponse, productsResponse] = await Promise.all([
      fetch(CATALOG_URLS.categories),
      fetch(CATALOG_URLS.products),
    ]);

    if (!categoriesResponse.ok) {
      throw new Error(
        `No se pudieron cargar las categorías (HTTP ${categoriesResponse.status}).`,
      );
    }
    if (!productsResponse.ok) {
      throw new Error(
        `No se pudieron cargar los productos (HTTP ${productsResponse.status}).`,
      );
    }

    const [categoriesData, productsData] = await Promise.all([
      categoriesResponse.json(),
      productsResponse.json(),
    ]);

    const categories = Array.isArray(categoriesData) ? categoriesData : [];
    catalogProducts = Array.isArray(productsData) ? productsData : [];

    activeCategory = "all";
    renderCategories(categories);
    renderProducts();
  } catch (error) {
    console.error("Error al cargar el catálogo:", error);
    if (grid) {
      grid.innerHTML =
        '<p class="catalog__status catalog__status--error">No se pudo cargar el catálogo. Verifica que los archivos data/categories.json y data/products.json estén disponibles y que el sitio se sirva por HTTP.</p>';
    }
  }
}

/**
 * Appends or increments target element inside persistent local cart.
 */
function addToCart(itemName, itemPrice, btnElement) {
  const matchedItem = cart.find((product) => product.name === itemName);

  if (matchedItem) {
    matchedItem.quantity += 1;
  } else {
    cart.push({
      name: itemName,
      price: itemPrice,
      quantity: 1,
    });
  }

  saveCartState();
  updateCartIndicators();
  renderCart();
  renderCheckoutLiveSummary();
  updateCatalogCardControls();

  if (btnElement) {
    const originalInner = btnElement.innerHTML;
    btnElement.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:inline; vertical-align:middle; margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg> Agregado`;
    btnElement.style.backgroundColor = "var(--color-primary)";

    setTimeout(() => {
      btnElement.innerHTML = originalInner;
      btnElement.style.backgroundColor = "";
    }, 900);
  }

  showToast(`"${itemName}" agregado a tu pedido`, "success");
}

/**
 * Decrements or removes targeted element item from active cart.
 */
function decreaseQuantity(itemName) {
  const matchedItem = cart.find((product) => product.name === itemName);

  if (matchedItem) {
    matchedItem.quantity -= 1;
    if (matchedItem.quantity <= 0) {
      removeProduct(itemName);
    } else {
      saveCartState();
      updateCartIndicators();
      renderCart();
      renderCheckoutLiveSummary();
      updateCatalogCardControls();
    }
  }
}

/**
 * Escalates targeted element quantity item count.
 */
function increaseQuantity(itemName) {
  const matchedItem = cart.find((product) => product.name === itemName);

  if (matchedItem) {
    matchedItem.quantity += 1;
    saveCartState();
    updateCartIndicators();
    renderCart();
    renderCheckoutLiveSummary();
    updateCatalogCardControls();
  }
}

/**
 * Completely excludes item from active cart.
 */
function removeProduct(itemName) {
  cart = cart.filter((product) => product.name !== itemName);
  saveCartState();
  updateCartIndicators();
  renderCart();
  renderCheckoutLiveSummary();
  updateCatalogCardControls();
}

/**
 * Synchronizes internal system state data to header and mobile badges.
 */
function updateCartIndicators() {
  const accumulatedUnits = cart.reduce(
    (total, product) => total + product.quantity,
    0,
  );

  const cartBadge = document.getElementById("cart-badge");
  const cartBadgeMobile = document.getElementById("cart-badge-mobile");
  const mobileMenuCartBadge = document.getElementById("mobile-menu-cart-badge");

  if (cartBadge) {
    cartBadge.innerText = accumulatedUnits;
    cartBadge.style.display = accumulatedUnits === 0 ? "none" : "flex";
  }
  if (cartBadgeMobile) {
    cartBadgeMobile.innerText = accumulatedUnits;
  }
  if (mobileMenuCartBadge) {
    mobileMenuCartBadge.innerText = accumulatedUnits;
  }
}

/**
 * Persists cart to localStorage.
 */
function saveCartState() {
  try {
    localStorage.setItem("regala_bonito_cart", JSON.stringify(cart));
  } catch (e) {
    // Graceful fallback for sandboxed iframes
  }
}

/**
 * Synchronizes catalog card selectors to display dynamic count dials when quantity > 0.
 */
function updateCatalogCardControls() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const productName = card.getAttribute("data-product-name");
    const productPrice = Number(card.getAttribute("data-product-price") || 0);
    if (!productName) return;

    const matchedItem = cart.find((product) => product.name === productName);
    const footer = card.querySelector(".product-card__footer");
    if (!footer) return;

    const safeName = escapeHtml(productName);

    if (matchedItem && matchedItem.quantity > 0) {
      footer.innerHTML = `
        <span class="product-card__price">${formatPrice(productPrice)}</span>
        <div class="product-card__qty-selector">
          <button type="button" class="product-card__qty-btn" data-cart-action="decrease" data-product-name="${safeName}" aria-label="Disminuir cantidad de ${safeName}">-</button>
          <span class="product-card__qty-value">${matchedItem.quantity}</span>
          <button type="button" class="product-card__qty-btn" data-cart-action="increase" data-product-name="${safeName}" aria-label="Aumentar cantidad de ${safeName}">+</button>
        </div>
      `;
    } else {
      footer.innerHTML = `
        <span class="product-card__price">${formatPrice(productPrice)}</span>
        <button type="button" class="product-card__button" data-cart-action="add" data-product-name="${safeName}" data-product-price="${productPrice}" aria-label="Agregar ${safeName} al carrito">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg> Agregar
        </button>
      `;
    }
  });
}

/**
 * Renders a live visual summary card in the checkout section.
 */
function renderCheckoutLiveSummary() {
  const summaryBox = document.getElementById("checkout-summary-box");
  if (!summaryBox) return;

  if (cart.length === 0) {
    summaryBox.innerHTML = `
      <div class="checkout__summary-empty">
        <svg width="40" height="40" fill="none" stroke="#c5a043" stroke-width="1.5" viewBox="0 0 24 24" style="opacity: 0.6; margin-bottom: 0.75rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>
        <p class="checkout__summary-empty-text">Tu selección está vacía</p>
        <p class="checkout__summary-empty-subtext">Navega por nuestro catálogo superior y selecciona los elementos de tu agrado.</p>
        <a href="#catalog" class="checkout__summary-explore-btn">Ver Catálogo</a>
      </div>
    `;
    return;
  }

  let calculatedSummary = 0;
  const itemsHtml = cart
    .map((item) => {
      const cumulativeCost = item.price * item.quantity;
      calculatedSummary += cumulativeCost;

      return `
      <div class="checkout__summary-item">
        <div class="checkout__summary-item-info">
          <span class="checkout__summary-item-name">${item.name}</span>
          <span class="checkout__summary-item-subtotal">${formatPrice(cumulativeCost)}</span>
        </div>
        <div class="checkout__summary-item-ops">
          <button type="button" onclick="decreaseQuantity('${item.name}')" class="checkout__summary-op-btn" aria-label="Decrease quantity">-</button>
          <span class="checkout__summary-op-val">${item.quantity}</span>
          <button type="button" onclick="increaseQuantity('${item.name}')" class="checkout__summary-op-btn" aria-label="Increase quantity">+</button>
          <button type="button" onclick="removeProduct('${item.name}')" class="checkout__summary-remove" aria-label="Remove item">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  summaryBox.innerHTML = `
    <div class="checkout__summary-list">
      ${itemsHtml}
    </div>
    <div class="checkout__summary-total">
      <span class="checkout__summary-total-label">Total Estimado</span>
      <span class="checkout__summary-total-value">${formatPrice(calculatedSummary)}</span>
    </div>
  `;
}

/**
 * Renders the cart drawer details.
 */
function renderCart() {
  const cartItemsContainer = document.getElementById("cart-items");
  const cartTotalValue = document.getElementById("cart-total");
  if (!cartItemsContainer) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty-state">
        <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" style="color: rgba(197, 160, 67, 0.3); margin-bottom: 1rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>
        <p>Tu carrito está vacío. Elige detalles únicos del catálogo.</p>
      </div>
    `;
    if (cartTotalValue) {
      cartTotalValue.innerText = formatPrice(0);
    }
    return;
  }

  let calculatedSummary = 0;
  cartItemsContainer.innerHTML = cart
    .map((item) => {
      const cumulativeCost = item.price * item.quantity;
      calculatedSummary += cumulativeCost;

      return `
      <div class="cart-item">
        <div class="cart-item__info">
          <h4 class="cart-item__title">${item.name}</h4>
          <p class="cart-item__price">${formatPrice(cumulativeCost)}</p>
        </div>
        <div class="cart-item__controls">
          <button onclick="decreaseQuantity('${item.name}')" class="cart-item__btn" aria-label="Decrease quantity">-</button>
          <span class="cart-item__quantity">${item.quantity}</span>
          <button onclick="increaseQuantity('${item.name}')" class="cart-item__btn" aria-label="Increase quantity">+</button>
        </div>
        <button onclick="removeProduct('${item.name}')" class="cart-item__remove-btn" aria-label="Remove item">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        </button>
      </div>
    `;
    })
    .join("");

  if (cartTotalValue) {
    cartTotalValue.innerText = formatPrice(calculatedSummary);
  }
}

/**
 * Formats YYYY-MM-DD date to DD/MM/YYYY.
 */
function formatDateSpanish(originalDate) {
  if (!originalDate) return "";
  const dateCollection = originalDate.split("-");
  if (dateCollection.length !== 3) return originalDate;
  return `${dateCollection[2]}/${dateCollection[1]}/${dateCollection[0]}`;
}

/**
 * Validates checkout inputs and compiles order into WhatsApp redirect.
 */
function sendOrderToWhatsApp() {
  const nameEl = document.getElementById("cust-name");
  const phoneEl = document.getElementById("cust-phone");
  const pickupEl = document.getElementById("pickup-info");
  const dateEl = document.getElementById("event-date");
  const notesEl = document.getElementById("order-notes");
  const addressEl = document.getElementById("cust-address");

  [nameEl, phoneEl, dateEl, addressEl].forEach((el) => {
    if (el) el.classList.remove("form-control--error");
  });

  const clientName = nameEl ? nameEl.value.trim() : "";
  const clientPhone = phoneEl ? phoneEl.value.trim() : "";
  const pickupDelivery = pickupEl ? pickupEl.value : "retiro";
  const rawEventDate = dateEl ? dateEl.value : "";
  const userComments = notesEl ? notesEl.value.trim() : "";
  const shippingAddress = addressEl ? addressEl.value.trim() : "";

  let hasErrors = false;

  if (clientName.length < 4 || /^\d+$/.test(clientName)) {
    showToast("Por favor, escribe tu nombre real (mínimo 4 letras).", "error");
    if (nameEl) nameEl.classList.add("form-control--error");
    hasErrors = true;
  }

  const phoneDigits = clientPhone.replace(/\D/g, "");
  if (phoneDigits.length < 8) {
    showToast("El WhatsApp debe tener al menos 8 números.", "error");
    if (phoneEl) phoneEl.classList.add("form-control--error");
    hasErrors = true;
  }

  if (!rawEventDate) {
    showToast("Por favor, selecciona la fecha de tu evento.", "error");
    if (dateEl) dateEl.classList.add("form-control--error");
    hasErrors = true;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(rawEventDate + "T00:00:00");
    if (selectedDate < today) {
      showToast("La fecha del evento no puede ser en el pasado.", "error");
      if (dateEl) dateEl.classList.add("form-control--error");
      hasErrors = true;
    }
  }

  if (pickupDelivery === "envio" && shippingAddress.length < 5) {
    showToast("Por favor, escribe una dirección de envío válida.", "error");
    if (addressEl) addressEl.classList.add("form-control--error");
    hasErrors = true;
  }

  if (hasErrors) {
    const firstError = document.querySelector(".form-control--error");
    if (firstError) firstError.focus();
    return;
  }

  if (cart.length === 0) {
    showToast(
      "Tu pedido está vacío. Selecciona artículos antes de confirmar.",
      "error",
    );
    const catalogEl = document.getElementById("catalog");
    if (catalogEl) catalogEl.scrollIntoView({ behavior: "smooth" });
    return;
  }

  const formattedSpanishDate = formatDateSpanish(rawEventDate);
  const pickupFormatted =
    pickupDelivery === "retiro"
      ? "Retiro en Local"
      : "Envío Privado a Domicilio";

  let messageBody = `*Nuevo Pedido - Regala Bonito*\n\n`;
  messageBody += `*Cliente:* ${clientName}\n`;
  messageBody += `*WhatsApp:* ${clientPhone}\n`;
  messageBody += `*Opción de Entrega:* ${pickupFormatted}\n`;

  if (pickupDelivery === "envio") {
    messageBody += `*Dirección de Envío:* ${shippingAddress}\n`;
  }

  messageBody += `*Fecha de Evento:* ${formattedSpanishDate}\n`;
  messageBody += `*Notas Especiales:* ${userComments || "Sin comentarios adicionales."}\n\n`;
  messageBody += `*DETALLES DEL PEDIDO:*\n`;

  let totalValuation = 0;
  cart.forEach((catalogItem) => {
    const lineCost = catalogItem.price * catalogItem.quantity;
    messageBody += `- ${catalogItem.quantity}x ${catalogItem.name} (${formatPrice(lineCost)})\n`;
    totalValuation += lineCost;
  });

  messageBody += `\n*TOTAL ESTIMADO DEL PEDIDO: ${formatPrice(totalValuation)}*`;

  const waURL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(messageBody)}`;

  const link = document.createElement("a");
  link.href = waURL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("¡Pedido compilado! Abriendo WhatsApp...", "success");
}

/* ===== MODAL ===== */
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("product-modal");
  const closeModalBtn = document.getElementById("close-modal");

  if (modal) {
    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => modal.close());
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.close();
    });
  }
});

window.openProductModal = function (productId) {
  const modal = document.getElementById("product-modal");
  if (!modal) return;

  const product = catalogProducts.find(
    (p) => String(p.id) === String(productId),
  );
  if (!product) return;

  const modalImg = document.getElementById("modal-img");
  modalImg.onerror = function () {
    this.onerror = null;
    this.src = PLACEHOLDER_IMAGE;
    this.classList.add("product-card__image--placeholder");
  };
  modalImg.src = product.image_url || PLACEHOLDER_IMAGE;
  modalImg.classList.remove("product-card__image--placeholder");

  document.getElementById("modal-title").textContent = product.name;
  document.getElementById("modal-price").textContent = formatPrice(
    product.price,
  );
  document.getElementById("modal-desc").textContent =
    product.description || "Sin descripción adicional.";

  const actionsContainer = document.getElementById("modal-actions-container");
  const matchedItem = cart.find((item) => item.name === product.name);

  if (matchedItem && matchedItem.quantity > 0) {
    actionsContainer.innerHTML = `
      <div class="product-modal__qty-selector">
        <button type="button" class="product-modal__qty-btn" onclick="updateModalQuantity('${product.name}', -1)">-</button>
        <span class="product-modal__qty-value">${matchedItem.quantity}</span>
        <button type="button" class="product-modal__qty-btn" onclick="updateModalQuantity('${product.name}', 1)">+</button>
      </div>
    `;
  } else {
    actionsContainer.innerHTML = `
      <button type="button" class="product-modal__btn" onclick="addFromModal('${product.name}', ${product.price}, '${product.id}')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg> Agregar al pedido
      </button>
    `;
  }

  modal.showModal();
};

window.addFromModal = function (name, price, id) {
  addToCart(name, price, null);
  window.openProductModal(id);
};

window.updateModalQuantity = function (name, change) {
  const product = catalogProducts.find((p) => p.name === name);
  if (!product) return;

  if (change > 0) {
    increaseQuantity(name);
  } else {
    decreaseQuantity(name);
  }

  updateCatalogCardControls();
  window.openProductModal(product.id);
};

// Bind all critical functions immediately to window for inline onclick handlers
window.toggleCart = toggleCart;
window.toggleMobileMenu = toggleMobileMenu;
window.filterCatalog = filterCatalog;
window.addToCart = addToCart;
window.decreaseQuantity = decreaseQuantity;
window.increaseQuantity = increaseQuantity;
window.removeProduct = removeProduct;
window.sendOrderToWhatsApp = sendOrderToWhatsApp;
window.showToast = showToast;

/**
 * Initializes listeners, IntersectionObserver, and UI state.
 */
function initializeApp() {
  // Mark document as JS ready so CSS can safely enable progressive enhancements
  document.documentElement.classList.add("js-ready");

  // Intersecting Scroll Reveal System for Transitions
  const scrollObOptions = {
    root: null,
    rootMargin: "0px 0px -20px 0px",
    threshold: 0.05,
  };

  const smoothRevealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, scrollObOptions);

  // Bind sections and grids
  const revealElements = document.querySelectorAll(
    ".scroll-reveal, .scroll-reveal-container",
  );
  revealElements.forEach((revealable) => {
    smoothRevealObserver.observe(revealable);

    // Immediate fallback: reveal elements already in view
    const rect = revealable.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      revealable.classList.add("revealed");
    }
  });

  // Sticky header transition system
  const header = document.querySelector(".header");
  if (header) {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        header.classList.remove("header--transparent");
      } else {
        header.classList.add("header--transparent");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
  }

  // Mobile Category scroll indicator helper
  const categoryScroller = document.querySelector(".catalog__scroller");
  const scrollIndicator = document.querySelector(
    ".catalog__scroll-indicator-mobile",
  );
  if (categoryScroller && scrollIndicator) {
    categoryScroller.addEventListener(
      "scroll",
      () => {
        if (categoryScroller.scrollLeft > 20) {
          scrollIndicator.classList.add(
            "catalog__scroll-indicator-mobile--hidden",
          );
        } else {
          scrollIndicator.classList.remove(
            "catalog__scroll-indicator-mobile--hidden",
          );
        }
      },
      { passive: true },
    );
  }

  // Wire the dynamic catalog and load its data
  setupCatalogListeners();

  const toggleBtn = document.getElementById("load-toggle-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const allFiltered =
        activeCategory === "all"
          ? catalogProducts
          : catalogProducts.filter(
              (product) => String(product.category_id) === activeCategory,
            );

      if (itemsToShow >= allFiltered.length) {
        itemsToShow = 6;
        renderProducts();

        const catalogSection = document.getElementById("catalog");
        if (catalogSection) {
          catalogSection.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        itemsToShow += 6;
        renderProducts();
      }
    });
  }

  document.querySelectorAll(".form-control").forEach((input) => {
    input.addEventListener("input", () => {
      input.classList.remove("form-control--error");
    });
  });

  const pickupInfo = document.getElementById("pickup-info");
  const addressGroup = document.getElementById("address-group");
  if (pickupInfo && addressGroup) {
    pickupInfo.addEventListener("change", (e) => {
      const addressInput = document.getElementById("cust-address");
      if (e.target.value === "envio") {
        addressGroup.style.display = "block";
        if (addressInput) addressInput.setAttribute("required", "required");
      } else {
        addressGroup.style.display = "none";
        if (addressInput) {
          addressInput.removeAttribute("required");
          addressInput.value = "";
          addressInput.classList.remove("form-control--error");
        }
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const cartSidebar = document.getElementById("cart-sidebar");
      const menuSidebar = document.getElementById("mobile-menu-sidebar");
      if (cartSidebar && cartSidebar.classList.contains("cart-sidebar--active"))
        toggleCart();
      if (
        menuSidebar &&
        menuSidebar.classList.contains("mobile-menu-sidebar--active")
      )
        toggleMobileMenu();
    }
  });

  loadCatalog();

  // Sync initial metrics
  updateCartIndicators();
  renderCheckoutLiveSummary();
}

// Run immediately if DOM is already ready, or on DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// Register the Worker service for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("PWA: Service Worker registrado.", reg))
      .catch((err) => console.log("PWA: Error al registrar.", err));
  });
}
