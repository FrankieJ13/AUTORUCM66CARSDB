// Запустить один раз — создаёт лист AUTO.RU-CM66-CARS-DB и шапку из 22 колонок.
const SHEET_ID = '1N8c3SLHCoZ0cdL4EcD4rgAphu7AMPjxrxPBL7dkOSUY';
const TAB_NAME = 'AUTO.RU-CM66-CARS-DB';

function setupHeaders() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(TAB_NAME) || ss.insertSheet(TAB_NAME);

  const headers = [
    'brand', 'model', 'title', 'url', 'price', 'city',
    'year', 'country', 'seats', 'mileage', 'owners', 'condition', 'pts',
    'trim', 'engine', 'transmission', 'drive', 'wheel', 'body', 'color',
    'image_url', 'updated_at'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}
