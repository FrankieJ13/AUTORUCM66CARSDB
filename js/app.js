(function () {
  const cfg = window.AUTORU_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const els = {
    status: $('status'), counter: $('counter'), grid: $('grid'),
    q: $('q'), city: $('city'), brand: $('brand'), body: $('body'),
    transmission: $('transmission'), drive: $('drive'), sort: $('sort'),
    reset: $('reset'), loadMore: $('loadMore'),
  };

  let cars = [];
  let filtered = [];
  let shown = 0;

  // ============ ЗАГРУЗКА ============
  fetch(cfg.csvUrl, { redirect: 'follow' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(text => {
      cars = parseCsv(text);
      els.status.textContent = 'Каталог: ' + cars.length + ' авто';
      populateSelects();
      apply();
    })
    .catch(err => { els.status.textContent = 'Ошибка загрузки: ' + err.message; });

  // ============ CSV ============
  function parseCsv(csv) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < csv.length; i++) {
      const c = csv[i];
      if (quoted) {
        if (c === '"') { if (csv[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
        else cell += c;
      } else {
        if (c === '"') quoted = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (c === '\r') { /* skip */ }
        else cell += c;
      }
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0];
    return rows.slice(1).filter(r => r.length > 1).map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] === undefined ? '' : r[i]; });
      return o;
    });
  }

  // ============ ФИЛЬТРЫ ============
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

  function apply() {
    const q = (els.q.value || '').trim().toLowerCase();
    const city = els.city.value, brand = els.brand.value, body = els.body.value;
    const tr = els.transmission.value, dr = els.drive.value;

    filtered = cars.filter(c => {
      if (city && c.city !== city) return false;
      if (brand && c.brand !== brand) return false;
      if (body && c.body !== body) return false;
      if (tr && c.transmission !== tr) return false;
      if (dr && c.drive !== dr) return false;
      if (q) {
        const hay = (c.title + ' ' + c.brand + ' ' + c.model + ' ' + c.city + ' ' + c.body + ' ' + c.color + ' ' + c.trim).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

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

    shown = 0;
    els.grid.innerHTML = '';
    render();
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
    const photo = (c.image_url || '').split('|')[0] || '';
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
