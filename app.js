// ======================
// ScanSpend – Expense Tracker
// ======================

const STORAGE_KEY = 'scanspend_data_v1';

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
  categories: [...DEFAULT_CATEGORIES]
};

let html5QrCode = null;
let currentView = 'dashboard';

// ---------- Persistence ----------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.expenses = parsed.expenses || [];
      state.categories = parsed.categories && parsed.categories.length
        ? parsed.categories
        : [...DEFAULT_CATEGORIES];
    }
  } catch (e) {
    console.error('Load error', e);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    expenses: state.expenses,
    categories: state.categories
  }));
}

// ---------- Helpers ----------
function uid() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatMoney(n) {
  return '$' + Number(n).toFixed(2);
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthExpenses() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return state.expenses.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

function getCategory(id) {
  return state.categories.find(c => c.id === id) || { name: 'Unknown', color: '#64748b' };
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ---------- Rendering ----------
function renderDashboard() {
  const monthExps = getMonthExpenses();
  const total = monthExps.reduce((s, e) => s + e.amount, 0);
  document.getElementById('month-total').textContent = formatMoney(total);
  document.getElementById('month-count').textContent =
    monthExps.length + (monthExps.length === 1 ? ' expense' : ' expenses');

  const recent = [...state.expenses]
    .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created)
    .slice(0, 8);

  renderExpenseList('recent-list', recent);
}

function renderHistory() {
  const filter = document.getElementById('filter-category').value;
  let list = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
  if (filter !== 'all') {
    list = list.filter(e => e.categoryId === filter);
  }
  renderExpenseList('history-list', list);
}

function renderExpenseList(containerId, expenses) {
  const el = document.getElementById(containerId);
  if (!expenses.length) {
    el.innerHTML = `<div class="empty-state">No expenses yet.<br>Scan a barcode or add one manually!</div>`;
    return;
  }
  el.innerHTML = expenses.map(e => {
    const cat = getCategory(e.categoryId);
    return `
      <div class="expense-item" data-id="${e.id}">
        <div class="expense-color" style="background:${cat.color}"></div>
        <div class="expense-info">
          <div class="expense-name">${escapeHtml(e.name)}</div>
          <div class="expense-meta">${cat.name} · ${formatDate(e.date)}${e.note ? ' · ' + escapeHtml(e.note) : ''}</div>
        </div>
        <div class="expense-amount">${formatMoney(e.amount)}</div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.expense-item').forEach(item => {
    item.addEventListener('click', () => openExpenseModal(item.dataset.id));
  });
}

function renderCategories() {
  const el = document.getElementById('categories-list');
  el.innerHTML = state.categories.map(c => `
    <div class="category-item" data-id="${c.id}">
      <div class="category-swatch" style="background:${c.color}"></div>
      <div class="category-name">${escapeHtml(c.name)}</div>
      <div class="category-actions">
        <button class="cat-btn edit-cat" title="Edit">✏️</button>
        <button class="cat-btn delete-cat" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.edit-cat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.category-item').dataset.id;
      openCategoryModal(id);
    });
  });

  el.querySelectorAll('.delete-cat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.category-item').dataset.id;
      deleteCategory(id);
    });
  });
}

function populateCategorySelects() {
  const selects = [
    document.getElementById('expense-category'),
    document.getElementById('filter-category')
  ];

  // Expense form select
  const expSelect = selects[0];
  expSelect.innerHTML = state.categories.map(c =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join('');

  // Filter select
  const filterSelect = selects[1];
  const current = filterSelect.value || 'all';
  filterSelect.innerHTML = `<option value="all">All Categories</option>` +
    state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  filterSelect.value = current;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------- Navigation ----------
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });

  const titles = {
    dashboard: 'ScanSpend',
    history: 'History',
    categories: 'Categories'
  };
  document.getElementById('page-title').textContent = titles[name] || 'ScanSpend';

  if (name === 'dashboard') renderDashboard();
  if (name === 'history') renderHistory();
  if (name === 'categories') renderCategories();
}

// ---------- Expense Modal ----------
function openExpenseModal(id = null, prefill = {}) {
  const modal = document.getElementById('modal-expense');
  const form = document.getElementById('form-expense');
  form.reset();

  document.getElementById('expense-id').value = id || '';
  document.getElementById('expense-date').value = prefill.date || todayISO();

  if (id) {
    const exp = state.expenses.find(e => e.id === id);
    if (!exp) return;
    document.getElementById('expense-modal-title').textContent = 'Edit Expense';
    document.getElementById('expense-name').value = exp.name;
    document.getElementById('expense-amount').value = exp.amount;
    document.getElementById('expense-category').value = exp.categoryId;
    document.getElementById('expense-date').value = exp.date;
    document.getElementById('expense-note').value = exp.note || '';
  } else {
    document.getElementById('expense-modal-title').textContent = 'Add Expense';
    if (prefill.name) document.getElementById('expense-name').value = prefill.name;
    if (prefill.amount) document.getElementById('expense-amount').value = prefill.amount;
    if (prefill.categoryId) document.getElementById('expense-category').value = prefill.categoryId;
    // Default to Groceries if available
    if (!prefill.categoryId) {
      const groc = state.categories.find(c => c.name.toLowerCase().includes('grocer'));
      if (groc) document.getElementById('expense-category').value = groc.id;
    }
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('expense-name').focus(), 100);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (id === 'modal-scanner') stopScanner();
}

