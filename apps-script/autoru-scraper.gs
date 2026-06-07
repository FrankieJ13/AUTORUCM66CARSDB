// ============ КОНФИГ ============
const SHEET_ID  = '1N8c3SLHCoZ0cdL4EcD4rgAphu7AMPjxrxPBL7dkOSUY';
const TAB_NAME  = 'AUTO.RU-CM66-CARS-DB';
const MAX_RUN_MS = 5 * 60 * 1000;     // выходим за 5 мин — буфер до 6-мин лимита Apps Script
const PAUSE_MS   = 1500;              // пауза между запросами страниц
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CITIES = [
  ['Барнаул',     'https://auto.ru/diler/cars/all/crystal_motors_barnaul/'],
  ['Кемерово',    'https://auto.ru/diler/cars/all/crystal_motors_kemerovo/'],
  ['Красноярск',  'https://auto.ru/diler/cars/all/crystal_motors_krasnoyarsk/'],
  ['Новокузнецк', 'https://auto.ru/diler/cars/all/crystal_motors_novokuzneck/'],
  ['Новосибирск', 'https://auto.ru/diler/cars/all/crystal_motors_novosibirsk/'],
  ['Омск',        'https://auto.ru/diler/cars/all/crystal_motors_omsk_omsk/'],
  ['Оренбург',    'https://auto.ru/diler/cars/all/crystal_motors_orenburg/'],
  ['Пермь',       'https://auto.ru/diler/cars/all/crystal_motors_perm/'],
  ['Сургут',      'https://auto.ru/diler/cars/used/crystal_motors_surgut/'],
  ['Томск',       'https://auto.ru/diler/cars/all/crystal_motors_tomsk_tomsk/'],
  ['Тюмень',      'https://auto.ru/diler/cars/all/crystal_motors_tumen/'],
  ['Челябинск',   'https://auto.ru/diler/cars/all/crystal_motors_na_universitetskoy_chelyabinsk/'],
];

// ============ МАППИНГИ ENUM → ЧИТАЕМОЕ ============
const TRANSMISSION = { AUTOMATIC: 'автоматическая', MECHANICAL: 'механическая', ROBOT: 'робот', VARIATOR: 'вариатор' };
const DRIVE = { FORWARD_CONTROL: 'передний', REAR_DRIVE: 'задний', ALL_WHEEL_DRIVE: 'полный' };
const WHEEL = { LEFT: 'Левый', RIGHT: 'Правый' };
const CONDITION = { CONDITION_OK: 'Не требует ремонта', CONDITION_BROKEN: 'Битый', CONDITION_REQUIRES_PARTIAL_REPAIR: 'Требует ремонта' };
const PTS = { ORIGINAL: 'Оригинал', DUPLICATE: 'Дубликат', ELECTRONIC: 'Электронный' };
const ENGINE_TYPE = { GASOLINE: 'бензин', DIESEL: 'дизель', HYBRID: 'гибрид', ELECTRO: 'электро', LPG: 'газ' };
const COLOR = {
  '040001':'чёрный','FAFBFB':'белый','0000CC':'синий','CACECB':'серый','97948F':'серебристый',
  'EE1D19':'красный','007F00':'зелёный','FFD600':'жёлтый','FF8649':'оранжевый','DEA522':'бежевый',
  '4A2197':'фиолетовый','200204':'коричневый','22A0F8':'голубой','C49648':'золотистый','FFC0CB':'розовый'
};

// ============ HTTP ============
function fetchAutoruHtml_(url) {
  // GDPR-флоу: первый запрос за куками
  const r1 = UrlFetchApp.fetch('https://auto.ru/gdpr/confirm/?retpath=' + encodeURIComponent(url), {
    muteHttpExceptions: true, followRedirects: false,
    headers: { 'User-Agent': UA }
  });
  const raw = r1.getAllHeaders()['Set-Cookie'];
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const cookie = arr.map(c => c.split(';')[0]).join('; ') + '; autoru_gdpr=1';

  const r2 = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9', 'Cookie': cookie }
  });
  if (r2.getResponseCode() !== 200) throw new Error('HTTP ' + r2.getResponseCode() + ' on ' + url);
  return r2.getContentText();
}

