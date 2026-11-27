
// ============================================
// ScanSpend – Expense Tracker
// OMR + Smart Barcode/QR Product Memory
// ============================================

const STORAGE_KEY = 'scanspend_data_v1';
const PRODUCT_STORAGE_KEY = 'scanspend_products_v1';

// Default categories
const DEFAULT_CATEGORIES = [
  { id: 'cat_groceries', name: 'Groceries', color: '#22c55e' },
  { id: 'cat_bills', name: 'Bills', color: '#3b82f6' },
  { id: 'cat_transport', name: 'Transport', color: '#f59e0b' },
  { id: 'cat_food', name: 'Eating Out', color: '#ef4444' },
  { id: 'cat_other', name: 'Other', color: '#64748b' }
];

// State
let state = {
  expenses: [],
  categories: [...DEFAULT_CATEGORIES],
  products: []
};

let html5QrCode = null;
let currentView = 'dashboard';
let pendingScannedCode = null;
let scannerStarting = false;

// ============================================
// Persistence
// ============================================

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);

      state.expenses = Array.isArray(parsed.expenses)
        ? parsed.expenses
        : [];

      state.categories =
        Array.isArray(parsed.categories) && parsed.categories.length
          ? parsed.categories
          : [...DEFAULT_CATEGORIES];
    }
  } catch (e) {
    console.error('Expense data load error:', e);
  }

  // Product memory is stored separately.
  // This protects existing expense records.
  try {
    const productsRaw = localStorage.getItem(PRODUCT_STORAGE_KEY);

    if (productsRaw) {
      const products = JSON.parse(productsRaw);
      state.products = Array.isArray(products) ? products : [];
    }
  } catch (e) {
    console.error('Product memory load error:', e);
    state.products = [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      expenses: state.expenses,
      categories: state.categories
    }));
  } catch (e) {
    console.error('Expense save error:', e);
    showToast('Could not save expenses. Check storage space.');
  }
}

function saveProducts() {
  try {
    localStorage.setItem(
      PRODUCT_STORAGE_KEY,
      JSON.stringify(state.products)
    );
  } catch (e) {
    console.error('Product memory save error:', e);
    showToast('Could not save product memory.');
  }
}

// ============================================
// Helpers
// ============================================

function uid() {
  return 'id_' + Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7);
}

function formatMoney(n) {
  const amount = Number(n) || 0;

  return 'OMR ' + amount.toFixed(3);
}

