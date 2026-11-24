/**
 * SalesPulse — Web Platform for Sales Analysis & Visualization
 * Data source: index_1.csv (3,636 coffee-shop transactions)
 * File: js/main.js
 * 
 * Main JavaScript controller providing:
 * 1. Navigation & mobile burger menu management
 * 2. Background ambient audio player controls
 * 3. Floating AI Assistant chatbot interactions
 * 4. IntersectionObserver-based scroll animations (.fade-in)
 * 5. Persistent light/dark theme controller and live chart color tokens
 */

/* ─── Theme controller ─────────────────────────────────────────────────────
   The pre-paint inline script in every <head> sets data-theme before CSS is
   applied. This controller keeps that value in sync with localStorage, the
   navbar switch, and every Chart.js instance through the `themechange` event. */
(function () {
  'use strict';

  const STORAGE_KEY = 'salespulse.theme';
  const root = document.documentElement;

  const DARK_CHART_COLORS = {
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

  const LIGHT_CHART_COLORS = {
    primary: '#723BFA',
    primaryDark: '#5B2BD1',
    highlight: '#3F6212',
    dark: '#FFFFFF',
    surface: '#F8F8FA',
    text: '#71717A',
    textStrong: '#141418',
    grid: '#E4E4EC',
    trendStart: '#7C3AED',
    trendEnd: '#4F46E5',
    trend: '#723BFA',
    areaTop: 'rgba(114, 59, 250, 0.14)',
    areaBottom: 'rgba(114, 59, 250, 0)',
    dot: '#723BFA',
    dotCore: '#FFFFFF',
    dotStroke: '#723BFA',
    tooltipTitle: '#141418',
    tooltipBody: '#F4F4F6',
    card: '#7C3AED',
    cash: '#15803D',
    categories: {
      'Coffee': '#7C3AED',
      'Chocolate drinks': '#B45309',
      'Tea': '#15803D',
      'Bakery': '#B45309',
      'Other': '#64748B'
    },
    barTop: '#7C3AED',
    barEnd: '#9333EA'
  };

  function cssVar(name, fallback) {
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
  }

  function current() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  /** Live chart palette for the active theme. */
  function colors() {
    const isLight = current() === 'light';
    const palette = isLight ? LIGHT_CHART_COLORS : DARK_CHART_COLORS;
    return Object.assign({}, palette, {
      primary: cssVar('--accent-purple', palette.primary),
      primaryDark: cssVar('--accent-purple-hover', palette.primaryDark),
      highlight: cssVar('--accent-lime-text', palette.highlight),
      dark: cssVar('--chart-bg', palette.dark),
      surface: cssVar('--chart-surface', palette.surface),
      text: cssVar('--chart-axis', palette.text),
      textStrong: cssVar('--text-primary', palette.textStrong),
      grid: cssVar('--chart-grid', palette.grid),
      dotCore: cssVar('--chart-dot-core', palette.dotCore),
      dotStroke: cssVar('--chart-dot-stroke', palette.dotStroke),
      tooltipTitle: cssVar('--chart-tooltip-title', palette.tooltipTitle),
      tooltipBody: cssVar('--chart-tooltip-body', palette.tooltipBody)
    });
  }

  function updateToggle(theme) {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const isLight = theme === 'light';
    const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';
    button.setAttribute('aria-pressed', String(isLight));
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }

  function apply(theme, persist) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', normalized);

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, normalized);
      } catch (err) {
        /* Storage can be blocked (private mode / file://) — theme still works. */
      }
    }

    updateToggle(normalized);
    document.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme: normalized, colors: colors() }
    }));
    return normalized;
  }

  function toggle() {
    return apply(current() === 'light' ? 'dark' : 'light', true);
  }

  window.SalesPulseTheme = {
    STORAGE_KEY: STORAGE_KEY,
    current: current,
    colors: colors,
    apply: apply,
    toggle: toggle
  };

  document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById('theme-toggle');
    apply(current(), false);
    if (button) button.addEventListener('click', toggle);
  });

  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY && (event.newValue === 'light' || event.newValue === 'dark')) {
      apply(event.newValue, false);
    }
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. Navigation & Active Page Highlighting ───
  const currentPage = document.body.getAttribute('data-page') || 'home';
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    if (link.getAttribute('data-page') === currentPage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  // Mobile navigation burger menu toggle
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');

  if (burger && nav) {
    burger.addEventListener('click', () => {
      const isExpanded = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!isExpanded));
      nav.classList.toggle('open');
    });

    // Close menu when a link is clicked
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        burger.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
      });
    });
  }

  // ─── 2. Background Music Player ───
  const bgMusic = document.getElementById('bg-music');
  const musicToggle = document.getElementById('music-toggle');
  const musicIcon = document.getElementById('music-icon');
  const musicVolume = document.getElementById('music-volume');
  const musicMute = document.getElementById('music-mute');
  const muteIcon = document.getElementById('mute-icon');

  if (bgMusic && musicToggle && musicVolume && musicMute) {
    // Set initial volume from slider (30%)
    bgMusic.volume = Number(musicVolume.value) / 100;
    let previousVolume = bgMusic.volume;

    // Toggle Play/Pause
    musicToggle.addEventListener('click', () => {
      if (bgMusic.paused) {
        bgMusic.play().then(() => {
          if (musicIcon) musicIcon.textContent = '⏸';
          musicToggle.setAttribute('aria-label', 'Pause background music');
        }).catch(err => {
          console.warn('Audio play request blocked or file unavailable:', err.message);
        });
      } else {
        bgMusic.pause();
        if (musicIcon) musicIcon.textContent = '▶';
        musicToggle.setAttribute('aria-label', 'Play background music');
      }
    });

    // Volume Slider Control
    musicVolume.addEventListener('input', (e) => {
      const vol = Number(e.target.value) / 100;
      bgMusic.volume = vol;
      if (vol === 0) {
        if (muteIcon) muteIcon.textContent = '🔇';
      } else {
        if (muteIcon) muteIcon.textContent = '🔊';
        previousVolume = vol;
      }
    });

    // Mute/Unmute Button
    musicMute.addEventListener('click', () => {
      if (bgMusic.volume > 0) {
        previousVolume = bgMusic.volume;
        bgMusic.volume = 0;
        musicVolume.value = 0;
        if (muteIcon) muteIcon.textContent = '🔇';
      } else {
        const restoreVol = previousVolume > 0 ? previousVolume : 0.3;
        bgMusic.volume = restoreVol;
        musicVolume.value = restoreVol * 100;
        if (muteIcon) muteIcon.textContent = '🔊';
      }
    });
  }

  // ─── 3. Floating Chatbot Assistant ───
  const chatFloatBtn = document.getElementById('chat-float-btn');
  const chatFloatWindow = document.getElementById('chat-float-window');
  const chatFloatClose = document.getElementById('chat-float-close');
  const chatFloatMessages = document.getElementById('chat-float-messages');
  const chatFloatInput = document.getElementById('chat-float-input');
  const chatFloatSend = document.getElementById('chat-float-send');
  const chatQuickBtns = document.querySelectorAll('.chat-quick-btn');

  // Predefined chatbot responses regarding SalesPulse and the CSV data
  const botAnswers = {
    'what is this site about?': 'SalesPulse is a university ICT project that visualizes 3,636 real coffee transactions from index_1.csv (March 2024 – March 2025). Prices are in USD with a live KZT equivalent.',
    'explain kpis': 'Our KPIs are: Revenue (USD + tenge), Transactions (rows in the CSV), Average Check, Best Month, Top Drink by revenue, and Card Share.',
    'how do i read the charts?': 'On Analytics you can filter by payment method, month and category. The line chart shows monthly revenue, doughnuts show payment and category splits, and horizontal bars rank the best-selling drinks.'
  };

  /**
   * Appends a message bubble to the chat container
   * @param {string} text - Message text
   * @param {'bot'|'user'} sender - Message author
   */
  function appendChatMessage(text, sender) {
    if (!chatFloatMessages) return;
    const msg = document.createElement('div');
    msg.className = `chat-message chat-message-${sender}`;
    msg.textContent = text;
    chatFloatMessages.appendChild(msg);
    chatFloatMessages.scrollTop = chatFloatMessages.scrollHeight;
  }

  if (chatFloatBtn && chatFloatWindow && chatFloatClose) {
    // Open chat window
    chatFloatBtn.addEventListener('click', () => {
      const isHidden = chatFloatWindow.hasAttribute('hidden');
      if (isHidden) {
        chatFloatWindow.removeAttribute('hidden');
        if (chatFloatMessages && chatFloatMessages.children.length === 0) {
          appendChatMessage('Hello! I am your SalesPulse Assistant. Ask me about the coffee sales in index_1.csv, or explore the Analytics dashboard.', 'bot');
        }
        if (chatFloatInput) chatFloatInput.focus();
      } else {
        chatFloatWindow.setAttribute('hidden', '');
      }
    });

    // Close chat window
    chatFloatClose.addEventListener('click', () => {
      chatFloatWindow.setAttribute('hidden', '');
    });

    // Send user message
    function handleUserSendMessage() {
      if (!chatFloatInput) return;
      const text = chatFloatInput.value.trim();
      if (!text) return;

      appendChatMessage(text, 'user');
      chatFloatInput.value = '';

      // Generate response
      setTimeout(() => {
        const query = text.toLowerCase();
        let reply = "Thanks for asking! You can explore detailed metrics in the Analytics tab, browse AI-generated visual designs in the Gallery, or view project background in About.";
        
        for (const [key, answer] of Object.entries(botAnswers)) {
          if (query.includes(key.toLowerCase()) || key.toLowerCase().includes(query)) {
            reply = answer;
            break;
          }
        }
        appendChatMessage(reply, 'bot');
      }, 400);
    }

    if (chatFloatSend) {
      chatFloatSend.addEventListener('click', handleUserSendMessage);
    }

    if (chatFloatInput) {
      chatFloatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleUserSendMessage();
        }
      });
    }

    // Quick prompt buttons
    chatQuickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const queryText = btn.getAttribute('data-msg') || btn.textContent;
        if (chatFloatInput) {
          chatFloatInput.value = queryText;
          handleUserSendMessage();
        }
      });
    });
  }

  // ─── 4. Hero KPI Counters (calculated from index_1.csv) ───
  const counterElements = document.querySelectorAll('[data-counter]');
  const counterKztElements = document.querySelectorAll('[data-counter-kzt]');
  const counterNoteElements = document.querySelectorAll('[data-counter-note]');

  if (counterElements.length) {
    const dataset = (typeof salesData !== 'undefined' && Array.isArray(salesData)) ? salesData : [];
    const totalRevenue = dataset.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
    const productRevenue = dataset.reduce((acc, row) => {
      acc[row.product] = (acc[row.product] || 0) + (Number(row.revenue) || 0);
      return acc;
    }, {});
    const topProduct = Object.keys(productRevenue)
      .sort((a, b) => productRevenue[b] - productRevenue[a])[0] || '—';
    const topProductRevenue = productRevenue[topProduct] || 0;
    const topProductShare = totalRevenue ? (topProductRevenue / totalRevenue) * 100 : 0;

    const metrics = {
      revenue: totalRevenue,
      check: dataset.length ? totalRevenue / dataset.length : 0,
      transactions: dataset.length,
      'top-product': topProduct
    };

    function formatCounter(key, value) {
      if (key === 'transactions') return Math.round(value).toLocaleString('en-US');
      if (key === 'top-product') return value;
      return '$' + Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    function animateCounter(element, key) {
      const target = Number(metrics[key]) || 0;
      const duration = 900;
      const start = performance.now();

      function frame(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = formatCounter(key, target * eased);
        if (progress < 1) requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);
    }

    function updateHeroCounters(animate) {
      counterElements.forEach(element => {
        const key = element.dataset.counter;
        if (!(key in metrics)) return;
        if (key === 'top-product') {
          element.textContent = formatCounter(key, metrics[key]);
        } else if (animate) {
          animateCounter(element, key);
        } else {
          element.textContent = formatCounter(key, metrics[key]);
        }
      });

      counterKztElements.forEach(element => {
        const key = element.dataset.counterKzt;
        if (!(key in metrics) || !window.ExchangeRate) return;
        element.textContent = '(≈ ' + ExchangeRate.formatKzt(metrics[key]) + ')';
      });

      // Top drink: its revenue and share of the total, in the same small lime format.
      counterNoteElements.forEach(element => {
        if (element.dataset.counterNote !== 'top-product' || !window.ExchangeRate) return;
        element.textContent = ExchangeRate.formatUsd(topProductRevenue) +
          ' · ' + topProductShare.toFixed(1) + '% of revenue';
      });
    }

    updateHeroCounters(true);
    window.addEventListener('exchange-rate-updated', () => updateHeroCounters(false));
  }

  // ─── 5. Scroll-Triggered Fade-In Animations ───
  const fadeElements = document.querySelectorAll('.fade-in');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    fadeElements.forEach(el => observer.observe(el));
  } else {
    // Fallback for older browsers without IntersectionObserver
    fadeElements.forEach(el => el.classList.add('visible'));
  }
});
