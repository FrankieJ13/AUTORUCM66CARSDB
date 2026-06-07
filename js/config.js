// Фронт читает cars.csv из этого же репо.
// GH Pages отдаёт его по тому же домену → никакого CORS, никакой публикации Sheet.
window.AUTORU_CONFIG = {
  csvUrl: "cars.csv",
  pageSize: 24,
};