function formatDate(iso) {
  if (!iso) return '';

  const d = new Date(iso + 'T00:00:00');

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function todayISO() {
  // Local date, not UTC date.
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthExpenses() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  return state.expenses.filter(e => {
    const d = new Date(e.date + 'T00:00:00');

    return d.getFullYear() === y &&
      d.getMonth() === m;
  });
}

function getCategory(id) {
  return state.categories.find(c => c.id === id) ||
    { name: 'Unknown', color: '#64748b' };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;

  document.body.appendChild(t);

  setTimeout(() => t.remove(), 2500);
}

function getGroceriesCategory() {
  return state.categories.find(c =>
    c.name.toLowerCase().includes('grocer')
  ) || state.categories[0];
}

// ============================================
// Product Memory
// ============================================

function findSavedProduct(code) {
  if (!code) return null;

  return state.products.find(p => p.code === code) || null;
}

function rememberProduct(code, name, price, categoryId) {
  if (!code || !name) return;

  const existing = findSavedProduct(code);

  if (existing) {
    existing.name = name;
    existing.lastPrice = Number(price) || existing.lastPrice || 0;
    existing.categoryId = categoryId || existing.categoryId;
    existing.updatedAt = Date.now();
  } else {
    state.products.push({
      id: uid(),
      code,
      name,
      lastPrice: Number(price) || 0,
      categoryId: categoryId || getGroceriesCategory()?.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  saveProducts();
}

function getProductCount() {
  return state.products.length;
}

// ============================================
// Rendering
// ============================================

function renderDashboard() {
  const monthExps = getMonthExpenses();

  const total = monthExps.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0
  );

  document.getElementById('month-total').textContent =
    formatMoney(total);

  document.getElementById('month-count').textContent =
    monthExps.length +
    (monthExps.length === 1 ? ' expense' : ' expenses');

  const recent = [...state.expenses]
    .sort((a, b) =>
      b.date.localeCompare(a.date) ||
      (b.created || 0) - (a.created || 0)
    )
    .slice(0, 8);

  renderExpenseList('recent-list', recent);
}

function renderHistory() {
  const filter = document.getElementById('filter-category').value;

  let list = [...state.expenses].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    (b.created || 0) - (a.created || 0)
  );

  if (filter !== 'all') {
    list = list.filter(e => e.categoryId === filter);
  }

  renderExpenseList('history-list', list);
}

function renderExpenseList(containerId, expenses) {
  const el = document.getElementById(containerId);

  if (!expenses.length) {
    el.innerHTML =
      `<div class="empty-state">
        No expenses yet.<br>
        Scan a barcode or add one manually!
      </div>`;
    return;
  }

  el.innerHTML = expenses.map(e => {
    const cat = getCategory(e.categoryId);

    return `
      <div class="expense-item" data-id="${escapeHtml(e.id)}">
        <div class="expense-color"
             style="background:${escapeHtml(cat.color)}"></div>

        <div class="expense-info">
          <div class="expense-name">
            ${escapeHtml(e.name)}
          </div>

          <div class="expense-meta">
            ${escapeHtml(cat.name)} · ${formatDate(e.date)}
            ${e.note ? ' · ' + escapeHtml(e.note) : ''}
          </div>
        </div>

        <div class="expense-amount">
          ${formatMoney(e.amount)}
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.expense-item').forEach(item => {
    item.addEventListener('click', () => {
      openExpenseModal(item.dataset.id);
    });
  });
}

function renderCategories() {
  const el = document.getElementById('categories-list');

  el.innerHTML = state.categories.map(c => `
    <div class="category-item" data-id="${escapeHtml(c.id)}">
      <div class="category-swatch"
           style="background:${escapeHtml(c.color)}"></div>

      <div class="category-name">
        ${escapeHtml(c.name)}
      </div>

      <div class="category-actions">
        <button class="cat-btn edit-cat" title="Edit">✏️</button>
        <button class="cat-btn delete-cat" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.edit-cat').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();

      const id = btn.closest('.category-item').dataset.id;
      openCategoryModal(id);
    });
  });

  el.querySelectorAll('.delete-cat').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();

      const id = btn.closest('.category-item').dataset.id;
      deleteCategory(id);
    });
  });
}

function populateCategorySelects() {
  const expSelect = document.getElementById('expense-category');
  const filterSelect = document.getElementById('filter-category');

  const previousExpenseCategory = expSelect.value;
  const previousFilter = filterSelect.value || 'all';

  expSelect.innerHTML = state.categories.map(c =>
    `<option value="${escapeHtml(c.id)}">
      ${escapeHtml(c.name)}
    </option>`
  ).join('');

  filterSelect.innerHTML =
    `<option value="all">All Categories</option>` +
    state.categories.map(c =>
      `<option value="${escapeHtml(c.id)}">
        ${escapeHtml(c.name)}
      </option>`
    ).join('');

  if (state.categories.some(c => c.id === previousExpenseCategory)) {
    expSelect.value = previousExpenseCategory;
  }

  filterSelect.value =
    previousFilter === 'all' ||
    state.categories.some(c => c.id === previousFilter)
      ? previousFilter
      : 'all';
}

// ============================================
// Navigation
// ============================================

function showView(name) {
  currentView = name;

  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
  });

  const target = document.getElementById('view-' + name);

  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });

  const titles = {
    dashboard: 'ScanSpend',
    history: 'History',
    categories: 'Categories'
  };

  document.getElementById('page-title').textContent =
    titles[name] || 'ScanSpend';

  if (name === 'dashboard') renderDashboard();
  if (name === 'history') renderHistory();
  if (name === 'categories') renderCategories();
}

// ============================================
// Expense Modal
// ============================================

