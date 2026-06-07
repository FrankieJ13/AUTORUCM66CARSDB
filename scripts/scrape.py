#!/usr/bin/env python3
"""
Скрапер auto.ru → cars.csv.
Стандартная либа Python, без зависимостей.
"""
import csv
import datetime as dt
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
PAUSE = 1.2

CITIES = [
    ("Барнаул",     "https://auto.ru/diler/cars/all/crystal_motors_barnaul/"),
    ("Кемерово",    "https://auto.ru/diler/cars/all/crystal_motors_kemerovo/"),
    ("Красноярск",  "https://auto.ru/diler/cars/all/crystal_motors_krasnoyarsk/"),
    ("Новокузнецк", "https://auto.ru/diler/cars/all/crystal_motors_novokuzneck/"),
    ("Новосибирск", "https://auto.ru/diler/cars/all/crystal_motors_novosibirsk/"),
    ("Омск",        "https://auto.ru/diler/cars/all/crystal_motors_omsk_omsk/"),
    ("Оренбург",    "https://auto.ru/diler/cars/all/crystal_motors_orenburg/"),
    ("Пермь",       "https://auto.ru/diler/cars/all/crystal_motors_perm/"),
    ("Сургут",      "https://auto.ru/diler/cars/used/crystal_motors_surgut/"),
    ("Томск",       "https://auto.ru/diler/cars/all/crystal_motors_tomsk_tomsk/"),
    ("Тюмень",      "https://auto.ru/diler/cars/all/crystal_motors_tumen/"),
    ("Челябинск",   "https://auto.ru/diler/cars/all/crystal_motors_na_universitetskoy_chelyabinsk/"),
]

TRANSMISSION = {"AUTOMATIC": "автоматическая", "MECHANICAL": "механическая", "ROBOT": "робот", "VARIATOR": "вариатор"}
DRIVE = {"FORWARD_CONTROL": "передний", "REAR_DRIVE": "задний", "ALL_WHEEL_DRIVE": "полный"}
WHEEL = {"LEFT": "Левый", "RIGHT": "Правый"}
CONDITION = {"CONDITION_OK": "Не требует ремонта", "CONDITION_BROKEN": "Битый", "CONDITION_REQUIRES_PARTIAL_REPAIR": "Требует ремонта"}
PTS = {"ORIGINAL": "Оригинал", "DUPLICATE": "Дубликат", "ELECTRONIC": "Электронный"}
ENGINE_TYPE = {"GASOLINE": "бензин", "DIESEL": "дизель", "HYBRID": "гибрид", "ELECTRO": "электро", "LPG": "газ"}
COLOR = {
    "040001": "чёрный", "FAFBFB": "белый", "0000CC": "синий", "CACECB": "серый", "97948F": "серебристый",
    "EE1D19": "красный", "007F00": "зелёный", "FFD600": "жёлтый", "FF8649": "оранжевый", "DEA522": "бежевый",
    "4A2197": "фиолетовый", "200204": "коричневый", "22A0F8": "голубой", "C49648": "золотистый", "FFC0CB": "розовый",
}

HEADERS = [
    "brand", "model", "title", "url", "price", "city",
    "year", "country", "seats", "mileage", "owners", "condition", "pts",
    "trim", "engine", "transmission", "drive", "wheel", "body", "color",
    "image_url", "updated_at",
]


