/**
 * currency.js — Dual-currency formatting (USD + live KZT equivalent)
 *
 * Source data (index_1.csv) stores prices in USD. For the Kazakh audience the
 * site also shows the tenge equivalent in brackets. The USD/KZT rate is loaded
 * from the free open.er-api.com endpoint; a cached value and a safe fallback
 * are used when the network is unavailable, so the site still works from file://.
 */

(function (global) {
  'use strict';

  const API_URL = 'https://open.er-api.com/v6/latest/USD';
  const STORAGE_KEY = 'salespulse.usd-kzt-rate';
  const FALLBACK = { rate: 455.12, date: '23 Nov 2026', source: 'fallback' };

  let state = Object.assign({}, FALLBACK);

  try {
    const cached = JSON.parse(global.localStorage.getItem(STORAGE_KEY));
    if (cached && Number(cached.rate) > 0) {
      state = {
        rate: Number(cached.rate),
        date: cached.date || FALLBACK.date,
        source: 'cache'
      };
    }
  } catch (err) {
    /* localStorage may be disabled — the fallback rate still works */
  }

  const usdFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const kztFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  });

  function num(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  function getRate() {
    return state.rate;
  }

  function formatUsd(value) {
    return '$' + usdFormatter.format(num(value));
  }

  function toKzt(value) {
    return Math.round(num(value) * state.rate);
  }

  function formatKzt(value) {
    return kztFormatter.format(toKzt(value)) + ' ₸';
  }

  /** Plain text: "$38.70 (≈ 17,632 ₸)" — safe for chart labels and tooltips. */
  function formatPlain(value, options) {
    const opts = options || {};
    const usd = formatUsd(value);
    if (opts.kzt === false) return usd;
    return usd + ' (≈ ' + formatKzt(value) + ')';
  }

  /** HTML: tenge part is wrapped so it can be styled as a subtle hint. */
  function formatHtml(value, options) {
    const opts = options || {};
    const usd = formatUsd(value);
    if (opts.kzt === false) {
      return '<span class="usd-value">' + usd + '</span>';
    }
    return '<span class="usd-value">' + usd + '</span> ' +
      '<span class="kzt-value">(≈ ' + formatKzt(value) + ')</span>';
  }

  function formatRate() {
    return '1 USD ≈ ' + kztFormatter.format(state.rate) + ' ₸';
  }

  function syncLabels() {
    const text = formatRate();
    global.document.querySelectorAll('[data-exchange-rate]').forEach(function (el) {
      el.textContent = text;
    });
  }

  async function refresh() {
    try {
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const rate = data && data.rates && Number(data.rates.KZT);
      if (!rate || !Number.isFinite(rate)) throw new Error('KZT rate missing');
      state = {
        rate: rate,
        date: (data.time_last_update_utc || '').replace(' +0000', '') || FALLBACK.date,
        source: 'live'
      };
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          rate: state.rate,
          date: state.date
        }));
      } catch (err) { /* ignore storage errors */ }
    } catch (err) {
      console.warn('[SalesPulse] Live USD/KZT rate unavailable, using cached rate:', err.message);
    }

    syncLabels();
    global.dispatchEvent(new global.CustomEvent('exchange-rate-updated', { detail: Object.assign({}, state) }));
    return Object.assign({}, state);
  }

  const ready = refresh();

  global.ExchangeRate = {
    ready: ready,
    refresh: refresh,
    get rate() { return state.rate; },
    get state() { return Object.assign({}, state); },
    toKzt: toKzt,
    formatUsd: formatUsd,
    formatKzt: formatKzt,
    formatPlain: formatPlain,
    formatHtml: formatHtml,
    formatRate: formatRate
  };
})(window);