function openExpenseModal(id = null, prefill = {}) {
  const modal = document.getElementById('modal-expense');
  const form = document.getElementById('form-expense');

  form.reset();

  document.getElementById('expense-id').value = id || '';
  document.getElementById('expense-date').value =
    prefill.date || todayISO();

  if (id) {
    const exp = state.expenses.find(e => e.id === id);

    if (!exp) return;

    document.getElementById('expense-modal-title').textContent =
      'Edit Expense';

    document.getElementById('expense-name').value = exp.name;
    document.getElementById('expense-amount').value = exp.amount;
    document.getElementById('expense-category').value =
      exp.categoryId;

    document.getElementById('expense-date').value = exp.date;
    document.getElementById('expense-note').value = exp.note || '';

  } else {
    document.getElementById('expense-modal-title').textContent =
      'Add Expense';

    document.getElementById('expense-name').value =
      prefill.name || '';

    if (prefill.amount !== undefined && prefill.amount !== null) {
      document.getElementById('expense-amount').value =
        prefill.amount;
    }

    if (prefill.categoryId) {
      document.getElementById('expense-category').value =
        prefill.categoryId;
    } else {
      const groc = getGroceriesCategory();

      if (groc) {
        document.getElementById('expense-category').value = groc.id;
      }
    }

    if (prefill.note) {
      document.getElementById('expense-note').value = prefill.note;
    }
  }

  modal.classList.remove('hidden');

  setTimeout(() => {
    document.getElementById('expense-name').focus();
  }, 100);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');

  if (id === 'modal-scanner') {
    stopScanner();
  }

  if (id === 'modal-expense') {
    pendingScannedCode = null;
  }
}

// ============================================
// Category Modal
// ============================================

function openCategoryModal(id = null) {
  const modal = document.getElementById('modal-category');

  document.getElementById('form-category').reset();
  document.getElementById('category-id').value = id || '';

  document.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.remove('selected');
  });

  const defaultColor = '#22c55e';

  document.getElementById('category-color').value = defaultColor;

  document.querySelector(
    `.color-swatch[data-color="${defaultColor}"]`
  )?.classList.add('selected');

  if (id) {
    const cat = state.categories.find(c => c.id === id);

    if (!cat) return;

    document.getElementById('category-modal-title').textContent =
      'Edit Category';

    document.getElementById('category-name').value = cat.name;
    document.getElementById('category-color').value = cat.color;

    document.querySelectorAll('.color-swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.color === cat.color);
    });

  } else {
    document.getElementById('category-modal-title').textContent =
      'Add Category';
  }

  modal.classList.remove('hidden');

  setTimeout(() => {
    document.getElementById('category-name').focus();
  }, 100);
}

function deleteCategory(id) {
  const cat = state.categories.find(c => c.id === id);

  if (!cat) return;

  const used = state.expenses.some(e => e.categoryId === id);

  if (used) {
    if (!confirm(
      `"${cat.name}" is used by some expenses.\n` +
      'Delete it anyway? Existing expenses will remain.'
    )) return;
  } else {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
  }

  state.categories = state.categories.filter(c => c.id !== id);

  saveData();
  populateCategorySelects();
  renderCategories();

  showToast('Category deleted');
}

// ============================================
// Export to Excel
// ============================================

function exportToExcel() {
  if (!state.expenses.length) {
    showToast('No expenses to export');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showToast('Excel library is not available');
    return;
  }

  const filter =
    document.getElementById('filter-category')?.value || 'all';

  let list = [...state.expenses].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    (b.created || 0) - (a.created || 0)
  );

  if (filter !== 'all') {
    list = list.filter(e => e.categoryId === filter);
  }

  if (!list.length) {
    showToast('No expenses match the filter');
    return;
  }

  const rows = list.map(e => {
    const cat = getCategory(e.categoryId);

    return {
      Date: e.date,
      Name: e.name,
      Category: cat.name,
      Amount_OMR: Number(e.amount) || 0,
      Note: e.note || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

  ws['!cols'] = [
    { wch: 12 },
    { wch: 35 },
    { wch: 15 },
    { wch: 15 },
    { wch: 25 }
  ];

  XLSX.writeFile(
    wb,
    `ScanSpend_Expenses_${todayISO()}.xlsx`
  );

  showToast('Excel downloaded!');
}

// ============================================
// Smart Barcode / QR Scanner
// ============================================

async function startScanner() {
  if (scannerStarting || html5QrCode) return;

  const modal = document.getElementById('modal-scanner');

  modal.classList.remove('hidden');

  if (typeof Html5Qrcode === 'undefined') {
    showToast('Scanner library not loaded');
    modal.classList.add('hidden');
    return;
  }

  scannerStarting = true;

  try {
    html5QrCode = new Html5Qrcode('reader');

    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777
      },
      onScanSuccess,
      () => {}
    );

  } catch (err) {
    console.error('Scanner start error:', err);

    html5QrCode = null;

    showToast('Camera unavailable. Check camera permission.');

    modal.classList.add('hidden');

  } finally {
    scannerStarting = false;
  }
}

