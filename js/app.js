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

  // ============ КАРТОЧКА ============
  function card(c) {
    const photo = c.image_url || '';
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML =
      '<div class="card__media">' +
        (photo ? '<img loading="lazy" src="' + esc(photo) + '" alt="' + esc(c.title) + '">' : '') +
        (c.city ? '<span class="card__city">' + esc(c.city) + '</span>' : '') +
      '</div>' +
      '<div class="card__body">' +
        '<div class="card__title"><a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.title || (c.brand + ' ' + c.model)) + '</a></div>' +
        '<div class="card__price">' + fmtPrice(c.price) + '</div>' +
        '<div class="specs">' +
          spec('Год', c.year) +
          spec('Пробег', fmtMileage(c.mileage)) +
          spec('Двигатель', c.engine) +
          spec('КПП', c.transmission) +
          spec('Привод', c.drive) +
          spec('Кузов', c.body) +
          spec('Цвет', c.color) +
          spec('Мест', c.seats) +
          spec('Комплектация', c.trim) +
          spec('ПТС', c.pts) +
          spec('Владельцев', c.owners) +
          spec('Состояние', c.condition) +
          spec('Руль', c.wheel) +
        '</div>' +
      '</div>';
    return el;
  }

  function spec(label, value) {
    if (!value && value !== 0) return '';
    return '<span>' + label + ': <strong>' + esc(String(value)) + '</strong></span>';
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
