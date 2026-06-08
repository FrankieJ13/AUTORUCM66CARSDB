(function () {
  const cfg = window.AUTORU_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const els = {
    status: $('status'), counter: $('counter'),
    statusMobile: $('statusMobile'), counterMobile: $('counterMobile'),
    grid: $('grid'), chips: $('chips'),
    q: $('q'),
    city: $('city'), brand: $('brand'), body: $('body'),
    transmission: $('transmission'), drive: $('drive'), wheel: $('wheel'),
    country: $('country'), seats: $('seats'), owners: $('owners'),
    pts: $('pts'), condition: $('condition'), color: $('color'),
    priceMin: $('priceMin'), priceMax: $('priceMax'),
    yearMin: $('yearMin'), yearMax: $('yearMax'), mileageMax: $('mileageMax'),
    sort: $('sort'),
    reset: $('reset'), loadMore: $('loadMore'),
    openFilters: $('openFilters'), filtersPopup: $('filtersPopup'), filtersCount: $('filtersCount'),
  };

  // Поля-фильтры по типу — для удобства итерации (reset, badge, события).
  const SELECT_FILTERS = ['city','brand','body','transmission','drive','wheel','country','seats','owners','pts','condition','color'];
  const NUMBER_FILTERS = ['priceMin','priceMax','yearMin','yearMax','mileageMax'];

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
      // дополним country из маппинга по марке (в данных пусто)
      cars.forEach(c => { if (!c.country) c.country = COUNTRY_BY_BRAND[c.brand] || ''; });
      const status = 'Каталог: ' + cars.length + ' авто';
      els.status.textContent = status;
      els.statusMobile.textContent = status;
      populateSelects();
      apply();
    })
    .catch(err => { els.status.textContent = 'Ошибка загрузки: ' + err.message; });

  // ============ ФИЛЬТРЫ-СЕЛЕКТЫ ============
  function populateSelects() {
    const fillText = (sel, values) => {
      const sorted = Array.from(new Set(values.filter(Boolean).map(String))).sort((a, b) => a.localeCompare(b, 'ru'));
      sorted.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
    };
    const fillNum = (sel, values, suffix) => {
      const sorted = Array.from(new Set(values.filter(v => v !== '' && v != null).map(Number).filter(Number.isFinite))).sort((a, b) => a - b);
      sorted.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v + (suffix || ''); sel.appendChild(o); });
    };
    fillText(els.city, cars.map(c => c.city));
    fillText(els.brand, cars.map(c => c.brand));
    fillText(els.body, cars.map(c => c.body));
    fillText(els.transmission, cars.map(c => c.transmission));
    fillText(els.drive, cars.map(c => c.drive));
    fillText(els.wheel, cars.map(c => c.wheel));
    fillText(els.country, cars.map(c => c.country));
    fillText(els.condition, cars.map(c => c.condition));
    fillText(els.color, cars.map(c => c.color));
    fillText(els.pts, cars.map(c => c.pts));
    fillNum(els.seats, cars.map(c => c.seats));
    fillNum(els.owners, cars.map(c => c.owners));
  }

  // ============ ПРИМЕНЕНИЕ ============
  function apply() {
    const rawQ = (els.q.value || '').trim();
    const parsed = rawQ && window.AutoSearch ? window.AutoSearch.parse(rawQ) : null;

    // селекты накладываются поверх распарсенного запроса
    const sel = {
      city: els.city.value, brand: els.brand.value, body: els.body.value,
      transmission: els.transmission.value, drive: els.drive.value, wheel: els.wheel.value,
      country: els.country.value, condition: els.condition.value, color: els.color.value,
      pts: els.pts.value, seats: els.seats.value, owners: els.owners.value,
    };
    const numFilters = {
      priceMin: Number(els.priceMin.value) || 0,
      priceMax: Number(els.priceMax.value) || 0,
      yearMin:  Number(els.yearMin.value)  || 0,
      yearMax:  Number(els.yearMax.value)  || 0,
      mileageMax: Number(els.mileageMax.value) || 0,
    };

    filtered = cars.filter(c => {
      if (sel.city  && c.city  !== sel.city)  return false;
      if (sel.brand && c.brand !== sel.brand) return false;
      if (sel.body  && c.body  !== sel.body)  return false;
      if (sel.transmission && c.transmission !== sel.transmission) return false;
      if (sel.drive && c.drive !== sel.drive) return false;
      if (sel.wheel && c.wheel !== sel.wheel) return false;
      if (sel.country && c.country !== sel.country) return false;
      if (sel.condition && c.condition !== sel.condition) return false;
      if (sel.color && c.color !== sel.color) return false;
      if (sel.pts && c.pts !== sel.pts) return false;
      if (sel.seats && String(c.seats) !== sel.seats) return false;
      if (sel.owners && String(c.owners) !== sel.owners) return false;
      const price = Number(c.price);
      if (numFilters.priceMin && !(price >= numFilters.priceMin)) return false;
      if (numFilters.priceMax && !(price <= numFilters.priceMax)) return false;
      const year = Number(c.year);
      if (numFilters.yearMin && !(year >= numFilters.yearMin)) return false;
      if (numFilters.yearMax && !(year <= numFilters.yearMax)) return false;
      const mileage = Number(c.mileage);
      if (numFilters.mileageMax && !(mileage <= numFilters.mileageMax)) return false;
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
    updateFiltersBadge();
    shown = 0;
    els.grid.innerHTML = '';
    render();
  }

  function updateFiltersBadge() {
    const active = SELECT_FILTERS.filter(k => els[k].value).length
                 + NUMBER_FILTERS.filter(k => els[k].value).length;
    if (active) {
      els.filtersCount.textContent = active;
      els.filtersCount.hidden = false;
    } else {
      els.filtersCount.hidden = true;
    }
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
      els.counterMobile.textContent = '0 из 0';
      return;
    }
    const slice = filtered.slice(shown, shown + pageSize);
    const frag = document.createDocumentFragment();
    slice.forEach(c => frag.appendChild(card(c)));
    els.grid.appendChild(frag);
    shown += slice.length;
    els.loadMore.hidden = shown >= filtered.length;
    const ct = shown + ' из ' + filtered.length;
    els.counter.textContent = ct;
    els.counterMobile.textContent = ct;
  }

  // ============ ИКОНКИ (line-style с blue→violet gradient через #iconGrad) ============
  const S = 'fill="none" stroke="url(#iconGrad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    year:   '<svg viewBox="0 0 24 24" ' + S + '><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8" cy="14" r=".6"/><circle cx="12" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/><circle cx="8" cy="18" r=".6"/><circle cx="12" cy="18" r=".6"/></svg>',
    flag:   '<svg viewBox="0 0 24 24" ' + S + '><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg>',
    seats:  '<svg viewBox="0 0 24 24" ' + S + '><path d="M8 21v-7h6l2-4V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2H6"/><path d="M6 14h2v7"/></svg>',
    miles:  '<svg viewBox="0 0 24 24" ' + S + '><circle cx="12" cy="13" r="8"/><path d="M9.5 16.5l3-3.5M7 13h.5M12 8v.5M17 13h-.5"/><circle cx="12" cy="13" r="1.2" fill="url(#iconGrad)"/></svg>',
    owner:  '<svg viewBox="0 0 24 24" ' + S + '><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6.5 7-6.5s7 3 7 6.5"/></svg>',
    state:  '<svg viewBox="0 0 24 24" ' + S + '><path d="M3 15l3-6h12l3 6v3H3z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/></svg>',
    pts:    '<svg viewBox="0 0 24 24" ' + S + '><path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4M9 13h4M9 16h6"/></svg>',
    trim:   '<svg viewBox="0 0 24 24" ' + S + '><path d="M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3-5.4 3 1.3-6L3.4 9.2l6-.6L12 3z"/></svg>',
    engine: '<svg viewBox="0 0 24 24" ' + S + '><path d="M4 11h2V9h3V7h6v2h2v2h2v4h-2v2h-2v2H9v-2H6v-2H4z"/><path d="M17 13h2M5 13h1"/></svg>',
    fuel:   '<svg viewBox="0 0 24 24" ' + S + '><rect x="4" y="4" width="9" height="16" rx="1"/><path d="M4 9h9M7 7h3"/><path d="M13 11h3a2 2 0 0 1 2 2v3a1 1 0 0 0 2 0V9l-2-2"/></svg>',
    gearbox:'<svg viewBox="0 0 24 24" ' + S + '><path d="M6 8v8M12 6v12M18 8v8"/><circle cx="6" cy="7" r="1"/><circle cx="6" cy="17" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="18" cy="7" r="1"/><circle cx="18" cy="17" r="1"/></svg>',
    drive:  '<svg viewBox="0 0 24 24" ' + S + '><circle cx="5" cy="7" r="1.5"/><circle cx="19" cy="7" r="1.5"/><circle cx="5" cy="17" r="1.5"/><circle cx="19" cy="17" r="1.5"/><path d="M6.5 7h11M6.5 17h11M12 8.5v7"/><circle cx="12" cy="7" r="1.2"/><circle cx="12" cy="17" r="1.2"/></svg>',
    wheel:  '<svg viewBox="0 0 24 24" ' + S + '><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 5v5M5 13c2 0 5 1.5 6 2M19 13c-2 0-5 1.5-6 2"/></svg>',
    body:   '<svg viewBox="0 0 24 24" ' + S + '><path d="M3 15l3-5h12l3 5v3H3z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/></svg>',
    color:  '<svg viewBox="0 0 24 24" ' + S + '><path d="M12 3a9 9 0 0 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/><circle cx="18" cy="11" r="1"/></svg>',
  };

  // Плитка: иконка | значение. Лейбл переезжает в title (тултип) — иконки достаточно.
  function tile(icon, label, value) {
    if (!value && value !== 0) return '';
    return '<div class="tile" title="' + esc(label) + ': ' + esc(String(value)) + '">' +
      '<span class="tile__icon">' + ICONS[icon] + '</span>' +
      '<span class="tile__value">' + esc(String(value)) + '</span>' +
    '</div>';
  }

  // Страна марки — статический маппинг (в данных пусто, заполняем здесь).
  const COUNTRY_BY_BRAND = {
    Toyota:'Япония', Nissan:'Япония', Honda:'Япония', Mazda:'Япония', Mitsubishi:'Япония',
    Subaru:'Япония', Suzuki:'Япония', Lexus:'Япония', Infiniti:'Япония', Daihatsu:'Япония',
    Acura:'Япония', Isuzu:'Япония',
    'Mercedes-Benz':'Германия', BMW:'Германия', Audi:'Германия', Volkswagen:'Германия',
    Porsche:'Германия', Opel:'Германия', Smart:'Германия', MAN:'Германия',
    Lada:'Россия', 'ВАЗ':'Россия', GAZ:'Россия', UAZ:'Россия', Moskvich:'Россия',
    Москвич:'Россия', Aurus:'Россия',
    Renault:'Франция', Peugeot:'Франция', Citroen:'Франция', Bugatti:'Франция', DS:'Франция',
    Hyundai:'Корея', Kia:'Корея', Genesis:'Корея', SsangYong:'Корея', Daewoo:'Корея',
    Chery:'Китай', Geely:'Китай', Haval:'Китай', GAC:'Китай', BYD:'Китай', Changan:'Китай',
    Jetour:'Китай', Lifan:'Китай', FAW:'Китай', Tank:'Китай', Voyah:'Китай', Zeekr:'Китай',
    MG:'Китай', Exeed:'Китай', Brilliance:'Китай', Dongfeng:'Китай', Omoda:'Китай',
    JAC:'Китай', Hongqi:'Китай', Foton:'Китай', Skywell:'Китай', Xpeng:'Китай', LiXiang:'Китай',
    Ford:'США', Chevrolet:'США', Cadillac:'США', Chrysler:'США', Dodge:'США', Jeep:'США',
    Tesla:'США', Lincoln:'США', GMC:'США', Buick:'США', Hummer:'США', Ram:'США',
    Volvo:'Швеция', Saab:'Швеция', Skoda:'Чехия',
    Fiat:'Италия', 'Alfa Romeo':'Италия', Ferrari:'Италия', Lamborghini:'Италия', Maserati:'Италия',
    'Land Rover':'Великобритания', Jaguar:'Великобритания', Mini:'Великобритания',
    Bentley:'Великобритания', 'Aston Martin':'Великобритания', 'Rolls-Royce':'Великобритания',
    SEAT:'Испания', Cupra:'Испания',
  };

  const STRIP_SVG = {
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="url(#iconGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="url(#iconGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 6.5a3.5 3.5 0 0 0-3 5.3L4 20.3 5.7 22l8.5-8.5a3.5 3.5 0 1 0 1.3-7z"/><circle cx="15.5" cy="6.5" r="1.2" fill="url(#iconGrad)"/></svg>',
    doc:    '<svg viewBox="0 0 24 24" fill="none" stroke="url(#iconGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M8.5 14l2 2 3.5-4"/></svg>',
    pin:    '<svg viewBox="0 0 24 24" fill="none" stroke="url(#iconGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  };

  // Адреса дилеров по городу (из тз).
  const ADDRESS_BY_CITY = {
    'Пермь':       'Спешилова 101а',
    'Челябинск':   'Кузнецова 1а',
    'Барнаул':     'Правобережный тракт 26',
    'Новосибирск': 'Большевистская 276',
    'Тюмень':      'Республики 254/3',
    'Омск':        'Енисейская 18/1',
    'Томск':       'Смирнова 5и',
    'Красноярск':  'Караульная 47',
    'Оренбург':    'Загородное шоссе 13/7',
    'Кемерово':    'Тухачевского 64',
    'Новокузнецк': 'Байдаевское шоссе 22',
    'Сургут':      'Производственная 6',
  };

  function card(c) {
    const photo = c.image_url || '';
    const country = c.country || COUNTRY_BY_BRAND[c.brand] || '';
    const brand = c.brand || '';
    // строка 2 = модель + поколение (если в title есть генерация после модели)
    let modelLine = c.model || '';
    if (c.title && brand && modelLine) {
      const prefix = (brand + ' ' + modelLine).toLowerCase();
      if (c.title.toLowerCase().startsWith(prefix)) {
        const tail = c.title.slice(prefix.length).trim();
        if (tail) modelLine = modelLine + ' ' + tail;
      }
    }
    if (!brand && !modelLine) modelLine = c.title || '';
    const addr = ADDRESS_BY_CITY[c.city] || '';
    const addrLine = [c.city, addr].filter(Boolean).join(', ');

    // Карточка НЕ кликабельна целиком. Кликабельно только фото.
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML =
      // Шапка на всю ширину
      '<div class="card__head">' +
        '<div class="card__head-left">' +
          (brand ?     '<h3 class="card__title">' + esc(brand) + '</h3>' : '') +
          (modelLine ? '<div class="card__subtitle">' + esc(modelLine) + '</div>' : '') +
        '</div>' +
        '<div class="card__head-right">' +
          '<div class="card__price">' + fmtPrice(c.price) + '</div>' +
          (addrLine ? '<div class="card__addr">' + STRIP_SVG.pin + esc(addrLine) + '</div>' : '') +
        '</div>' +
      '</div>' +
      // Фото слева, плитки справа — на уровне метрик
      '<a class="card__media" href="' + esc(c.url || '#') + '" target="_blank" rel="noopener">' +
        (photo ? '<img loading="lazy" src="' + esc(photo) + '" alt="' + esc(brand + ' ' + modelLine) + '">' : '') +
      '</a>' +
      '<div class="tiles">' +
          tile('year',    'Год',         c.year) +
          tile('engine',  'Двигатель',   c.engine) +
          tile('flag',    'Страна',      country) +
          tile('gearbox', 'Коробка',     c.transmission) +
          tile('seats',   'Мест',        c.seats) +
          tile('drive',   'Привод',      c.drive) +
          tile('miles',   'Пробег',      fmtMileage(c.mileage)) +
          tile('wheel',   'Руль',        c.wheel) +
          tile('owner',   'Владельцы',   c.owners) +
          tile('body',    'Кузов',       c.body) +
          tile('state',   'Состояние',   c.condition) +
          tile('color',   'Цвет',        c.color) +
          tile('pts',     'ПТС',         c.pts) +
      '</div>' +
      // Нижняя плашка-стрип: трастовые бейджи (адрес теперь в шапке под ценой)
      '<div class="card__strip">' +
        '<span class="strip-item">' + STRIP_SVG.shield + 'Проверенный автомобиль</span>' +
        '<span class="strip-sep"></span>' +
        '<span class="strip-item">' + STRIP_SVG.wrench + 'Техническая проверка</span>' +
        '<span class="strip-sep"></span>' +
        '<span class="strip-item">' + STRIP_SVG.doc + 'Юридическая чистота</span>' +
      '</div>';
    return el;
  }

  // ============ УТИЛИТЫ ============
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function fmtPrice(p) { const n = num(p); return n ? n.toLocaleString('ru-RU') + ' ₽' : '—'; }
  function fmtMileage(m) { const n = num(m); return n ? n.toLocaleString('ru-RU') + ' км' : '—'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

  // ============ СОБЫТИЯ ============
  els.q.addEventListener('input', apply);
  SELECT_FILTERS.concat('sort').forEach(k => els[k].addEventListener('change', apply));
  NUMBER_FILTERS.forEach(k => els[k].addEventListener('input', apply));
  els.reset.addEventListener('click', () => {
    els.q.value = '';
    SELECT_FILTERS.forEach(k => { els[k].value = ''; });
    NUMBER_FILTERS.forEach(k => { els[k].value = ''; });
    els.sort.value = 'price_asc';
    apply();
  });
  els.loadMore.addEventListener('click', render);

  // ============ ПОПАП ФИЛЬТРОВ ============
  els.openFilters.addEventListener('click', (e) => {
    e.stopPropagation();
    els.filtersPopup.hidden = !els.filtersPopup.hidden;
  });
  document.addEventListener('click', (e) => {
    if (els.filtersPopup.hidden) return;
    if (e.target === els.openFilters || els.openFilters.contains(e.target)) return;
    if (els.filtersPopup.contains(e.target)) return;
    els.filtersPopup.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') els.filtersPopup.hidden = true;
  });
})();