async function stopScanner() {
  if (!html5QrCode) return;

  const scanner = html5QrCode;

  html5QrCode = null;

  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }

    scanner.clear();

  } catch (err) {
    console.log('Scanner stop:', err);
  }
}

// ============================================
// QR Data Handling
// ============================================

function parseQrPayload(rawText) {
  const result = {
    code: String(rawText || '').trim(),
    name: '',
    amount: null
  };

  if (!result.code) return result;

  // Some QR codes contain JSON product information.
  try {
    const obj = JSON.parse(result.code);

    if (obj && typeof obj === 'object') {
      result.name =
        obj.product_name ||
        obj.product ||
        obj.name ||
        obj.description ||
        '';

      const possibleAmount =
        obj.total ||
        obj.price ||
        obj.amount ||
        obj.selling_price;

      if (possibleAmount !== undefined) {
        const parsed = parseFloat(
          String(possibleAmount).replace(/[^\d.]/g, '')
        );

        if (Number.isFinite(parsed)) {
          result.amount = parsed;
        }
      }

      // If the QR includes a separate product code,
      // use it as the product-memory key.
      if (obj.barcode || obj.ean || obj.code) {
        result.code = String(
          obj.barcode || obj.ean || obj.code
        ).trim();
      }
    }
  } catch (e) {
    // Normal text or URL QR. Keep the raw content.
  }

  return result;
}

function isStandardBarcode(code) {
  // EAN-8, UPC-A, EAN-13 and common numeric barcodes.
  return /^\d{8,14}$/.test(code);
}

// ============================================
// Open Food Facts Lookup
// ============================================

async function lookupOnlineProduct(code) {
  if (!isStandardBarcode(code)) return null;

  try {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      7000
    );

    const url =
      `https://world.openfoodfacts.org/api/v2/product/` +
      `${encodeURIComponent(code)}.json`;

    const response = await fetch(url, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const p = data.product;

    const name =
      p.product_name ||
      p.generic_name ||
      '';

    if (!name) return null;

    return {
      name: p.brands
        ? `${name} (${p.brands})`
        : name,
      amount: null
    };

  } catch (err) {
    console.log('Online product lookup unavailable:', err);
    return null;
  }
}

// ============================================
// Successful Scan
// ============================================

async function onScanSuccess(decodedText) {
  // Stop the camera before opening the expense form.
  await stopScanner();

  document.getElementById('modal-scanner')
    .classList.add('hidden');

  const scanned = parseQrPayload(decodedText);
  const code = scanned.code;

  if (!code) {
    showToast('Could not read this code. Try again.');
    return;
  }

  showToast('Checking product memory…');

  // 1. Check local product memory first.
  const saved = findSavedProduct(code);

  if (saved) {
    pendingScannedCode = code;

    openExpenseModal(null, {
      name: saved.name,
      amount: saved.lastPrice || '',
      categoryId: saved.categoryId || getGroceriesCategory()?.id
    });

    showToast('Saved product recognised!');
    return;
  }

  // 2. If QR contains product details, use them.
  if (scanned.name) {
    pendingScannedCode = code;

    openExpenseModal(null, {
      name: scanned.name,
      amount: scanned.amount ?? '',
      categoryId: getGroceriesCategory()?.id
    });

    showToast('QR product information found');
    return;
  }

  // 3. Try international barcode database.
  showToast('Looking up barcode…');

  const onlineProduct = await lookupOnlineProduct(code);

  if (onlineProduct) {
    pendingScannedCode = code;

    openExpenseModal(null, {
      name: onlineProduct.name,
      categoryId: getGroceriesCategory()?.id
    });

    showToast('Product found. Check the price.');
    return;
  }

  // 4. Unknown/local code.
  // User enters product name and price.
  pendingScannedCode = code;

  openExpenseModal(null, {
    name: '',
    categoryId: getGroceriesCategory()?.id,
    note: ''
  });

  showToast('New product. Enter its details to save it.');
}

