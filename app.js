/* ============================================================
   ExpenseIQ — app.js
   All state, rendering, chart, localStorage, events
============================================================ */

// ── CATEGORIES ───────────────────────────────────────────────
const DEFAULT_CATS = [
  { id:'food',          name:'Food & Dining',  icon:'🍔', color:'#f59e0b', type:'expense' },
  { id:'transport',     name:'Transport',      icon:'🚗', color:'#3b82f6', type:'expense' },
  { id:'shopping',      name:'Shopping',       icon:'🛍️', color:'#ec4899', type:'expense' },
  { id:'utilities',     name:'Utilities',      icon:'💡', color:'#8b5cf6', type:'expense' },
  { id:'housing',       name:'Housing',        icon:'🏠', color:'#6366f1', type:'expense' },
  { id:'healthcare',    name:'Healthcare',     icon:'💊', color:'#ef4444', type:'expense' },
  { id:'entertainment', name:'Entertainment',  icon:'🎮', color:'#10b981', type:'expense' },
  { id:'education',     name:'Education',      icon:'📚', color:'#0ea5e9', type:'expense' },
  { id:'travel',        name:'Travel',         icon:'✈️', color:'#14b8a6', type:'expense' },
  { id:'salary',        name:'Salary',         icon:'💼', color:'#22c55e', type:'income'  },
  { id:'freelance',     name:'Freelance',      icon:'💻', color:'#a3e635', type:'income'  },
  { id:'investment',    name:'Investment',     icon:'📈', color:'#06b6d4', type:'income'  },
  { id:'other-income',  name:'Other Income',   icon:'💰', color:'#84cc16', type:'income'  },
  { id:'other',         name:'Other',          icon:'📦', color:'#94a3b8', type:'expense' },
];

// ── STATE ─────────────────────────────────────────────────────
let state = {
  transactions: [],
  budgets: {},
  settings: { currency: '₹', customCats: [], spendingLimit: 0 },
  currentMonth: new Date().getMonth(),
  currentYear:  new Date().getFullYear(),
};

// ── PERSISTENCE ───────────────────────────────────────────────
function save() {
  localStorage.setItem('eiq_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('eiq_budgets',      JSON.stringify(state.budgets));
  localStorage.setItem('eiq_settings',     JSON.stringify(state.settings));
}
function load() {
  try { state.transactions = JSON.parse(localStorage.getItem('eiq_transactions')) || []; } catch { state.transactions = []; }
  try { state.budgets      = JSON.parse(localStorage.getItem('eiq_budgets'))      || {}; } catch { state.budgets = {}; }
  try { state.settings     = { currency:'₹', customCats:[], spendingLimit:0, ...JSON.parse(localStorage.getItem('eiq_settings')) }; } catch {}
}

// ── HELPERS ───────────────────────────────────────────────────
function allCats()        { return [...DEFAULT_CATS, ...state.settings.customCats]; }
function getCat(id)       { return allCats().find(c => c.id === id) || { name:id, icon:'📦', color:'#94a3b8', type:'expense' }; }
function cur()            { return state.settings.currency; }
function fmt(n)           { return cur() + Number(n).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
function uid()            { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function toDateStr(d)     { return d.toISOString().split('T')[0]; }
function fmtDate(str)     { return new Date(str + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }

function monthTxns() {
  return state.transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === state.currentMonth && d.getFullYear() === state.currentYear;
  });
}
function monthLabel() {
  return new Date(state.currentYear, state.currentMonth, 1)
    .toLocaleDateString('en-IN', { month:'long', year:'numeric' });
}

// ── CONFIRM DIALOG ────────────────────────────────────────────
function showConfirm(msg, onOk) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-modal').classList.add('open');
  document.getElementById('confirm-ok').onclick = () => {
    closeModal('confirm-modal');
    onOk();
  };
}

// ── MODAL HELPERS ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── TOAST NOTIFICATIONS ────────────────────────────────────
const TOAST_ICONS = { danger:'🚨', success:'✅', info:'ℹ️' };
function showToast(msg, type = 'info', duration = 5000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type]}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 320);
  }, duration);
}

