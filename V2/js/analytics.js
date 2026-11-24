/**
 * analytics.js — Analytics Dashboard Logic
 *
 * Data source: js/data.js (generated from index_1.csv).
 * Handles: compact filters, KPI calculations, Chart.js charts, transaction
 * table, sorting/search/pagination and CSV export. Prices are stored in USD
 * and shown together with their KZT equivalent (see js/currency.js).
 */

document.addEventListener('DOMContentLoaded', function () {
  // ═══════════════════════════════════════════════════════════════════════
  // 1. REFERENCES
  // ═══════════════════════════════════════════════════════════════════════
  const filterPayment = document.getElementById('filter-payment');
  const filterMonth = document.getElementById('filter-month');
  const filterCategory = document.getElementById('filter-category');
  const btnReset = document.getElementById('btn-reset-filters');

  const searchInput = document.getElementById('table-search');
  const tableBody = document.getElementById('table-body');
  const paginationContainer = document.getElementById('pagination');
  const btnDownloadCsv = document.getElementById('btn-download-csv');

  const canvasMonthly = document.getElementById('chart-monthly');
  const monthlyChartTitle = document.getElementById('monthly-chart-title');
  const canvasPayment = document.getElementById('chart-payment');
  const canvasCategory = document.getElementById('chart-category');
  const canvasTopProducts = document.getElementById('chart-top-products');

  const kpi = {
    revenue: document.getElementById('kpi-revenue-value'),
    transactions: document.getElementById('kpi-transactions-value'),
    aov: document.getElementById('kpi-aov-value'),
    bestMonth: document.getElementById('kpi-best-month-value'),
    topProduct: document.getElementById('kpi-best-product-value'),
    cardShare: document.getElementById('kpi-card-share-value')
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 2. PALETTE & STATE
  // ═══════════════════════════════════════════════════════════════════════
  // Palette comes from the shared theme controller so charts follow the
  // light/dark switch. The inline fallback keeps the dashboard working if
  // main.js is unavailable for any reason.
  let COLORS = window.SalesPulseTheme
    ? window.SalesPulseTheme.colors()
    : {
        primary: '#723BFA',
        primaryDark: '#5B2BD1',
        highlight: '#B9F500',
        dark: '#18181C',
        surface: '#24242B',
        text: '#71717A',
        textStrong: '#F4F4F6',
        grid: '#24242E',
        trendStart: '#A78BFA',
        trendEnd: '#6366F1',
        trend: '#8B5CF6',
        areaTop: 'rgba(139, 92, 246, 0.2)',
        areaBottom: 'rgba(139, 92, 246, 0)',
        dot: '#A78BFA',
        dotCore: '#FFFFFF',
        dotStroke: '#1E1B29',
        tooltipTitle: '#FFFFFF',
        tooltipBody: '#E9E9EF',
        card: '#7C3AED',
        cash: '#10B981',
        categories: {
          'Coffee': '#7C3AED',
          'Chocolate drinks': '#F59E0B',
          'Tea': '#10B981',
          'Bakery': '#F59E0B',
          'Other': '#64748B'
        },
        barTop: '#8B5CF6',
        barEnd: '#C084FC'
      };

  const state = {
    payment: 'all',
    month: 'all',
    category: 'all',
    sortField: 'datetime',
    sortAsc: false,
    searchQuery: '',
    currentPage: 1,
    rowsPerPage: 12
  };

  const charts = { monthly: null, payment: null, category: null, topProducts: null };

  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = COLORS.text;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  function rawData() {
    if (typeof salesData !== 'undefined' && Array.isArray(salesData)) return salesData;
    return window.salesData || [];
  }

  function money(value, options) {
    if (window.ExchangeRate) return ExchangeRate.formatPlain(value, options);
    return '$' + Number(value || 0).toFixed(2);
  }

  function moneyHtml(value, options) {
    if (window.ExchangeRate) return ExchangeRate.formatHtml(value, options);
    return '$' + Number(value || 0).toFixed(2);
  }

  function kzt(value) {
    if (window.ExchangeRate) return ExchangeRate.formatKzt(value);
    return Math.round(Number(value || 0) * 455.12).toLocaleString('en-US') + ' ₸';
  }

  function usd(value) {
    if (window.ExchangeRate) return ExchangeRate.formatUsd(value);
    return '$' + Number(value || 0).toFixed(2);
  }

  function sumBy(rows, field) {
    return rows.reduce(function (sum, row) {
      return sum + (Number(row[field]) || 0);
    }, 0);
  }

  function groupBy(rows, field) {
    return rows.reduce(function (acc, row) {
      const key = row[field];
      (acc[key] = acc[key] || []).push(row);
      return acc;
    }, {});
  }

  function monthLabel(key) {
    const parts = key.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    const name = date.toLocaleString('en-US', { month: 'short' });
    return name + " '" + parts[0].slice(2);
  }

  function allMonthKeys(rows) {
    return Array.from(new Set(rows.map(function (r) { return r.monthKey; }))).sort();
  }

  function allDaysInMonth(monthKey) {
    const parts = monthKey.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: count }, function (_, index) {
      return monthKey + '-' + String(index + 1).padStart(2, '0');
    });
  }

  function dayLabel(key) {
    const parts = key.split('-');
    const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    return Number(parts[2]) + ' ' + date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  }

  function tooltip(labelCallback) {
    return {
      backgroundColor: COLORS.dark,
      titleColor: COLORS.tooltipTitle,
      bodyColor: COLORS.tooltipBody,
      padding: 10,
      cornerRadius: 8,
      displayColors: false,
      callbacks: { label: labelCallback }
    };
  }

  function valueAxis(callback) {
    return {
      beginAtZero: true,
      grid: { color: COLORS.grid },
      border: { display: false },
      ticks: { color: COLORS.text, font: { size: 11 }, callback: callback }
    };
  }

  function categoryAxis() {
    return {
      grid: { display: false },
      border: { display: false },
      ticks: { color: COLORS.textStrong, font: { size: 11, weight: '500' } }
    };
  }

  // Horizontal gradient for the revenue trend line.
  function trendLineGradient(context) {
    const chart = context.chart;
    const area = chart.chartArea;
    if (!area) return COLORS.trend;
    const gradient = chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
    gradient.addColorStop(0, COLORS.trendStart);
    gradient.addColorStop(1, COLORS.trendEnd);
    return gradient;
  }

  // Vertical gradient that fades to transparent at the baseline.
  function areaFillGradient(context) {
    const chart = context.chart;
    const area = chart.chartArea;
    if (!area) return COLORS.areaTop;
    const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    gradient.addColorStop(0, COLORS.areaTop);
    gradient.addColorStop(1, COLORS.areaBottom);
    return gradient;
  }

  // Blend two hex colors — used for the "top to bottom" bar ramp.
  function mixHex(from, to, amount) {
    const a = from.replace('#', '');
    const b = to.replace('#', '');
    const channels = [0, 2, 4].map(function (offset) {
      const start = parseInt(a.slice(offset, offset + 2), 16);
      const end = parseInt(b.slice(offset, offset + 2), 16);
      return Math.round(start + (end - start) * amount);
    });
    return '#' + channels.map(function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }

  function categoryColor(name) {
    return COLORS.categories[name] || COLORS.categories.Other;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. FILTERING
  // ═══════════════════════════════════════════════════════════════════════
  function getFilteredData() {
    return rawData().filter(function (row) {
      if (state.payment !== 'all' && row.paymentType !== state.payment) return false;
      if (state.month !== 'all' && row.monthKey !== state.month) return false;
      if (state.category !== 'all' && row.category !== state.category) return false;
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        return Object.values(row).some(function (value) {
          return String(value).toLowerCase().includes(query);
        });
      }
      return true;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. KPIs
  // ═══════════════════════════════════════════════════════════════════════
  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function updateKPIs(data) {
    if (!data.length) {
      Object.values(kpi).forEach(function (el) { setText(el, '—'); });
      return;
    }

    const revenue = sumBy(data, 'revenue');
    const transactions = data.length;
    const averageCheck = revenue / transactions;

    const byMonth = groupBy(data, 'monthKey');
    let bestMonth = '—';
    let bestMonthRevenue = -1;
    Object.keys(byMonth).forEach(function (key) {
      const total = sumBy(byMonth[key], 'revenue');
      if (total > bestMonthRevenue) {
        bestMonthRevenue = total;
        bestMonth = monthLabel(key);
      }
    });

    const byProduct = groupBy(data, 'product');
    let topProduct = '—';
    let topProductRevenue = -1;
    Object.keys(byProduct).forEach(function (name) {
      const total = sumBy(byProduct[name], 'revenue');
      if (total > topProductRevenue) {
        topProductRevenue = total;
        topProduct = name;
      }
    });

    const cardRows = data.filter(function (row) { return row.paymentType === 'Card'; });
    const cardShare = transactions > 0 ? (cardRows.length / transactions) * 100 : 0;

    if (kpi.revenue) kpi.revenue.innerHTML = moneyHtml(revenue);
    setText(kpi.transactions, transactions.toLocaleString('en-US'));
    if (kpi.aov) kpi.aov.innerHTML = moneyHtml(averageCheck);
    setText(kpi.bestMonth, bestMonth);
    setText(kpi.topProduct, topProduct);
    setText(kpi.cardShare, cardShare.toFixed(1) + '%');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. CHARTS
  // ═══════════════════════════════════════════════════════════════════════
  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function renderMonthlyChart(data) {
    destroyChart('monthly');
    if (!canvasMonthly || typeof Chart === 'undefined') return;

    const isDaily = state.month !== 'all';
    const keys = isDaily ? allDaysInMonth(state.month) : allMonthKeys(rawData());
    const totals = groupBy(data, isDaily ? 'date' : 'monthKey');
    const labels = keys.map(isDaily ? dayLabel : monthLabel);
    const values = keys.map(function (key) { return sumBy(totals[key] || [], 'revenue'); });

    if (monthlyChartTitle) {
      monthlyChartTitle.textContent = isDaily
        ? 'Daily Revenue Dynamics — ' + monthLabel(state.month)
        : 'Monthly Revenue Dynamics';
    }
    canvasMonthly.setAttribute('aria-label', isDaily
      ? 'Daily revenue chart for ' + monthLabel(state.month)
      : 'Monthly revenue chart');

    charts.monthly = new Chart(canvasMonthly, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: isDaily ? 'Daily revenue' : 'Revenue',
          data: values,
          borderColor: trendLineGradient,
          backgroundColor: areaFillGradient,
          pointBackgroundColor: COLORS.dotCore,
          pointBorderColor: COLORS.dot,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverBackgroundColor: COLORS.dot,
          pointHoverBorderColor: COLORS.dotCore,
          pointHoverBorderWidth: 2,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(function (ctx) { return ' Revenue: ' + money(ctx.parsed.y); })
        },
        scales: {
          x: {
            grid: { display: false, color: COLORS.grid },
            border: { display: false },
            ticks: { color: COLORS.text, font: { size: 11 } }
          },
          y: valueAxis(function (value) { return usd(value); })
        }
      }
    });
  }

  function renderPaymentChart(data) {
    destroyChart('payment');
    if (!canvasPayment || typeof Chart === 'undefined') return;

    const methods = ['Card', 'Cash'];
    const totals = groupBy(data, 'paymentType');
    const values = methods.map(function (method) { return sumBy(totals[method] || [], 'revenue'); });

    charts.payment = new Chart(canvasPayment, {
      type: 'doughnut',
      data: {
        labels: methods,
        datasets: [{
          data: values,
          backgroundColor: [COLORS.card, COLORS.cash],
          borderColor: COLORS.surface,
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: COLORS.textStrong, boxWidth: 12, padding: 14, font: { size: 12 } }
          },
          tooltip: tooltip(function (ctx) {
            const total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
            const percent = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
            return ' ' + ctx.label + ': ' + money(ctx.parsed) + ' (' + percent + '%)';
          })
        }
      }
    });
  }

  function renderCategoryChart(data) {
    destroyChart('category');
    if (!canvasCategory || typeof Chart === 'undefined') return;

    const available = ['Coffee', 'Chocolate drinks'].filter(function (category) {
      return data.some(function (row) { return row.category === category; });
    });
    const totals = groupBy(data, 'category');
    const values = available.map(function (category) { return sumBy(totals[category] || [], 'revenue'); });

    charts.category = new Chart(canvasCategory, {
      type: 'doughnut',
      data: {
        labels: available,
        datasets: [{
          data: values,
          backgroundColor: available.map(categoryColor),
          borderColor: COLORS.surface,
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: COLORS.textStrong, boxWidth: 12, padding: 14, font: { size: 12 } }
          },
          tooltip: tooltip(function (ctx) {
            const total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
            const percent = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
            return ' ' + ctx.label + ': ' + money(ctx.parsed) + ' (' + percent + '%)';
          })
        }
      }
    });
  }

  function renderTopProductsChart(data) {
    destroyChart('topProducts');
    if (!canvasTopProducts || typeof Chart === 'undefined') return;

    const totals = groupBy(data, 'product');
    const ranked = Object.keys(totals)
      .map(function (name) { return [name, sumBy(totals[name], 'revenue')]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 8);

    // One calm violet ramp: strongest at the top, fading towards the tail.
    const colors = ranked.map(function (_, index) {
      const amount = ranked.length > 1 ? index / (ranked.length - 1) : 0;
      return mixHex(COLORS.barTop, COLORS.barEnd, amount);
    });

    charts.topProducts = new Chart(canvasTopProducts, {
      type: 'bar',
      data: {
        labels: ranked.map(function (item) { return item[0]; }),
        datasets: [{
          label: 'Revenue',
          data: ranked.map(function (item) { return item[1]; }),
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: tooltip(function (ctx) { return ' Revenue: ' + money(ctx.parsed.x); })
        },
        scales: {
          x: valueAxis(function (value) { return usd(value); }),
          y: categoryAxis()
        }
      }
    });
  }

  function renderAllCharts(data) {
    renderMonthlyChart(data);
    renderPaymentChart(data);
    renderCategoryChart(data);
    renderTopProductsChart(data);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. TRANSACTION TABLE
  // ═══════════════════════════════════════════════════════════════════════
  function renderTable(data) {
    const rows = data.slice().sort(function (a, b) {
      let valueA = a[state.sortField];
      let valueB = b[state.sortField];
      if (state.sortField === 'kzt') {
        valueA = Number(a.revenue) * ExchangeRate.rate;
        valueB = Number(b.revenue) * ExchangeRate.rate;
      }
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return state.sortAsc ? valueA - valueB : valueB - valueA;
      }
      return state.sortAsc
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });

    const totalPages = Math.max(1, Math.ceil(rows.length / state.rowsPerPage));
    if (state.currentPage > totalPages) state.currentPage = 1;
    if (state.currentPage < 1) state.currentPage = 1;

    const start = (state.currentPage - 1) * state.rowsPerPage;
    const pageRows = rows.slice(start, start + state.rowsPerPage);

    if (!tableBody) return;

    if (!pageRows.length) {
      tableBody.innerHTML =
        '<tr><td colspan="8" class="table-empty">No transactions match the selected filters.</td></tr>';
      renderPagination(0);
      return;
    }

    tableBody.innerHTML = pageRows.map(function (row) {
      const cardLabel = row.card ? '•••• ' + row.card.slice(-4) : '—';
      return '<tr>' +
        '<td>' + row.date + '</td>' +
        '<td>' + row.time + '</td>' +
        '<td><span class="pay-badge pay-' + row.paymentType.toLowerCase() + '">' + row.paymentType + '</span></td>' +
        '<td title="' + row.card + '">' + cardLabel + '</td>' +
        '<td>' + row.category + '</td>' +
        '<td class="product-cell">' + row.product + '</td>' +
        '<td class="amount-usd">' + usd(row.revenue) + '</td>' +
        '<td class="amount-kzt">' + kzt(row.revenue) + '</td>' +
        '</tr>';
    }).join('');

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!paginationContainer) return;
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    let html = '<button class="pagination-btn" id="pagination-prev" ' +
      (state.currentPage === 1 ? 'disabled' : '') + ' aria-label="Previous Page">&laquo; Prev</button>';

    const pages = [];
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (state.currentPage > 3) pages.push('...');
      const start = Math.max(2, state.currentPage - 1);
      const end = Math.min(totalPages - 1, state.currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (state.currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    pages.forEach(function (page) {
      if (page === '...') {
        html += '<span class="pagination-ellipsis">&hellip;</span>';
      } else {
        const active = page === state.currentPage;
        html += '<button class="pagination-btn ' + (active ? 'active' : '') + '" data-page="' + page + '" ' +
          (active ? 'aria-current="page"' : '') + ' aria-label="Page ' + page + '">' + page + '</button>';
      }
    });

    html += '<button class="pagination-btn" id="pagination-next" ' +
      (state.currentPage === totalPages ? 'disabled' : '') + ' aria-label="Next Page">Next &raquo;</button>';
    paginationContainer.innerHTML = html;

    const prev = document.getElementById('pagination-prev');
    if (prev && state.currentPage > 1) {
      prev.addEventListener('click', function () {
        state.currentPage--;
        renderTable(getFilteredData());
      });
    }
    const next = document.getElementById('pagination-next');
    if (next && state.currentPage < totalPages) {
      next.addEventListener('click', function () {
        state.currentPage++;
        renderTable(getFilteredData());
      });
    }
    paginationContainer.querySelectorAll('button[data-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        const page = parseInt(button.dataset.page, 10);
        if (page && page !== state.currentPage) {
          state.currentPage = page;
          renderTable(getFilteredData());
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 8. EVENTS
  // ═══════════════════════════════════════════════════════════════════════
  function bindFilter(select, key) {
    if (!select) return;
    select.addEventListener('change', function (event) {
      state[key] = event.target.value;
      state.currentPage = 1;
      updateAll();
    });
  }

  bindFilter(filterPayment, 'payment');
  bindFilter(filterMonth, 'month');
  bindFilter(filterCategory, 'category');

  if (btnReset) {
    btnReset.addEventListener('click', function () {
      state.payment = 'all';
      state.month = 'all';
      state.category = 'all';
      state.searchQuery = '';
      state.currentPage = 1;

      [filterPayment, filterMonth, filterCategory].forEach(function (select) {
        if (!select) return;
        select.value = 'all';
        // Keep the custom dropdown UI in sync with the native select.
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      if (searchInput) searchInput.value = '';
      updateAll();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function (event) {
      state.searchQuery = event.target.value.trim();
      state.currentPage = 1;
      renderTable(getFilteredData());
    });
  }

  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    const handleSort = function () {
      const field = th.dataset.sort;
      if (state.sortField === field) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortField = field;
        state.sortAsc = true;
      }
      document.querySelectorAll('th[data-sort]').forEach(function (header) {
        const arrow = header.querySelector('.sort-arrow');
        if (arrow) arrow.remove();
        header.classList.remove('sort-active');
        header.removeAttribute('aria-sort');
      });
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = state.sortAsc ? ' ▲' : ' ▼';
      th.appendChild(arrow);
      th.classList.add('sort-active');
      th.setAttribute('aria-sort', state.sortAsc ? 'ascending' : 'descending');
      renderTable(getFilteredData());
    };

    th.addEventListener('click', handleSort);
    th.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSort();
      }
    });
  });

  if (btnDownloadCsv) {
    btnDownloadCsv.addEventListener('click', function () {
      const rows = getFilteredData();
      const headers = ['Date', 'Time', 'Payment', 'Card', 'Category', 'Product', 'Amount (USD)', 'USD/KZT Rate', 'Amount (KZT)'];
      const body = rows.map(function (row) {
        return [
          row.date, row.time, row.paymentType, row.card, row.category, row.product,
          Number(row.revenue).toFixed(2),
          ExchangeRate.rate.toFixed(2),
          ExchangeRate.toKzt(row.revenue)
        ].map(function (value) { return '"' + String(value).replace(/"/g, '""') + '"'; }).join(',');
      });
      const csv = '\uFEFF' + [headers.join(','), body.join('\r\n')].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'coffee-sales-' + state.payment + '-' + state.month + '.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  window.addEventListener('exchange-rate-updated', updateAll);

  // ═══════════════════════════════════════════════════════════════════════
  // 9. MASTER UPDATE
  // ═══════════════════════════════════════════════════════════════════════
  function updateAll() {
    const data = getFilteredData();
    updateKPIs(data);
    renderAllCharts(data);
    renderTable(data);
  }

  updateAll();

  // Repaint every chart when the navbar theme switch is used. renderAllCharts()
  // destroys and recreates the Chart.js instances with the new palette.
  document.addEventListener('themechange', function () {
    COLORS = window.SalesPulseTheme ? window.SalesPulseTheme.colors() : COLORS;
    if (typeof Chart !== 'undefined') Chart.defaults.color = COLORS.text;
    updateAll();
  });
});
