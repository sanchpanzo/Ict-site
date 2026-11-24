/**
 * assistant.js — AI Sales Assistant (local data engine + optional LLM proxy)
 *
 * Data source: js/data.js, generated from index_1.csv (3,636 transactions).
 * The assistant answers questions about revenue, drinks, categories, payment
 * methods and monthly trends. It also renders Chart.js charts on demand.
 * Prices come from js/currency.js and are shown in USD with a KZT equivalent.
 */

document.addEventListener('DOMContentLoaded', function () {
  // ═══════════════════════════════════════════════════════════════════════
  // 1. CONFIGURATION & MODE
  // ═══════════════════════════════════════════════════════════════════════
  const PROXY_URL = '';
  const isAPIMode = typeof PROXY_URL === 'string' && PROXY_URL.trim().length > 0;

  const modeEl = document.getElementById('agent-mode');
  if (modeEl) {
    modeEl.innerHTML = isAPIMode
      ? '<span class="mode-dot api" aria-hidden="true"></span> LLM API Mode Active'
      : '<span class="mode-dot local" aria-hidden="true"></span> Local Data Engine Active';
    modeEl.setAttribute('title', isAPIMode
      ? 'Assistant is querying a backend Large Language Model proxy'
      : 'Assistant is performing client-side NLP and in-memory data analytics');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════════════
  const messagesContainer = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const quickBtns = document.querySelectorAll('.quick-reply-btn, .chat-quick-btn, .chat-empty-hint, .sample-prompt-card');
  const chartArea = document.getElementById('agent-chart-area');
  const chartCanvas = document.getElementById('agent-chart');
  const chatResetBtn = document.getElementById('chat-reset');

  let currentChart = null;
  let lastChartData = null;
  const inlineCharts = [];
  const inlineChartSpecs = [];

  // Chart colors follow the shared theme controller; inline values are a
  // fallback for the unlikely case that main.js did not load.
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
        trend: '#8B5CF6',
        trendStart: '#A78BFA',
        trendEnd: '#6366F1',
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

  function trendGradient(context) {
    const chart = context.chart;
    if (!chart.chartArea) return COLORS.trend;
    const gradient = chart.ctx.createLinearGradient(chart.chartArea.left, 0, chart.chartArea.right, 0);
    gradient.addColorStop(0, COLORS.trendStart);
    gradient.addColorStop(1, COLORS.trendEnd);
    return gradient;
  }

  function areaGradient(context) {
    const chart = context.chart;
    if (!chart.chartArea) return COLORS.areaTop;
    const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
    gradient.addColorStop(0, COLORS.areaTop);
    gradient.addColorStop(1, COLORS.areaBottom);
    return gradient;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. DATA HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  function getSalesDataset() {
    if (typeof salesData !== 'undefined' && Array.isArray(salesData) && salesData.length) return salesData;
    return window.salesData || [];
  }

  function monthsInData(data) {
    return Array.from(new Set(data.map(function (row) { return row.monthKey; }))).sort();
  }

  function monthLabel(key) {
    const parts = key.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return date.toLocaleString('en-US', { month: 'short' }) + " '" + parts[0].slice(2);
  }

  function groupBy(rows, key) {
    return rows.reduce(function (acc, row) {
      (acc[row[key]] = acc[row[key]] || []).push(row);
      return acc;
    }, {});
  }

  function sumBy(rows, field) {
    return rows.reduce(function (sum, row) { return sum + (Number(row[field]) || 0); }, 0);
  }

  function topN(map, n) {
    return Object.entries(map).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n);
  }

  function fmt(value) {
    if (window.ExchangeRate) return ExchangeRate.formatPlain(value);
    return '$' + Number(value || 0).toFixed(2);
  }

  function usd(value) {
    if (window.ExchangeRate) return ExchangeRate.formatUsd(value);
    return '$' + Number(value || 0).toFixed(2);
  }

  function countText(n) {
    return Number(n || 0).toLocaleString('en-US');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. MESSAGE RENDERING
  // ═══════════════════════════════════════════════════════════════════════
  function formatMessageText(rawText) {
    if (!rawText) return '';
    let safe = String(rawText)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return safe.replace(/\n/g, '<br>');
  }

  function standardChartOptions(type) {
    const isDoughnut = type === 'doughnut' || type === 'pie';
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: isDoughnut
          ? { position: 'bottom', labels: { color: COLORS.textStrong, boxWidth: 12, padding: 12, font: { size: 12 } } }
          : { display: false },
        tooltip: {
          backgroundColor: COLORS.dark,
          titleColor: COLORS.tooltipTitle,
          bodyColor: COLORS.tooltipBody,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: function (ctx) {
              const raw = ctx.raw !== undefined ? ctx.raw : (ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed.x);
              return ' ' + (ctx.label || ctx.dataset.label || '') + ': ' +
                (typeof raw === 'number' ? fmt(raw) : raw);
            }
          }
        }
      },
      scales: isDoughnut ? {} : {
        x: {
          grid: { color: COLORS.grid, drawBorder: false },
          border: { display: false },
          ticks: { color: COLORS.text, font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.grid, drawBorder: false },
          border: { display: false },
          ticks: { color: COLORS.text, font: { size: 11 }, callback: function (value) { return usd(value); } }
        }
      }
    };
  }

  function horizontalOptions(type) {
    const options = standardChartOptions(type);
    options.indexAxis = 'y';
    return options;
  }

  function addMessage(text, sender, chartData, suppressChartScroll) {
    if (!messagesContainer) return;

    const row = document.createElement('div');
    row.className = 'message-row ' + (sender === 'user' ? 'user-row' : 'bot-row');

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = sender === 'user' ? '👤' : '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble ' + (sender === 'user' ? 'user-message' : 'bot-message');

    const textEl = document.createElement('div');
    textEl.className = 'message-text';
    textEl.innerHTML = formatMessageText(text);
    bubble.appendChild(textEl);

    if (chartData && sender === 'bot' && typeof Chart !== 'undefined') {
      lastChartData = chartData;
      const wrapper = document.createElement('div');
      wrapper.className = 'message-chart-wrapper';
      const canvas = document.createElement('canvas');
      canvas.className = 'message-chart-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', (chartData.datasets && chartData.datasets[0] && chartData.datasets[0].label) || 'Sales chart');
      wrapper.appendChild(canvas);
      bubble.appendChild(wrapper);

      try {
        inlineChartSpecs.push({ canvas: canvas, chartData: chartData });
        inlineCharts.push(new Chart(canvas, {
          type: chartData.type,
          data: { labels: chartData.labels, datasets: chartData.datasets },
          options: chartData.options || standardChartOptions(chartData.type)
        }));
      } catch (err) {
        console.error('Inline chart failed:', err);
      }

      if (chartCanvas) {
        try {
          if (currentChart) currentChart.destroy();
          if (chartArea) {
            chartArea.hidden = false;
            chartArea.style.display = 'block';
          }
          currentChart = new Chart(chartCanvas, {
            type: chartData.type,
            data: { labels: chartData.labels, datasets: chartData.datasets },
            options: chartData.options || standardChartOptions(chartData.type)
          });
          const placeholder = document.getElementById('agent-chart-placeholder');
          if (placeholder) placeholder.hidden = true;
          if (!suppressChartScroll && chartArea && chartArea.scrollIntoView) {
            chartArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } catch (err) {
          console.error('Primary chart failed:', err);
        }
      }
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showTyping() {
    if (!messagesContainer) return null;
    const row = document.createElement('div');
    row.className = 'message-row bot-row typing-indicator-row';
    row.id = 'agent-typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble bot-message typing-bubble';
    bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. LOCAL DATA ENGINE
  // ═══════════════════════════════════════════════════════════════════════
  function analyzeQuery(query) {
    const q = String(query || '').toLowerCase().trim();
    const data = getSalesDataset();

    if (!data.length) {
      return { text: 'The dataset is not available. Make sure js/data.js is loaded.' };
    }

    const monthKeys = monthsInData(data);
    const revenueByMonth = {};
    const rowsByMonth = groupBy(data, 'monthKey');
    monthKeys.forEach(function (key) {
      revenueByMonth[key] = sumBy(rowsByMonth[key] || [], 'revenue');
    });

    const monthlyLabels = monthKeys.map(monthLabel);
    const monthlyValues = monthKeys.map(function (key) { return revenueByMonth[key]; });

    function lineChart(label, values) {
      return {
        type: 'line',
        labels: monthlyLabels,
        datasets: [{
          label: label,
          data: values,
          borderColor: trendGradient,
          backgroundColor: areaGradient,
          pointBackgroundColor: COLORS.dotCore,
          pointBorderColor: COLORS.dot,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverBackgroundColor: COLORS.dot,
          pointHoverBorderColor: COLORS.dotCore,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4
        }]
      };
    }

    function barChart(labels, values, label, horizontal) {
      return {
        type: 'bar',
        labels: labels,
        datasets: [{
          label: label,
          data: values,
          backgroundColor: labels.map(function (_, index) {
            return mixHex(COLORS.barTop, COLORS.barEnd, labels.length > 1 ? index / (labels.length - 1) : 0);
          }),
          borderRadius: 5,
          borderSkipped: false
        }],
        options: horizontal ? horizontalOptions('bar') : standardChartOptions('bar')
      };
    }

    // ── Best month ───────────────────────────────────────────────────────
    if (/best month|top month|highest month|peak month|strongest month/.test(q)) {
      const bestKey = monthKeys.reduce(function (best, key) {
        return revenueByMonth[key] > revenueByMonth[best] ? key : best;
      }, monthKeys[0]);
      const bestRows = rowsByMonth[bestKey];
      const bestRevenue = revenueByMonth[bestKey];
      const topDrink = topN(
        Object.fromEntries(Object.keys(groupBy(bestRows, 'product'))
          .map(function (p) { return [p, sumBy(groupBy(bestRows, 'product')[p], 'revenue')]; })), 1
      )[0];

      return {
        text: 'The strongest month in the CSV was **' + monthLabel(bestKey) + '**.\n\n' +
          '• **Revenue**: ' + fmt(bestRevenue) + '\n' +
          '• **Transactions**: ' + countText(bestRows.length) + '\n' +
          '• **Average check**: ' + fmt(bestRevenue / bestRows.length) + '\n' +
          '• **Top drink**: ' + (topDrink ? topDrink[0] : '—') + '\n\n' +
          'Full monthly revenue trend below:',
        chartData: barChart(
          monthlyLabels,
          monthlyValues.map(function (value, index) {
            return monthKeys[index] === bestKey ? value : value;
          }),
          'Monthly revenue (USD)'
        )
      };
    }

    // ── Most sold drinks (ranked by cups, not revenue) ───────────────────
    if (/most sold|most bought|by cups|by volume|by quantity|top sold|best selling drinks by volume/.test(q)) {
      const byProduct = groupBy(data, 'product');
      const ranked = topN(
        Object.fromEntries(Object.keys(byProduct).map(function (p) { return [p, byProduct[p].length]; })),
        8
      );
      const list = ranked.slice(0, 5).map(function (item, index) {
        return (index + 1) + '. **' + item[0] + '** — ' + countText(item[1]) +
          ' cups (' + fmt(sumBy(byProduct[item[0]], 'revenue')) + ')';
      }).join('\n');

      return {
        text: 'Most sold drinks in the source data (by number of cups):\n\n' + list,
        chartData: barChart(
          ranked.map(function (item) { return item[0]; }),
          ranked.map(function (item) { return item[1]; }),
          'Cups sold by drink',
          true
        )
      };
    }

    // ── Top / best-selling products ──────────────────────────────────────
    if (/top product|best product|best selling|top seller|top drink|best drink|highest revenue product|earns the most|earn the most|highest earning|most revenue|which drink/.test(q)) {
      const byProduct = groupBy(data, 'product');
      const productRevenue = {};
      Object.keys(byProduct).forEach(function (name) {
        productRevenue[name] = sumBy(byProduct[name], 'revenue');
      });
      const ranked = topN(productRevenue, 8);
      const list = ranked.slice(0, 5).map(function (item, index) {
        return (index + 1) + '. **' + item[0] + '** — ' + fmt(item[1]) +
          ' (' + countText(byProduct[item[0]].length) + ' cups)';
      }).join('\n');

      return {
        text: 'Top drinks by revenue in the source data:\n\n' + list,
        chartData: barChart(
          ranked.map(function (item) { return item[0]; }),
          ranked.map(function (item) { return item[1]; }),
          'Revenue by drink (USD)',
          true
        )
      };
    }

    // ── Payment methods ──────────────────────────────────────────────────
    if (/payment|card|cash|compare payment|card vs|cash vs/.test(q)) {
      const methods = ['Card', 'Cash'];
      const byMethod = groupBy(data, 'paymentType');
      const totalRevenue = sumBy(data, 'revenue');
      const lines = methods.map(function (method) {
        const rows = byMethod[method] || [];
        const revenue = sumBy(rows, 'revenue');
        const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
        return '• **' + method + '**: ' + fmt(revenue) + ' · ' +
          countText(rows.length) + ' transactions (' + share.toFixed(1) + '% of revenue) · ' +
          'avg check ' + fmt(rows.length ? revenue / rows.length : 0);
      }).join('\n');

      return {
        text: 'Payment split from **index_1.csv**:\n\n' + lines,
        chartData: {
          type: 'doughnut',
          labels: methods,
          datasets: [{
            label: 'Revenue by payment method',
            data: methods.map(function (method) { return sumBy(byMethod[method] || [], 'revenue'); }),
            backgroundColor: methods.map(function (method) { return method === 'Cash' ? COLORS.cash : COLORS.card; }),
            borderColor: COLORS.surface,
            borderWidth: 3
          }]
        }
      };
    }

    // ── Categories ───────────────────────────────────────────────────────
    if (/categor|breakdown|revenue breakdown|share/.test(q)) {
      const byCategory = groupBy(data, 'category');
      const categories = Object.keys(byCategory);
      const totalRevenue = sumBy(data, 'revenue');
      const lines = categories.map(function (category) {
        const rows = byCategory[category];
        const revenue = sumBy(rows, 'revenue');
        const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
        return '• **' + category + '**: ' + fmt(revenue) + ' (' + share.toFixed(1) +
          '%) · ' + countText(rows.length) + ' cups';
      }).join('\n');

      return {
        text: 'Revenue breakdown by drink category:\n\n' + lines,
        chartData: {
          type: 'doughnut',
          labels: categories,
          datasets: [{
            label: 'Revenue by category',
            data: categories.map(function (category) { return sumBy(byCategory[category], 'revenue'); }),
            backgroundColor: categories.map(categoryColor),
            borderColor: COLORS.surface,
            borderWidth: 3
          }]
        }
      };
    }

    // ── Specific month (e.g. "October", "2024-10", "Oct 24") ─────────────
    for (const key of monthKeys) {
      const label = monthLabel(key);
      const name = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
        .toLocaleString('en-US', { month: 'long' }).toLowerCase();
      const shortName = label.split(' ')[0].toLowerCase();
      if (q.includes(key) || q.includes(label.toLowerCase()) || q.includes(name) ||
          q.includes(shortName + ' ' + key.slice(2, 4)) || q === name) {
        const rows = rowsByMonth[key];
        const revenue = revenueByMonth[key];
        const byProduct = groupBy(rows, 'product');
        const top = topN(Object.fromEntries(Object.keys(byProduct).map(function (p) {
          return [p, sumBy(byProduct[p], 'revenue')];
        })), 5);
        const list = top.map(function (item, index) {
          return (index + 1) + '. ' + item[0] + ' — ' + fmt(item[1]);
        }).join('\n');

        return {
          text: '**' + label + '** summary:\n\n' +
            '• **Revenue**: ' + fmt(revenue) + '\n' +
            '• **Transactions**: ' + countText(rows.length) + '\n' +
            '• **Average check**: ' + fmt(revenue / rows.length) + '\n\n' +
            '**Best-selling drinks:**\n' + list,
          chartData: barChart(top.map(function (item) { return item[0]; }),
            top.map(function (item) { return item[1]; }), 'Revenue by drink', true)
        };
      }
    }

    // ── Total revenue / overall sales ────────────────────────────────────
    if (/total revenue|overall revenue|annual revenue|total sales|how much revenue|how much did|total income/.test(q)) {
      const totalRevenue = sumBy(data, 'revenue');
      const bestKey = monthKeys.reduce(function (best, key) {
        return revenueByMonth[key] > revenueByMonth[best] ? key : best;
      }, monthKeys[0]);

      return {
        text: 'According to **index_1.csv** (' + data[0].date + ' → ' + data[data.length - 1].date + '):\n\n' +
          '• **Total revenue**: ' + fmt(totalRevenue) + '\n' +
          '• **Transactions**: ' + countText(data.length) + '\n' +
          '• **Average check**: ' + fmt(totalRevenue / data.length) + '\n' +
          '• **Best month**: ' + monthLabel(bestKey) + ' (' + fmt(revenueByMonth[bestKey]) + ')\n\n' +
          'Monthly dynamics:',
        chartData: lineChart('Monthly revenue (USD)', monthlyValues)
      };
    }

    // ── Trend / growth ───────────────────────────────────────────────────
    if (/trend|growth|growing|increase|half|quarter|momentum/.test(q)) {
      const middle = Math.floor(monthKeys.length / 2);
      const firstHalf = monthKeys.slice(0, middle).reduce(function (sum, key) { return sum + revenueByMonth[key]; }, 0);
      const secondHalf = monthKeys.slice(middle).reduce(function (sum, key) { return sum + revenueByMonth[key]; }, 0);
      const change = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

      return {
        text: 'Monthly trend across the whole dataset:\n\n' +
          '• **First ' + middle + ' months**: ' + fmt(firstHalf) + '\n' +
          '• **Remaining ' + (monthKeys.length - middle) + ' months**: ' + fmt(secondHalf) + '\n' +
          '• **Change**: **' + (change >= 0 ? '+' : '') + change.toFixed(1) + '%**\n\n' +
          'The full month-by-month curve is below.',
        chartData: lineChart('Monthly revenue (USD)', monthlyValues)
      };
    }

    // ── Explanations ─────────────────────────────────────────────────────
    if (/what is this|about (?:the |this )?(?:site|platform|project|salespulse)|this site|this platform|who made/.test(q)) {
      return {
        text: 'SalesPulse is a university ICT project that visualizes real coffee-shop transactions from **index_1.csv**. ' +
          'It includes an analytics dashboard with filters, Chart.js charts, a searchable table with CSV export, ' +
          'and this local AI assistant. Everything runs in the browser with HTML, CSS and JavaScript.'
      };
    }

    if (/kpi|key performance|indicator|metric/.test(q)) {
      return {
        text: 'KPIs on the Analytics page:\n\n' +
          '📊 **Revenue** — sum of all transaction amounts (USD + KZT equivalent)\n' +
          '🧾 **Transactions** — number of sales rows in the CSV\n' +
          '💵 **Average check** — revenue divided by transactions\n' +
          '📅 **Best month** — month with the highest revenue\n' +
          '☕ **Top drink** — drink with the highest revenue\n' +
          '💳 **Card share** — percentage of transactions paid by card'
      };
    }

    if (/how to read|chart|graph|interpret|visualization/.test(q)) {
      return {
        text: 'Charts on the Analytics page:\n\n' +
          '📈 **Line** — revenue by month\n' +
          '🍩 **Doughnut** — revenue split by payment method and drink category\n' +
          '📊 **Horizontal bars** — eight best-selling drinks by revenue\n\n' +
          'Use the three compact filters above the KPI cards to slice the same data.'
      };
    }

    // ── Specific drink ───────────────────────────────────────────────────
    const products = Array.from(new Set(data.map(function (row) { return row.product; })));
    for (const product of products) {
      if (q.includes(product.toLowerCase())) {
        const rows = data.filter(function (row) { return row.product === product; });
        const revenue = sumBy(rows, 'revenue');
        const byMonth = groupBy(rows, 'monthKey');
        const bestKey = Object.keys(byMonth).reduce(function (best, key) {
          return sumBy(byMonth[key], 'revenue') > (best ? sumBy(byMonth[best], 'revenue') : -1) ? key : best;
        }, null);

        return {
          text: '**' + product + '** — product profile:\n\n' +
            '• **Category**: ' + rows[0].category + '\n' +
            '• **Revenue**: ' + fmt(revenue) + '\n' +
            '• **Cups sold**: ' + countText(rows.length) + '\n' +
            '• **Average price**: ' + fmt(revenue / rows.length) + '\n' +
            '• **Best month**: ' + (bestKey ? monthLabel(bestKey) : '—') + '\n\n' +
            'Monthly sales of this drink:',
          chartData: lineChart(product + ' monthly revenue (USD)',
            monthKeys.map(function (key) { return sumBy(byMonth[key] || [], 'revenue'); }))
        };
      }
    }

    // ── Fallback ─────────────────────────────────────────────────────────
    return {
      text: 'I can answer questions about the coffee sales in **index_1.csv**. Try asking:\n' +
        '• What was the best month?\n' +
        '• Which drink earns the most?\n' +
        '• Compare card and cash\n' +
        '• Show revenue breakdown\n' +
        '• Top products\n' +
        '• Show the trend\n' +
        '• Tell me about Latte'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. OPTIONAL API MODE
  // ═══════════════════════════════════════════════════════════════════════
  function createDataSummary() {
    const data = getSalesDataset();
    const byMonth = groupBy(data, 'monthKey');
    const byProduct = groupBy(data, 'product');
    const byPayment = groupBy(data, 'paymentType');

    return {
      source: 'index_1.csv',
      period: { from: data[0].date, to: data[data.length - 1].date },
      transactions: data.length,
      totalRevenueUSD: Number(sumBy(data, 'revenue').toFixed(2)),
      usdKztRate: window.ExchangeRate ? ExchangeRate.rate : 455.12,
      monthlyRevenue: Object.fromEntries(monthsInData(data).map(function (key) {
        return [key, Number(sumBy(byMonth[key] || [], 'revenue').toFixed(2))];
      })),
      revenueByPayment: Object.fromEntries(Object.keys(byPayment).map(function (key) {
        return [key, Number(sumBy(byPayment[key], 'revenue').toFixed(2))];
      })),
      topProducts: topN(Object.fromEntries(Object.keys(byProduct).map(function (key) {
        return [key, sumBy(byProduct[key], 'revenue')];
      })), 8)
    };
  }

  async function queryAPI(question) {
    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question, dataSummary: createDataSummary() })
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      return { text: result.answer || result.text || result.response || 'No response returned from API.' };
    } catch (err) {
      console.warn('LLM API mode failed, using local data engine:', err);
      return analyzeQuery(question);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. MESSAGE PIPELINE & EVENTS
  // ═══════════════════════════════════════════════════════════════════════
  async function processMessage(text, options) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return;

    const emptyHints = document.getElementById('chat-empty-hints');
    if (emptyHints) emptyHints.hidden = true;

    addMessage(cleanText, 'user');
    if (chatInput) chatInput.value = '';
    updateSendState();

    const typing = showTyping();
    await new Promise(function (resolve) { setTimeout(resolve, 450); });

    let response;
    try {
      response = isAPIMode ? await queryAPI(cleanText) : analyzeQuery(cleanText);
    } catch (err) {
      console.error('Query failed:', err);
      response = { text: 'I could not calculate that answer. Please try rephrasing the question.' };
    }

    if (typing && typing.parentNode) typing.remove();
    // Keep the question on the chart payload so charts can be regenerated
    // with fresh palette values whenever the theme changes.
    if (response.chartData) response.chartData.query = cleanText;
    addMessage(response.text, 'bot', response.chartData || null, options && options.suppressChartScroll);
  }

  function updateSendState() {
    if (sendBtn && chatInput) sendBtn.disabled = !chatInput.value.trim();
  }

  function resetChat() {
    if (messagesContainer) {
      const rows = messagesContainer.querySelectorAll('.message-row');
      for (let i = 1; i < rows.length; i++) rows[i].remove();
      messagesContainer.scrollTop = 0;
    }

    const emptyHints = document.getElementById('chat-empty-hints');
    if (emptyHints) emptyHints.hidden = false;

    if (chatInput) chatInput.value = '';
    updateSendState();

    while (inlineCharts.length) {
      const chart = inlineCharts.pop();
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    }
    inlineChartSpecs.length = 0;
    lastChartData = null;

    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }

    if (chartArea) {
      chartArea.hidden = true;
      chartArea.style.display = 'none';
    }

    const placeholder = document.getElementById('agent-chart-placeholder');
    if (placeholder) placeholder.hidden = false;

    if (chatInput) chatInput.focus();
  }

  if (chatResetBtn) {
    chatResetBtn.addEventListener('click', resetChat);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', function () {
      processMessage(chatInput ? chatInput.value : '');
      if (chatInput) chatInput.focus();
    });
  }

  if (chatInput) {
    updateSendState();
    chatInput.addEventListener('input', updateSendState);
    chatInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        processMessage(chatInput.value);
      }
    });
  }

  quickBtns.forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault();
      const query = button.dataset.query || button.dataset.msg || button.textContent.trim();
      const isSamplePrompt = button.classList.contains('sample-prompt-card');
      processMessage(query, { suppressChartScroll: isSamplePrompt });
      if (chatInput) chatInput.focus();
      if (isSamplePrompt) {
        const chatPanel = document.querySelector('.chat-container');
        if (chatPanel) chatPanel.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    });
  });

  // Re-run the stored questions so every dataset color is regenerated for the
  // new theme, then rebuild both the inline bubbles and the full-size chart.
  document.addEventListener('themechange', function () {
    COLORS = window.SalesPulseTheme ? window.SalesPulseTheme.colors() : COLORS;
    if (typeof Chart === 'undefined') return;

    function refreshed(chartData) {
      if (chartData && chartData.query) {
        try {
          const result = analyzeQuery(chartData.query);
          if (result && result.chartData) return result.chartData;
        } catch (err) {
          /* Fall back to the existing payload. */
        }
      }
      return chartData;
    }

    inlineCharts.forEach(function (chart) {
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    inlineCharts.length = 0;

    inlineChartSpecs.forEach(function (spec) {
      const data = refreshed(spec.chartData);
      try {
        inlineCharts.push(new Chart(spec.canvas, {
          type: data.type,
          data: { labels: data.labels, datasets: data.datasets },
          options: data.options || standardChartOptions(data.type)
        }));
      } catch (err) {
        console.error('Inline chart theme refresh failed:', err);
      }
    });

    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }

    if (chartCanvas && lastChartData) {
      lastChartData = refreshed(lastChartData);
      try {
        if (chartArea) {
          chartArea.hidden = false;
          chartArea.style.display = 'block';
        }
        currentChart = new Chart(chartCanvas, {
          type: lastChartData.type,
          data: { labels: lastChartData.labels, datasets: lastChartData.datasets },
          options: lastChartData.options || standardChartOptions(lastChartData.type)
        });
        const placeholder = document.getElementById('agent-chart-placeholder');
        if (placeholder) placeholder.hidden = true;
      } catch (err) {
        console.error('Primary chart theme refresh failed:', err);
      }
    }
  });
});