// ── NAVIGATION ────────────────────────────────────────────────
const VIEW_TITLES = { dashboard:'Dashboard', transactions:'Transactions', budgets:'Budgets', settings:'Settings' };
function navigate(view) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + view));
  document.getElementById('topbar-title').textContent = VIEW_TITLES[view] || view;
  if (view === 'transactions') renderAllTxns();
  if (view === 'budgets')      renderBudgets();
  if (view === 'settings')     renderSettings();
  closeSidebar();
}

// ── RENDER DASHBOARD ──────────────────────────────────────────
function renderDashboard() {
  document.getElementById('month-label').textContent = monthLabel();
  const txns = monthTxns();
  const income  = txns.filter(t => t.type === 'income').reduce((s,t)  => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance = income - expense;
  const savings = income > 0 ? Math.round((balance / income) * 100) : 0;

  document.getElementById('d-balance').textContent   = fmt(balance);
  document.getElementById('d-income').textContent    = fmt(income);
  document.getElementById('d-expense').textContent   = fmt(expense);
  document.getElementById('d-savings').textContent   = savings + '%';
  const iCt = txns.filter(t => t.type === 'income').length;
  const eCt = txns.filter(t => t.type === 'expense').length;
  document.getElementById('d-income-ct').textContent  = iCt + ' transaction' + (iCt !== 1 ? 's' : '');
  document.getElementById('d-expense-ct').textContent = eCt + ' transaction' + (eCt !== 1 ? 's' : '');

  renderChart(txns);
  renderDailyChart(txns);
  renderRecentTxns(txns);
  checkSpendingAlert();
}

// ── DONUT CHART ───────────────────────────────────────────────
function renderChart(txns) {
  const expenses = txns.filter(t => t.type === 'expense');
  const emptyChart = document.getElementById('empty-chart');
  const chartBody  = document.querySelector('.chart-body');
  if (!expenses.length) {
    emptyChart.classList.remove('hidden');
    chartBody.classList.add('hidden');
    return;
  }
  emptyChart.classList.add('hidden');
  chartBody.classList.remove('hidden');

  // Group by category
  const groups = {};
  expenses.forEach(t => { groups[t.category] = (groups[t.category] || 0) + t.amount; });
  const total = Object.values(groups).reduce((s,v) => s + v, 0);

  document.getElementById('donut-total').textContent = fmt(total);

  const R = 76;
  const CIRC = 2 * Math.PI * R;
  const segsEl = document.getElementById('donut-segs');
  const legendEl = document.getElementById('chart-legend');
  segsEl.innerHTML = '';
  legendEl.innerHTML = '';

  let offset = 0;
  Object.entries(groups)
    .sort((a,b) => b[1] - a[1])
    .forEach(([catId, amt]) => {
      const cat  = getCat(catId);
      const pct  = amt / total;
      const len  = pct * CIRC;
      const gap  = CIRC - len;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.classList.add('donut-seg');
      circle.setAttribute('cx', 100);
      circle.setAttribute('cy', 100);
      circle.setAttribute('r',  R);
      circle.setAttribute('stroke', cat.color);
      circle.setAttribute('stroke-dasharray', `${len} ${gap}`);
      circle.setAttribute('stroke-dashoffset', -offset);
      segsEl.appendChild(circle);

      offset += len;

      const li = document.createElement('div');
      li.className = 'leg-item';
      li.innerHTML = `<span class="leg-dot" style="background:${cat.color}"></span>${cat.icon} ${cat.name} <strong>${Math.round(pct*100)}%</strong>`;
      legendEl.appendChild(li);
    });
}

// ── DAILY EXPENSES CHART (CHART.JS) ───────────────────────────
let dailyExpensesChart = null;

function renderDailyChart(txns) {
  const ctx = document.getElementById('daily-expenses-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  const expenses = txns.filter(t => t.type === 'expense');
  
  // Get days in current month
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  
  const labels = [];
  const dataMap = {};
  
  for (let i = 1; i <= daysInMonth; i++) {
    labels.push(i);
    dataMap[i] = 0;
  }
  
  expenses.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const day = d.getDate();
    dataMap[day] += t.amount;
  });
  
  const data = labels.map(day => dataMap[day]);
  const hasData = expenses.length > 0;

  if (dailyExpensesChart) {
    dailyExpensesChart.destroy();
  }
  
  // Set default Chart.js configuration for dark theme
  Chart.defaults.color = 'rgba(255, 255, 255, 0.6)';
  Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  dailyExpensesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily Expenses',
        data: data,
        backgroundColor: hasData ? 'rgba(139, 92, 246, 0.6)' : 'rgba(255, 255, 255, 0.05)',
        borderColor: hasData ? '#8b5cf6' : 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: '#a78bfa'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(14, 20, 36, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: function(context) {
              return `Day ${context[0].label}`;
            },
            label: function(context) {
              return 'Spent: ' + fmt(context.raw);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              if (value === 0) return '';
              return String(value);
            }
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// ── RECENT TRANSACTIONS ───────────────────────────────────────
function renderRecentTxns(txns) {
  const el     = document.getElementById('recent-list');
  const sorted = [...txns].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  if (!sorted.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No transactions yet.<br/>Add your first one!</p></div>`;
    return;
  }
  el.innerHTML = sorted.map(t => txnHTML(t)).join('');
  attachTxnActions(el);
}

function txnHTML(t) {
  const cat = getCat(t.category);
  const sign = t.type === 'income' ? '+' : '-';
  return `
    <div class="txn-item" data-id="${t.id}">
      <div class="txn-icon" style="background:${cat.color}22">${cat.icon}</div>
      <div class="txn-info">
        <div class="txn-note">${esc(t.note || cat.name)}</div>
        <div class="txn-meta">${cat.name} · ${fmtDate(t.date)}</div>
      </div>
      <div class="txn-right">
        <span class="txn-amt ${t.type}">${sign}${fmt(t.amount)}</span>
        <div class="txn-actions">
          <button class="ico-btn edit" title="Edit" data-id="${t.id}">✏️</button>
          <button class="ico-btn del"  title="Delete" data-id="${t.id}">🗑</button>
        </div>
      </div>
    </div>`;
}
function esc(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function attachTxnActions(container) {
  container.querySelectorAll('.ico-btn.edit').forEach(btn => btn.onclick = () => openEditTxn(btn.dataset.id));
  container.querySelectorAll('.ico-btn.del').forEach(btn => btn.onclick  = () => {
    showConfirm('Delete this transaction?', () => { deleteTxn(btn.dataset.id); });
  });
}

// ── ALL TRANSACTIONS ──────────────────────────────────────────
function renderAllTxns() {
  const search = document.getElementById('txn-search').value.toLowerCase();
  const fType  = document.getElementById('filter-type').value;
  const fCat   = document.getElementById('filter-cat').value;

  const txns = monthTxns()
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .filter(t => {
      if (fType && t.type     !== fType) return false;
      if (fCat  && t.category !== fCat)  return false;
      if (search) {
        const cat = getCat(t.category);
        return (t.note || '').toLowerCase().includes(search) || cat.name.toLowerCase().includes(search);
      }
      return true;
    });

  const el = document.getElementById('all-list');
  if (!txns.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No transactions found.</p></div>`;
    return;
  }
  el.innerHTML = txns.map(t => txnHTML(t)).join('');
  attachTxnActions(el);
}

function populateCatFilter() {
  const sel = document.getElementById('filter-cat');
  const prev = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>' +
    allCats().map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  sel.value = prev;
}

// ── BUDGETS ───────────────────────────────────────────────────
function renderBudgets() {
  const grid = document.getElementById('budgets-grid');
  const empty = document.getElementById('empty-budgets');
  const entries = Object.entries(state.budgets);
  if (!entries.length) {
    grid.innerHTML = empty.outerHTML;
    return;
  }

  const txns = monthTxns().filter(t => t.type === 'expense');
  grid.innerHTML = entries.map(([catId, limit]) => {
    const cat   = getCat(catId);
    const spent = txns.filter(t => t.category === catId).reduce((s,t) => s + t.amount, 0);
    const pct   = Math.min((spent / limit) * 100, 100);
    const cls   = pct >= 100 ? 'danger' : pct >= 75 ? 'warn' : 'safe';
    const rem   = limit - spent;
    return `
      <div class="budget-card">
        <div class="budget-card-hdr">
          <div class="budget-cat-info">
            <span>${cat.icon}</span>
            <span>${cat.name}</span>
          </div>
          <div class="bud-actions">
            <button class="ico-btn del" title="Remove budget" data-budget-cat="${catId}">🗑</button>
          </div>
        </div>
        <div class="bud-amounts">
          <span>Spent: <strong>${fmt(spent)}</strong></span>
          <span>Limit: <strong>${fmt(limit)}</strong></span>
        </div>
        <div class="bud-track"><div class="bud-bar ${cls}" style="width:${pct}%"></div></div>
        <div class="bud-rem ${cls}">${rem >= 0 ? fmt(rem) + ' remaining' : fmt(Math.abs(rem)) + ' over budget!'}</div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-budget-cat]').forEach(btn => {
    btn.onclick = () => showConfirm('Remove this budget?', () => {
      delete state.budgets[btn.dataset.budgetCat];
      save(); renderBudgets();
    });
  });
}

// ── BUDGET MODAL ──────────────────────────────────────────────
function openBudgetModal() {
  const sel = document.getElementById('b-cat');
  sel.innerHTML = allCats().filter(c => c.type === 'expense')
    .map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  document.getElementById('b-amt').value = '';
  document.getElementById('b-pfx').textContent = cur();
  openModal('budget-modal');
}

// ── SETTINGS ──────────────────────────────────────────────────
function renderSettings() {
  document.querySelectorAll('.cur-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cur === cur());
  });
  // spending limit input
  const limitInput = document.getElementById('spending-limit-input');
  if (limitInput) {
    limitInput.value = state.settings.spendingLimit || '';
    document.getElementById('limit-pfx').textContent = cur();
  }
  // category list
  const el = document.getElementById('settings-cats');
  el.innerHTML = allCats().map(c => {
    const isCustom = state.settings.customCats.some(x => x.id === c.id);
    return `
      <div class="cat-row">
        <span class="cat-dot" style="background:${c.color}"></span>
        <span>${c.icon}</span>
        <span>${c.name}</span>
        <span class="type-badge ${c.type}">${c.type}</span>
        ${isCustom ? `<button class="cat-del" data-cat-id="${c.id}" title="Delete">✕</button>` : ''}
      </div>`;
  }).join('');
  el.querySelectorAll('.cat-del').forEach(btn => {
    btn.onclick = () => showConfirm('Delete category?', () => {
      state.settings.customCats = state.settings.customCats.filter(c => c.id !== btn.dataset.catId);
      save(); renderSettings();
    });
  });
}

// ── TRANSACTION MODAL ─────────────────────────────────────────
let currentTxnType = 'expense';

function openAddTxn() {
  document.getElementById('txn-modal-ttl').textContent = 'Add Transaction';
  document.getElementById('txn-id').value   = '';
  document.getElementById('txn-amount').value = '';
  document.getElementById('txn-note').value   = '';
  document.getElementById('txn-date').value   = toDateStr(new Date());
  setTxnType('expense');
  openModal('txn-modal');
}

function openEditTxn(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  document.getElementById('txn-modal-ttl').textContent = 'Edit Transaction';
  document.getElementById('txn-id').value     = t.id;
  document.getElementById('txn-amount').value = t.amount;
  document.getElementById('txn-note').value   = t.note || '';
  document.getElementById('txn-date').value   = t.date;
  setTxnType(t.type);
  document.getElementById('txn-cat').value = t.category;
  openModal('txn-modal');
}

function setTxnType(type) {
  currentTxnType = type;
  const expBtn = document.getElementById('type-expense');
  const incBtn = document.getElementById('type-income');
  expBtn.classList.toggle('active', type === 'expense');
  incBtn.classList.toggle('active', type === 'income');
  // Populate categories for type
  const sel = document.getElementById('txn-cat');
  sel.innerHTML = allCats().filter(c => c.type === type)
    .map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  document.getElementById('txn-pfx').textContent = cur();
}

function saveTxn(e) {
  e.preventDefault();
  const id     = document.getElementById('txn-id').value;
  const amount = parseFloat(document.getElementById('txn-amount').value);
  const cat    = document.getElementById('txn-cat').value;
  const note   = document.getElementById('txn-note').value.trim();
  const date   = document.getElementById('txn-date').value;
  if (!amount || !cat || !date) return;

  if (id) {
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx > -1) state.transactions[idx] = { id, type:currentTxnType, amount, category:cat, note, date };
  } else {
    state.transactions.push({ id:uid(), type:currentTxnType, amount, category:cat, note, date });
  }
  save();
  closeModal('txn-modal');
  refreshAll();
}

function deleteTxn(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  save();
  refreshAll();
}

function refreshAll() {
  renderDashboard();
  renderAllTxns();
  renderBudgets();
}

// ── SPENDING ALERT ──────────────────────────────────────────
let alertShownForMonth = null; // track so toast only fires once per month
function checkSpendingAlert() {
  const limit  = Number(state.settings.spendingLimit) || 0;
  const banner = document.getElementById('spend-alert-banner');
  const detail = document.getElementById('alert-detail');
  if (!limit) { banner.classList.add('hidden'); return; }

  const spent = monthTxns()
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const exceeded = spent > limit;
  banner.classList.toggle('hidden', !exceeded);

  if (exceeded) {
    const over = spent - limit;
    detail.textContent = `You've spent ${fmt(spent)} — ${fmt(over)} over your ${fmt(limit)} limit.`;
    // Only show toast once per month crossing
    const key = `${state.currentYear}-${state.currentMonth}`;
    if (alertShownForMonth !== key) {
      alertShownForMonth = key;
      showToast(`⚠️ Spending limit exceeded! Over by ${fmt(over)}.`, 'danger', 7000);
    }
  } else {
    alertShownForMonth = null;
  }
}

// ── EXPORT CSV ────────────────────────────────────────────────
function exportCSV() {
  const txns = monthTxns().sort((a,b) => new Date(a.date) - new Date(b.date));
  if (!txns.length) { alert('No transactions this month to export.'); return; }
  const rows = [['Date','Type','Category','Note','Amount']];
  txns.forEach(t => {
    const cat = getCat(t.category);
    rows.push([t.date, t.type, cat.name, t.note || '', t.amount]);
  });
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href:url, download:`expenses_${monthLabel().replace(' ','_')}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

// ── SIDEBAR MOBILE ────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── MONTH NAVIGATION ──────────────────────────────────────────
function changeMonth(dir) {
  state.currentMonth += dir;
  if (state.currentMonth > 11) { state.currentMonth = 0;  state.currentYear++;  }
  if (state.currentMonth < 0)  { state.currentMonth = 11; state.currentYear--;  }
  refreshAll();
}

// ── CHATBOT LOGIC ─────────────────────────────────────────────
function initChatbot() {
  const fab = document.getElementById('chat-fab');
  const win = document.getElementById('chat-window');
  const cls = document.getElementById('chat-close');
  const frm = document.getElementById('chat-form');
  const inp = document.getElementById('chat-input');
  let hasGreeted = false;

  fab.addEventListener('click', () => {
    win.classList.add('open');
    if (!hasGreeted) {
      setTimeout(() => appendBotMsg("Hi! I'm your Smart Analyzer. Ask me for a <strong>status</strong> update, your <strong>budget</strong> health, or for saving <strong>tips</strong>!"), 400);
      hasGreeted = true;
    }
  });

  cls.addEventListener('click', () => win.classList.remove('open'));

  frm.addEventListener('submit', e => {
    e.preventDefault();
    const txt = inp.value.trim();
    if (!txt) return;
    appendUserMsg(txt);
    inp.value = '';
    setTimeout(() => processChat(txt), 600);
  });
}

function appendUserMsg(txt) {
  const b = document.getElementById('chat-body');
  const d = document.createElement('div');
  d.className = 'chat-msg user';
  d.textContent = txt;
  b.appendChild(d);
  b.scrollTop = b.scrollHeight;
}

function appendBotMsg(html) {
  const b = document.getElementById('chat-body');
  const d = document.createElement('div');
  d.className = 'chat-msg bot';
  d.innerHTML = html;
  b.appendChild(d);
  b.scrollTop = b.scrollHeight;
}

function processChat(txt) {
  const q = txt.toLowerCase();
  
  if (q.includes('tip') || q.includes('save') || q.includes('advice')) {
    const tips = [
      "Try the <strong>50/30/20 rule</strong>: 50% for needs, 30% for wants, and 20% for savings.",
      "Cancel unused subscriptions. Check your recurring expenses!",
      "Wait 48 hours before making a non-essential purchase to avoid impulse buying.",
      "Bring lunch to work instead of ordering out. It saves thousands per year!"
    ];
    return appendBotMsg(tips[Math.floor(Math.random() * tips.length)]);
  }

  const txns = monthTxns();
  const inc = txns.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const exp = txns.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);

  if (q.includes('status') || q.includes('how am i') || q.includes('balance') || q.includes('summary') || q.includes('analyze')) {
    const bal = inc - exp;
    const rate = inc > 0 ? Math.round((bal/inc)*100) : 0;
    return appendBotMsg(`This month you earned <strong>${fmt(inc)}</strong> and spent <strong>${fmt(exp)}</strong>. Your balance is <strong>${fmt(bal)}</strong> with a savings rate of <strong>${rate}%</strong>.`);
  }

  if (q.includes('budget') || q.includes('limit')) {
    const spentObj = {};
    txns.filter(t => t.type === 'expense').forEach(t => {
      spentObj[t.category] = (spentObj[t.category] || 0) + t.amount;
    });
    
    let danger = [];
    Object.keys(state.budgets).forEach(cid => {
      const limit = state.budgets[cid];
      const spent = spentObj[cid] || 0;
      if (spent >= limit) danger.push(allCats().find(c => c.id === cid)?.name || cid);
    });

    if (danger.length > 0) {
      return appendBotMsg(`⚠️ Careful! You have exceeded your budget for: <strong>${danger.join(', ')}</strong>.`);
    } else {
      return appendBotMsg("You're looking good! You haven't exceeded any category budgets yet.");
    }
  }

  if (q.includes('hi') || q.includes('hello') || q.includes('hey')) {
    return appendBotMsg("Hello there! I can help you analyze your spending. Try asking for a <strong>status</strong> or a <strong>tip</strong>.");
  }

  appendBotMsg("I'm not exactly sure what you mean. Try using keywords like <strong>status</strong>, <strong>budget</strong>, or <strong>tips</strong>.");
}


// ── BOOT & EVENT LISTENERS ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  load();
  renderDashboard();
  populateCatFilter();

  // Navigation
  document.querySelectorAll('.nav-item[data-view], [data-view]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.view); });
  });

  initChatbot();

  // Sidebar toggle
  document.getElementById('hamburger').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // Month nav
  document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => changeMonth(+1));

  // Add transaction buttons
  document.getElementById('btn-sidebar-add').addEventListener('click', openAddTxn);
  document.getElementById('btn-top-add').addEventListener('click', openAddTxn);

  // Transaction modal
  document.getElementById('type-expense').addEventListener('click', () => setTxnType('expense'));
  document.getElementById('type-income').addEventListener('click',  () => setTxnType('income'));
  document.getElementById('txn-form').addEventListener('submit', saveTxn);
  document.getElementById('txn-modal-x').addEventListener('click', () => closeModal('txn-modal'));
  document.getElementById('txn-cancel').addEventListener('click',  () => closeModal('txn-modal'));

  // Budget modal
  document.getElementById('btn-add-budget').addEventListener('click', openBudgetModal);
  document.getElementById('budget-modal-x').addEventListener('click', () => closeModal('budget-modal'));
  document.getElementById('budget-cancel').addEventListener('click',  () => closeModal('budget-modal'));
  document.getElementById('budget-form').addEventListener('submit', e => {
    e.preventDefault();
    const cat = document.getElementById('b-cat').value;
    const amt = parseFloat(document.getElementById('b-amt').value);
    if (!cat || !amt) return;
    state.budgets[cat] = amt;
    save(); closeModal('budget-modal'); renderBudgets();
  });

  // Category modal
  document.getElementById('btn-add-cat').addEventListener('click', () => openModal('cat-modal'));
  document.getElementById('cat-modal-x').addEventListener('click', () => closeModal('cat-modal'));
  document.getElementById('cat-cancel').addEventListener('click',  () => closeModal('cat-modal'));
  document.getElementById('cat-form').addEventListener('submit', e => {
    e.preventDefault();
    const name  = document.getElementById('cat-name').value.trim();
    const icon  = document.getElementById('cat-icon').value.trim();
    const type  = document.getElementById('cat-type').value;
    const color = document.getElementById('cat-color').value;
    if (!name || !icon) return;
    state.settings.customCats.push({ id: uid(), name, icon, color, type });
    save(); closeModal('cat-modal'); renderSettings(); populateCatFilter();
    document.getElementById('cat-form').reset();
    document.getElementById('cat-color').value = '#8b5cf6';
  });

  // Confirm modal close
  document.getElementById('confirm-x').addEventListener('click',      () => closeModal('confirm-modal'));
  document.getElementById('confirm-cancel').addEventListener('click', () => closeModal('confirm-modal'));

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });

  // Currency buttons
  document.getElementById('currency-opts').addEventListener('click', e => {
    const btn = e.target.closest('.cur-btn');
    if (!btn) return;
    state.settings.currency = btn.dataset.cur;
    save(); renderSettings(); refreshAll();
  });

  // Filters
  document.getElementById('txn-search').addEventListener('input',   renderAllTxns);
  document.getElementById('filter-type').addEventListener('change',  renderAllTxns);
  document.getElementById('filter-cat').addEventListener('change',   renderAllTxns);

  // Export
  document.getElementById('btn-export').addEventListener('click', exportCSV);

  // Spending limit
  document.getElementById('btn-save-limit').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('spending-limit-input').value) || 0;
    state.settings.spendingLimit = val;
    save();
    checkSpendingAlert();
    if (val > 0) {
      showToast(`Spending limit set to ${fmt(val)}`, 'success', 3500);
    } else {
      showToast('Spending alert disabled.', 'info', 3000);
      document.getElementById('spend-alert-banner').classList.add('hidden');
    }
  });

  // Dismiss alert banner
  document.getElementById('alert-dismiss').addEventListener('click', () => {
    document.getElementById('spend-alert-banner').classList.add('hidden');
  });

  // Clear data
  document.getElementById('btn-clear').addEventListener('click', () => {
    showConfirm('This will delete ALL your data. This cannot be undone!', () => {
      state.transactions = [];
      state.budgets = {};
      save(); refreshAll(); renderSettings();
    });
  });

  // Seed demo data if first visit — DISABLED: start clean
  // if (!state.transactions.length) seedDemo();
});


