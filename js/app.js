(function () {
  const cfg = window.AUTORU_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const els = {
    status: $('status'), counter: $('counter'), grid: $('grid'), chips: $('chips'),
    q: $('q'), city: $('city'), brand: $('brand'), body: $('body'),
    transmission: $('transmission'), drive: $('drive'), sort: $('sort'),
    reset: $('reset'), loadMore: $('loadMore'),
  };

  let cars = [];
  let filtered = [];
  let shown = 0;

  // ============ ЗАГРУЗКА ============
  fetch(cfg.dataUrl, { redirect: 'follow' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => {
      const h = data.h || [];
      cars = (data.r || []).map(row => {
        const o = {};
        for (let i = 0; i < h.length; i++) o[h[i]] = row[i] === undefined ? '' : row[i];
        return o;
      });
      els.status.textContent = 'Каталог: ' + cars.length + ' авто';
      populateSelects();
      apply();
    })
    .catch(err => { els.status.textContent = 'Ошибка загрузки: ' + err.message; });

  // ============ ФИЛЬТРЫ-СЕЛЕКТЫ ============
  function populateSelects() {
    const fill = (sel, values) => {
      const sorted = Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'));
      sorted.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
    };
    fill(els.city, cars.map(c => c.city));
    fill(els.brand, cars.map(c => c.brand));
    fill(els.body, cars.map(c => c.body));
    fill(els.transmission, cars.map(c => c.transmission));
    fill(els.drive, cars.map(c => c.drive));
  }

  // ============ ПРИМЕНЕНИЕ ============
  function apply() {
    const rawQ = (els.q.value || '').trim();
    const parsed = rawQ && window.AutoSearch ? window.AutoSearch.parse(rawQ) : null;

    // селекты накладываются поверх распарсенного запроса
    const sel = {
      city: els.city.value, brand: els.brand.value, body: els.body.value,
      tr: els.transmission.value, dr: els.drive.value,
    };

    filtered = cars.filter(c => {
      if (sel.city  && c.city  !== sel.city)  return false;
      if (sel.brand && c.brand !== sel.brand) return false;
      if (sel.body  && c.body  !== sel.body)  return false;
      if (sel.tr    && c.transmission !== sel.tr) return false;
      if (sel.dr    && c.drive !== sel.dr)    return false;
      if (parsed && !window.AutoSearch.match(c, parsed)) return false;
      return true;
    });

    // сортировка
    const s = els.sort.value;
    filtered.sort((a, b) => {
      if (s === 'price_asc')    return num(a.price) - num(b.price);
      if (s === 'price_desc')   return num(b.price) - num(a.price);
      if (s === 'year_desc')    return num(b.year)  - num(a.year);
      if (s === 'year_asc')     return num(a.year)  - num(b.year);
      if (s === 'mileage_asc')  return num(a.mileage) - num(b.mileage);
      if (s === 'updated_desc') return (b.updated_at || '').localeCompare(a.updated_at || '');
      return 0;
    });

    renderChips(parsed);
    shown = 0;
    els.grid.innerHTML = '';
    render();
  }

  function renderChips(parsed) {
    if (!parsed) { els.chips.innerHTML = ''; return; }
    const chips = window.AutoSearch.chips(parsed);
    if (parsed.free) chips.push(['+', parsed.free]);
    els.chips.innerHTML = chips.map(([k, v]) =>
      `<span class="chip">${k}: <strong>${esc(String(v))}</strong></span>`
    ).join('');
  }

  function render() {
    const pageSize = cfg.pageSize || 24;
    if (!filtered.length) {
      els.grid.innerHTML = '<div class="empty">Ничего не найдено по фильтрам.</div>';
      els.loadMore.hidden = true;
      els.counter.textContent = '0 из 0';
      return;
    }
    const slice = filtered.slice(shown, shown + pageSize);
    const frag = document.createDocumentFragment();
    slice.forEach(c => frag.appendChild(card(c)));
    els.grid.appendChild(frag);
    shown += slice.length;
    els.loadMore.hidden = shown >= filtered.length;
    els.counter.textContent = shown + ' из ' + filtered.length;
  }

  // ============ КАРТОЧКА (16:9) ============
  const ICONS = {
    year:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
    miles:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M8 13h.01"/></svg>',
    price:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 4h6a4 4 0 0 1 0 8H8M8 12h8M8 16h4M8 4v16"/></svg>',
    engine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 10v6h2l2 3h6l2-3h2v-6h-2V8h-4V6h-4v2H7v2H5z"/></svg>',
    body:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 15l2-5h14l2 5v3H3v-3z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/></svg>',
    trim:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3-5.4 3 1.3-6L3.4 9.2l6-.6L12 3z"/></svg>',
    seats:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 21V9a3 3 0 0 1 3-3h2v8H7v7zM7 14h13M16 21v-7"/></svg>',
    owner:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>',
    state:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
    pts:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M8 13h8M8 17h5"/></svg>',
    flag:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 21V4M5 4h12l-3 4 3 4H5"/></svg>',
    pin:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    wheel:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M4 12h6M20 12h-6M12 20v-6"/></svg>',
    color:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/></svg>',
  };

  function tile(icon, label, value) {
    if (!value && value !== 0) return '';
    return '<div class="tile"><span class="tile__icon">' + ICONS[icon] + '</span><div><div class="tile__label">' + label + '</div><div class="tile__value">' + esc(String(value)) + '</div></div></div>';
  }

  function card(c) {
    const photo = c.image_url || '';
    const engineLine = [c.engine, c.transmission].filter(Boolean).join(' · ');
    const bodyLine   = [c.body, c.drive].filter(Boolean).join(' · ');
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML =
      '<div class="card__media">' +
        (photo ? '<img loading="lazy" src="' + esc(photo) + '" alt="' + esc(c.title) + '">' : '') +
        (c.city ? '<span class="card__city">' + esc(c.city) + '</span>' : '') +
      '</div>' +
      '<div class="card__body">' +
        '<div class="card__head">' +
          '<div class="card__title">' + esc(c.title || (c.brand + ' ' + c.model)) + '</div>' +
          '<div class="card__price">' + fmtPrice(c.price) + '</div>' +
        '</div>' +
        '<div class="tiles">' +
          tile('year',   'Год',           c.year) +
          tile('miles',  'Пробег',        fmtMileage(c.mileage)) +
          tile('price',  'Цена',          fmtPrice(c.price)) +
          tile('engine', 'Двигатель / КПП', engineLine) +
          tile('body',   'Кузов / Привод', bodyLine) +
          tile('trim',   'Комплектация',  c.trim) +
          tile('seats',  'Кол-во мест',   c.seats ? c.seats + ' мест' : '') +
          tile('owner',  'Владельцы',     c.owners ? c.owners + ' владелец' : '') +
          tile('state',  'Состояние',     c.condition) +
          tile('pts',    'ПТС',           c.pts) +
          tile('flag',   'Страна',        c.country) +
          tile('pin',    'Город',         c.city) +
          tile('wheel',  'Руль',          c.wheel) +
          tile('color',  'Цвет',          c.color) +
        '</div>' +
        '<div class="card__foot">' +
          '<a href="' + esc(c.url) + '" target="_blank" rel="noopener" class="card__open">Открыть объявление →</a>' +
          '<span class="card__source">auto.ru</span>' +
        '</div>' +
      '</div>';
    return el;
  }

  // ============ УТИЛИТЫ ============
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function fmtPrice(p) { const n = num(p); return n ? n.toLocaleString('ru-RU') + ' ₽' : '—'; }
  function fmtMileage(m) { const n = num(m); return n ? n.toLocaleString('ru-RU') + ' км' : '—'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

  // ============ СОБЫТИЯ ============
  ['q','city','brand','body','transmission','drive','sort'].forEach(k => {
    els[k].addEventListener(k === 'q' ? 'input' : 'change', apply);
  });
  els.reset.addEventListener('click', () => {
    els.q.value = ''; els.city.value = ''; els.brand.value = '';
    els.body.value = ''; els.transmission.value = ''; els.drive.value = '';
    els.sort.value = 'price_asc'; apply();
  });
  els.loadMore.addEventListener('click', render);
})();