// ---------- Category Modal ----------
function openCategoryModal(id = null) {
  const modal = document.getElementById('modal-category');
  document.getElementById('form-category').reset();
  document.getElementById('category-id').value = id || '';

  // Reset color selection
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  const defaultColor = '#22c55e';
  document.getElementById('category-color').value = defaultColor;
  document.querySelector(`.color-swatch[data-color="${defaultColor}"]`)?.classList.add('selected');

  if (id) {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('category-modal-title').textContent = 'Edit Category';
    document.getElementById('category-name').value = cat.name;
    document.getElementById('category-color').value = cat.color;
    document.querySelectorAll('.color-swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.color === cat.color);
    });
  } else {
    document.getElementById('category-modal-title').textContent = 'Add Category';
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('category-name').focus(), 100);
}

function deleteCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;

  const used = state.expenses.some(e => e.categoryId === id);
  if (used) {
    if (!confirm(`"${cat.name}" is used by some expenses.\nDelete it anyway? Expenses will keep the old name but lose the color.`)) {
      return;
    }
  } else {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
  }

  state.categories = state.categories.filter(c => c.id !== id);
  saveData();
  populateCategorySelects();
  renderCategories();
  showToast('Category deleted');
}

// ---------- Export to Excel ----------
function exportToExcel() {
  if (!state.expenses.length) {
    showToast('No expenses to export');
    return;
  }

  // Respect current filter if on History view
  const filter = document.getElementById('filter-category')?.value || 'all';
  let list = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
  if (filter !== 'all') {
    list = list.filter(e => e.categoryId === filter);
  }

  if (!list.length) {
    showToast('No expenses match the filter');
    return;
  }

  // Prepare data for Excel
  const rows = list.map(e => {
    const cat = getCategory(e.categoryId);
    return {
      Date: e.date,
      Name: e.name,
      Category: cat.name,
      Amount: e.amount,
      Note: e.note || ''
    };
  });

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

  // Auto column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 35 }, // Name
    { wch: 15 }, // Category
    { wch: 10 }, // Amount
    { wch: 25 }  // Note
  ];
  ws['!cols'] = colWidths;

  // Generate filename with today's date
  const today = todayISO();
  const filename = `ScanSpend_Expenses_${today}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
  showToast('Excel downloaded!');
}

// ---------- Scanner ----------
async function startScanner() {
  const modal = document.getElementById('modal-scanner');
  modal.classList.remove('hidden');

  html5QrCode = new Html5Qrcode('reader');

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777
      },
      onScanSuccess,
      () => {} // ignore failures
    );
  } catch (err) {
    console.error(err);
    showToast('Camera permission denied or not available');
    closeModal('modal-scanner');
  }
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      html5QrCode = null;
    }).catch(() => {});
  }
}

async function onScanSuccess(decodedText) {
  stopScanner();
  closeModal('modal-scanner');

  // Show loading state briefly
  showToast('Looking up product…');

  let productName = decodedText;
  try {
    // Open Food Facts API
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${decodedText}.json`);
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      productName = p.product_name || p.generic_name || p.brands || decodedText;
      if (p.brands && p.product_name) {
        productName = `${p.product_name} (${p.brands})`;
      }
    }
  } catch (e) {
    console.log('Lookup failed, using barcode as name');
  }

  // Open expense form with product name prefilled, default to Groceries
  const groc = state.categories.find(c => c.name.toLowerCase().includes('grocer'));
  openExpenseModal(null, {
    name: productName,
    categoryId: groc ? groc.id : state.categories[0]?.id
  });
}

// ---------- Event Listeners ----------
function initEvents() {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  document.getElementById('btn-categories').addEventListener('click', () => showView('categories'));
  document.getElementById('btn-view-all').addEventListener('click', () => showView('history'));

  // Scan & Manual
  document.getElementById('btn-scan').addEventListener('click', startScanner);
  document.getElementById('btn-manual').addEventListener('click', () => openExpenseModal());
  document.getElementById('btn-stop-scan').addEventListener('click', () => closeModal('modal-scanner'));

  // Close modals
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Add category button
  document.getElementById('btn-add-category').addEventListener('click', () => openCategoryModal());

  // Color picker
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      document.getElementById('category-color').value = swatch.dataset.color;
    });
  });

  // Expense form submit
  document.getElementById('form-expense').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('expense-id').value;
    const data = {
      name: document.getElementById('expense-name').value.trim(),
      amount: parseFloat(document.getElementById('expense-amount').value) || 0,
      categoryId: document.getElementById('expense-category').value,
      date: document.getElementById('expense-date').value,
      note: document.getElementById('expense-note').value.trim(),
      created: Date.now()
    };

    if (id) {
      // Edit
      const idx = state.expenses.findIndex(e => e.id === id);
      if (idx !== -1) {
        state.expenses[idx] = { ...state.expenses[idx], ...data };
      }
      showToast('Expense updated');
    } else {
      // New
      state.expenses.push({ id: uid(), ...data });
      showToast('Expense added');
    }

    saveData();
    closeModal('modal-expense');
    if (currentView === 'dashboard') renderDashboard();
    if (currentView === 'history') renderHistory();
  });

  // Category form submit
  document.getElementById('form-category').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value.trim();
    const color = document.getElementById('category-color').value;

    if (!name) return;

    if (id) {
      const cat = state.categories.find(c => c.id === id);
      if (cat) {
        cat.name = name;
        cat.color = color;
      }
      showToast('Category updated');
    } else {
      // Prevent duplicates
      if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        showToast('Category already exists');
        return;
      }
      state.categories.push({ id: uid(), name, color });
      showToast('Category added');
    }

    saveData();
    populateCategorySelects();
    closeModal('modal-category');
    renderCategories();
  });

  // Filter change
  document.getElementById('filter-category').addEventListener('change', renderHistory);

  // Export to Excel
  document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);

  // Close modal on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

// ---------- Init ----------
function init() {
  loadData();
  populateCategorySelects();
  initEvents();
  showView('dashboard');
}

init();