def make_opener():
    cj = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    opener.addheaders = [
        ("User-Agent", UA),
        ("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
        ("Accept-Language", "ru-RU,ru;q=0.9"),
    ]
    return opener


def fetch_html(opener, url, prime=False):
    if prime:
        gdpr = "https://auto.ru/gdpr/confirm/?retpath=" + urllib.parse.quote(url, safe="")
        try:
            opener.open(gdpr, timeout=30).read()
        except Exception as e:
            print(f"  gdpr-prime warn: {e}", flush=True)
    with opener.open(url, timeout=60) as r:
        if r.status != 200:
            raise RuntimeError(f"HTTP {r.status} on {url}")
        return r.read().decode("utf-8", errors="replace")


CHUNK_RE = re.compile(
    r'<script[^>]*class="RIS"[^>]*data-webpack-chunk-id="(\d+)"[^>]*>([\s\S]*?)</script>'
)


def find_balanced_end(s):
    depth = 0
    in_str = False
    esc = False
    for i, c in enumerate(s):
        if esc:
            esc = False
            continue
        if c == "\\":
            esc = True
            continue
        if c == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
            if depth == 0:
                return i + 1
    return -1


def parse_listing_state(html):
    chunks = [(int(m.group(1)), m.group(2)) for m in CHUNK_RE.finditer(html)]
    if not chunks:
        raise RuntimeError("no RIS chunks (likely IP-blocked or wrong page)")
    root_idx = next((i for i, (_, b) in enumerate(chunks) if b[:1] == "{"), -1)
    if root_idx < 0:
        sample = " | ".join(f"id={c[0]} len={len(c[1])} start={c[1][:30]!r}" for c in chunks)
        raise RuntimeError(f"no root chunk; chunks: {sample}")

    root = chunks[root_idx]
    rest = [c for i, c in enumerate(chunks) if i != root_idx]
    orderings = [
        [root] + sorted(rest, key=lambda c: -c[0]),
        [root] + rest,
        [root] + sorted(rest, key=lambda c: c[0]),
        [root],
    ]
    last_err = None
    for order in orderings:
        s = "".join(b for _, b in order)
        end = find_balanced_end(s)
        if end < 0:
            last_err = "unbalanced"
            continue
        try:
            obj = json.loads(s[:end])
        except json.JSONDecodeError as e:
            last_err = str(e)
            continue
        if obj and obj.get("listing", {}).get("data", {}).get("offers") is not None:
            return obj
        last_err = "no listing.data.offers"
    raise RuntimeError(f"reassemble failed: {last_err}")


def offer_to_row(o, city):
    vi = o.get("vehicle_info") or {}
    tp = vi.get("tech_param") or {}
    doc = o.get("documents") or {}
    st = o.get("state") or {}

    imgs = []
    for i in st.get("image_urls") or []:
        sz = i.get("sizes") or {}
        u = sz.get("1200x900") or sz.get("orig")
        if u:
            imgs.append("https:" + u)
    image_url = "|".join(imgs)

    color_hex = (o.get("color_hex") or "").upper()
    color = COLOR.get(color_hex) or (f"#{color_hex}" if color_hex else "")

    eng_human = tp.get("human_name") or ""
    eng_type = ENGINE_TYPE.get(tp.get("engine_type") or "")
    engine = (f"{eng_type}, {eng_human}" if eng_type and eng_human else eng_human)

    seats = (vi.get("configuration") or {}).get("seats") or []

    return {
        "brand": (vi.get("mark_info") or {}).get("name", ""),
        "model": (vi.get("model_info") or {}).get("name", ""),
        "title": o.get("title", ""),
        "url": o.get("url", ""),
        "price": (o.get("price_info") or {}).get("price", ""),
        "city": city,
        "year": doc.get("year", ""),
        "country": "",
        "seats": seats[0] if seats else "",
        "mileage": st.get("mileage", 0) or 0,
        "owners": doc.get("owners_number", ""),
        "condition": CONDITION.get(st.get("condition") or "", st.get("condition") or ""),
        "pts": PTS.get(doc.get("pts") or "", doc.get("pts") or ""),
        "trim": (vi.get("complectation") or {}).get("name", "") or "",
        "engine": engine,
        "transmission": TRANSMISSION.get(tp.get("transmission") or "", tp.get("transmission") or ""),
        "drive": DRIVE.get(tp.get("gear_type") or "", tp.get("gear_type") or ""),
        "wheel": WHEEL.get(vi.get("steering_wheel") or "", vi.get("steering_wheel") or ""),
        "body": (vi.get("configuration") or {}).get("human_name", ""),
        "color": color,
        "image_url": image_url,
        "updated_at": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }


def scrape_city(opener, city, base_url):
    rows = []
    page = 1
    total_pages = None
    primed = False
    while total_pages is None or page <= total_pages:
        url = base_url if page == 1 else base_url + f"?page={page}"
        try:
            html = fetch_html(opener, url, prime=not primed)
            primed = True
            state = parse_listing_state(html)
            listing = state["listing"]["data"]
            if total_pages is None:
                total_pages = (listing.get("pagination") or {}).get("total_page_count") or 1
            offers = listing.get("offers") or []
            for o in offers:
                rows.append(offer_to_row(o, city))
            print(f"  {city} p{page}/{total_pages} +{len(offers)}", flush=True)
        except Exception as e:
            print(f"  ERR {city} p{page}: {e}", flush=True)
        page += 1
        time.sleep(PAUSE)
    return rows


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "cars.csv"
    opener = make_opener()
    all_rows = []
    for city, url in CITIES:
        print(f"== {city} ==", flush=True)
        all_rows.extend(scrape_city(opener, city, url))
    # write CSV (overwrite)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADERS)
        w.writeheader()
        for r in all_rows:
            w.writerow(r)
    print(f"TOTAL: {len(all_rows)} rows → {out_path}", flush=True)


if __name__ == "__main__":
    main()
