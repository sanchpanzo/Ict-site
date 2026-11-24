# SalesPulse 📊

A static web platform for sales analysis and visualization of key business indicators, built with vanilla HTML, CSS and JavaScript.

---

## Overview

**SalesPulse** is an interactive sales analytics project developed for the **Information and Communication Technologies (ICT)** course at **Narxoz University** (School of Digital Technologies).

The site reads a generated JavaScript dataset from `js/data.js`, which is produced from **`index_1.csv`**: **3,636 real coffee-shop transactions** recorded between **1 March 2024 and 23 March 2025**. Every transaction contains a date, time, payment method (`Card`/`Cash`), anonymised card number, category (`Coffee` or `Chocolate drinks`), product name and a USD price. There is **no city, cost or profit column** in the source CSV, so the dashboard does not invent them.

Source amounts remain in USD. A live USD→KZT rate is loaded from `https://open.er-api.com/v6/latest/USD`, cached in `localStorage`, and used to show the tenge equivalent in brackets throughout the interface. A safe fallback rate is used when the network is unavailable.

---

## Features

1. **Home page with CSV-driven KPI counters**  
   Total revenue, average check, transaction count and top drink are calculated from `salesData` in JavaScript, with animated count-up effects and live KZT hints.

2. **Sales Analytics Dashboard**  
   Six KPI cards, four Chart.js charts, compact custom filter dropdowns (payment method, month, category), a searchable/sortable transaction table, pagination and CSV export. All figures recalculate from the active filters.

3. **AI Sales Assistant**  
   A local natural-language engine answers questions about revenue, best months, best-selling drinks, card vs cash, categories, trends and specific products. It renders inline charts plus a dedicated full-size chart card outside the clipped chat window.

4. **Dual currency display**  
   USD values from the CSV are paired with their KZT equivalent using a live exchange rate. The current rate is shown in the Analytics and Assistant banners.

5. **Analytical insights**  
   Data-driven summaries of revenue, product mix, payment behaviour and seasonality, derived directly from the source file.

6. **AI-generated gallery**  
   Concept visuals for the analytics platform with lazy loading, category filtering and an accessible lightbox with keyboard and touch navigation.

7. **AI presenter video and transcript**  
   An introductory video section with a text alternative for accessibility.

8. **Global utilities**  
   Background music player with saved volume, floating quick-assistant widget, responsive layout and the palette `#18181C`, `#723BFA`, `#B9F500`.

---

## Project Structure

```text
salespulse/
├── index.html          # Home page
├── analytics.html      # Analytics dashboard
├── gallery.html        # AI-generated gallery
├── assistant.html      # AI Assistant / chatbot
├── about.html          # About page
├── index_1.csv         # Source transaction data
├── css/
│   └── style.css       # Shared stylesheet
├── js/
│   ├── data.js         # salesData generated from index_1.csv (3,636 rows)
│   ├── currency.js     # Live USD/KZT rate and formatting helpers
│   ├── select.js       # Compact accessible dropdowns for Analytics
│   ├── main.js         # Shared navigation, music and floating chat logic
│   ├── analytics.js    # Dashboard filters, KPIs, charts and table
│   └── assistant.js    # Local assistant engine and chart rendering
├── assets/
│   ├── images/         # Self-contained SVG concept visuals
│   │   ├── hero-ai.svg
│   │   └── ai-1.svg … ai-6.svg
│   └── audio/
│       └── ambient.wav # Short locally generated ambient loop
└── README.md
```

### CSV field mapping

| CSV field | Site field |
| :--- | :--- |
| `date`, `time`, `datetime` | Date/time columns and month keys |
| `money` | `unit_price` and `revenue` (USD) |
| `cash_type` | `paymentType` (`Card` or `Cash`) |
| `card` | Anonymised card label |
| `coffee_name` | `product` |
| Derived from product | `category` (`Coffee` or `Chocolate drinks`) |

`quantity` is always `1` because each CSV row is one purchase.

---

## How to Run Locally

No build tools or npm installation are required.

### Method 1: Direct file opening

1. Download or copy this folder to your machine.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge or Safari).

### Method 2: Local HTTP server (recommended)

A local server avoids browser restrictions on media and `fetch`.

- **Using Node.js**:
  ```bash
  npx serve .
  ```
- **Using Python 3**:
  ```bash
  python -m http.server 8000
  ```
- **Using VS Code Live Server**: right-click `index.html` and choose **Open with Live Server**.

---

## Exchange Rate Source

`js/currency.js` requests `https://open.er-api.com/v6/latest/USD` on page load. The rate is stored under the `salespulse.usd-kzt-rate` `localStorage` key with a fallback of `455.12` (dated `23 Nov 2026`) for offline use. The `exchange-rate-updated` event refreshes all visible amounts when a new rate arrives.

---

## AI Assistant Modes

By default, `js/assistant.js` uses its built-in local data engine: no server, no API key and instant answers from the in-memory dataset.

To enable an optional LLM proxy, set `PROXY_URL` near the top of `js/assistant.js` to your own backend endpoint:

```javascript
const PROXY_URL = 'https://your-api-proxy.example.com/api/chat';
```

Never expose an AI provider secret key in client-side JavaScript. If the proxy is empty, unavailable or returns an error, the assistant automatically falls back to the local engine.

---

## Bundled Media

| File path | Description |
| :--- | :--- |
| `assets/images/hero-ai.svg` | AI presenter visual (the Home hero itself is CSS-only, with no background artwork behind the headline) |
| `assets/images/ai-1.svg` … `ai-6.svg` | Gallery concept visuals |
| `assets/audio/ambient.wav` | Short ambient loop for the music player |

These are self-contained placeholder assets, so the pages render without external image or video files. Replace them with your own artwork/audio if required; the gallery also keeps an inline SVG fallback generator for missing images.

---

## Project Authors & Program

- **Authors:** Ырысбек Санжар, Ақылбаев Карим
- **Educational program:** ICT rus1

---

## Technologies

- **HTML5**: semantic structure and ARIA attributes
- **CSS3**: custom properties, Flexbox, Grid, media queries, animations
- **JavaScript ES6+**: DOM manipulation, async exchange-rate fetch, local data analysis
- **Chart.js**: line, bar and doughnut charts via CDN
- **Google Fonts**: Poppins headings, Inter body text

---

## License

Educational project — developed for the **Information and Communication Technologies (ICT)** Course, School of Digital Technologies, **Narxoz University** © 2026. All rights reserved.