// ============ ПАРСЕР JSON-СОСТОЯНИЯ ============
// auto.ru вшивает SSR-state в несколько <script class="RIS" data-webpack-chunk-id="N">.
// Склеиваем по убыванию chunk-id, режем по балансу скобок, парсим.
function parseListingState_(html) {
  const re = /<script[^>]*class="RIS"[^>]*data-webpack-chunk-id="(\d+)"[^>]*>([\s\S]*?)<\/script>/g;
  const chunks = []; let m;
  while ((m = re.exec(html)) !== null) chunks.push([+m[1], m[2]]);
  chunks.sort((a, b) => b[0] - a[0]);
  const s = chunks.map(c => c[1]).join('');

  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (esc) { esc = false; continue; }
    if (c === 92) { esc = true; continue; }            // \
    if (c === 34) { inStr = !inStr; continue; }        // "
    if (inStr) continue;
    if (c === 123 || c === 91) depth++;                // { [
    else if (c === 125 || c === 93) { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('cannot locate balanced JSON in RIS chunks');
  return JSON.parse(s.slice(0, end));
}

// ============ МЭППИНГ ОФФЕРА В СТРОКУ ============
function offerToRow_(o, city) {
  const vi = o.vehicle_info || {}, tp = vi.tech_param || {}, doc = o.documents || {}, st = o.state || {};
  const imgs = (st.image_urls || [])
    .map(i => 'https:' + (i.sizes['1200x900'] || i.sizes.orig || ''))
    .filter(u => u !== 'https:').join('|');
  const colorHex = (o.color_hex || '').toUpperCase();
  const colorName = COLOR[colorHex] || (colorHex ? '#' + colorHex : '');
  const engine = tp.human_name
    ? (ENGINE_TYPE[tp.engine_type] ? ENGINE_TYPE[tp.engine_type] + ', ' + tp.human_name : tp.human_name)
    : '';

  return [
    (vi.mark_info && vi.mark_info.name) || '',
    (vi.model_info && vi.model_info.name) || '',
    o.title || '',
    o.url || '',
    (o.price_info && o.price_info.price) || '',
    city,
    doc.year || '',
    '',                                                                            // country — позже
    (vi.configuration && vi.configuration.seats && vi.configuration.seats[0]) || '',
    st.mileage || 0,
    doc.owners_number || '',
    CONDITION[st.condition] || st.condition || '',
    PTS[doc.pts] || doc.pts || '',
    (vi.complectation && vi.complectation.name) || '',
    engine,
    TRANSMISSION[tp.transmission] || tp.transmission || '',
    DRIVE[tp.gear_type] || tp.gear_type || '',
    WHEEL[vi.steering_wheel] || vi.steering_wheel || '',
    (vi.configuration && vi.configuration.human_name) || '',
    colorName,
    imgs,
    new Date().toISOString(),
  ];
}

// ============ ИСПОЛНЕНИЕ С ПРОДОЛЖЕНИЕМ ============
// startScrape: чистит лист, строит план обхода, запускает 5-минутный продолжатель.
// continueScrape: дорабатывает план до конца времени, сохраняет прогресс, удаляет себя когда всё.
function startScrape() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  const plan = CITIES.map(([city, url]) => ({ city, url, page: 1, totalPages: null, done: false }));
  PropertiesService.getScriptProperties().setProperty('plan', JSON.stringify(plan));
  scheduleContinuation_();
  continueScrape();
}

function continueScrape() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('plan');
  if (!raw) { clearContinuation_(); return; }
  const plan = JSON.parse(raw);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
  const t0 = Date.now();
  const rows = [];

  for (const job of plan) {
    if (job.done) continue;
    while (job.totalPages === null || job.page <= job.totalPages) {
      if (Date.now() - t0 > MAX_RUN_MS) {
        flushRows_(sheet, rows);
        props.setProperty('plan', JSON.stringify(plan));
        Logger.log('time up; will resume; flushed=' + rows.length);
        return;
      }
      try {
        const url = job.url + (job.page === 1 ? '' : '?page=' + job.page);
        const html = fetchAutoruHtml_(url);
        const state = parseListingState_(html);
        const listing = state.listing && state.listing.data;
        if (!listing) throw new Error('no listing.data');
        if (job.totalPages === null) {
          job.totalPages = (listing.pagination && listing.pagination.total_page_count) || 1;
        }
        (listing.offers || []).forEach(o => rows.push(offerToRow_(o, job.city)));
        Logger.log(job.city + ' p' + job.page + '/' + job.totalPages + ' +' + (listing.offers || []).length);
        job.page++;
      } catch (e) {
        Logger.log('ERR ' + job.city + ' p' + job.page + ': ' + e.message);
        job.page++;
      }
      Utilities.sleep(PAUSE_MS);
    }
    job.done = true;
  }

  flushRows_(sheet, rows);
  props.deleteProperty('plan');
  clearContinuation_();
  Logger.log('SCRAPE COMPLETE');
}

function flushRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ============ ТРИГГЕРЫ ============
function scheduleContinuation_() {
  clearContinuation_();
  ScriptApp.newTrigger('continueScrape').timeBased().everyMinutes(5).create();
}
function clearContinuation_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'continueScrape')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// Запустить один раз — поставит ежедневные старты в 00:00, 04:00, 13:00.
function installTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'startScrape')
    .forEach(t => ScriptApp.deleteTrigger(t));
  [0, 4, 13].forEach(h => {
    ScriptApp.newTrigger('startScrape').timeBased().atHour(h).everyDays(1).create();
  });
}