// ============================================
// Event Listeners
// ============================================

function initEvents() {

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.view);
    });
  });

  document.getElementById('btn-categories')
    .addEventListener('click', () => {
      showView('categories');
    });

  document.getElementById('btn-view-all')
    .addEventListener('click', () => {
      showView('history');
    });

  // Scan and manual entry
  document.getElementById('btn-scan')
    .addEventListener('click', startScanner);

  document.getElementById('btn-manual')
    .addEventListener('click', () => {
      pendingScannedCode = null;
      openExpenseModal();
    });

  document.getElementById('btn-stop-scan')
    .addEventListener('click', () => {
      closeModal('modal-scanner');
    });

  // Close modals
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.close);
    });
  });

  // Add category
  document.getElementById('btn-add-category')
    .addEventListener('click', () => {
      openCategoryModal();
    });

  // Category colour picker
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.remove('selected');
      });

      swatch.classList.add('selected');

      document.getElementById('category-color').value =
        swatch.dataset.color;
    });
  });

  // ========================================
  // Expense Form
  // ========================================

  document.getElementById('form-expense')
    .addEventListener('submit', e => {
      e.preventDefault();

      const id = document.getElementById('expense-id').value;

      const name = document.getElementById('expense-name')
        .value.trim();

      const amount = parseFloat(
        document.getElementById('expense-amount').value
      ) || 0;

      const categoryId =
        document.getElementById('expense-category').value;

      const date =
        document.getElementById('expense-date').value;

      const note =
        document.getElementById('expense-note').value.trim();

      if (!name) {
        showToast('Please enter a product name');
        return;
      }

      if (amount <= 0) {
        showToast('Please enter a valid amount');
        return;
      }

      if (!date) {
        showToast('Please select a date');
        return;
      }

      const data = {
        name,
        amount,
        categoryId,
        date,
        note,
        created: Date.now()
      };

      if (id) {
        // Update existing expense without changing its ID.
        const idx = state.expenses.findIndex(e => e.id === id);

        if (idx !== -1) {
          state.expenses[idx] = {
            ...state.expenses[idx],
            ...data
          };
        }

        showToast('Expense updated');

      } else {
        // Add new expense.
        state.expenses.push({
          id: uid(),
          ...data
        });

        showToast('Expense added');

        // Save scanned product for future recognition.
        if (pendingScannedCode) {
          rememberProduct(
            pendingScannedCode,
            name,
            amount,
            categoryId
          );

          showToast('Product saved for future scans');
        }
      }

      pendingScannedCode = null;

      saveData();

      closeModal('modal-expense');

      if (currentView === 'dashboard') renderDashboard();
      if (currentView === 'history') renderHistory();
    });

  // ========================================
  // Category Form
  // ========================================

  document.getElementById('form-category')
    .addEventListener('submit', e => {
      e.preventDefault();

      const id = document.getElementById('category-id').value;

      const name = document.getElementById('category-name')
        .value.trim();

      const color =
        document.getElementById('category-color').value;

      if (!name) return;

      if (id) {
        const cat = state.categories.find(c => c.id === id);

        if (cat) {
          cat.name = name;
          cat.color = color;
        }

        showToast('Category updated');

      } else {
        if (state.categories.some(c =>
          c.name.toLowerCase() === name.toLowerCase()
        )) {
          showToast('Category already exists');
          return;
        }

        state.categories.push({
          id: uid(),
          name,
          color
        });

        showToast('Category added');
      }

      saveData();

      populateCategorySelects();

      closeModal('modal-category');

      renderCategories();
    });

  // History filter
  document.getElementById('filter-category')
    .addEventListener('change', renderHistory);

  // Excel export
  document.getElementById('btn-export-excel')
    .addEventListener('click', exportToExcel);

  // Close modal by clicking outside.
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

// ============================================
// App Initialisation
// ============================================

function init() {
  loadData();
  populateCategorySelects();
  initEvents();
  showView('dashboard');

  console.log('ScanSpend ready');
  console.log('Saved expenses:', state.expenses.length);
  console.log('Saved products:', getProductCount());
}

init();
