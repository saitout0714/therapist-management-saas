#!/usr/bin/env python3

"""
shift_scraper.py  ─  ホームページからシフトをスクレイピングして Supabase に登録する

対応サイト:
  - 辻堂茅ヶ崎       (mens-esthe-tsujido.com)
  - クイーンテラス    (queen-terrace.com)
  - こころリンス浅草橋 (kokoro-rinse.com)
  - こころリンス大山   (ooyama.kokoro-rinse.com)
  - ローズカフェ      (rosecafe.men-este.com)
  - 淑女の秘密スパ    (himitsuspa.com)
  - クリスタルスパ    (crystalspayokkaichi.com)
  - 裏妻SPA          (urazuma.com)
"""


import argparse
import re
import time
from datetime import date, datetime, timedelta

import requests
from bs4 import BeautifulSoup

# ── Supabase 設定 ────────────────────────────────────────────────
SUPABASE_URL = "https://pumkniqtgjsotsxhyvbq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# ── ショップ ID ──────────────────────────────────────────────────
SHOP_ID_TSUJIDO    = "92c51e51-339b-48ce-8535-0f45c859b195"
SHOP_ID_QUEEN      = "960d84c5-d1cd-44bc-a39a-85f8ecc3d51a"
SHOP_ID_KOKORO_A   = "dc3caa06-fcc2-4bdc-b063-7969296efd34"
SHOP_ID_KOKORO_O   = "a0000001-0000-0000-0000-000000000004"
SHOP_ID_ROSECAFE   = "a0000001-0000-0000-0000-000000000005"
SHOP_ID_HIMITSUSPA = "3464ed8c-44e8-46f1-b701-9b6ae0f465a8"
SHOP_ID_CRYSTALSPA = "1faab510-3c7e-4a01-9ce6-d3b93bbdad81"
SHOP_ID_URAZUMA    = "da3ac7a8-e84d-4dbd-830c-81e9e8b6631a"

# ── サイト定義 ───────────────────────────────────────────────────
SITES = [
    {
        "name": "辻堂茅ヶ崎",
        "shop_id": SHOP_ID_TSUJIDO,
        "type": "tsujido",
        "url_tpl": "https://mens-esthe-tsujido.com/schedule/?works={date}",
        "container": "#all_content",
        "box_selector": ".therapist-box.archive-sche",
        "name_sel": ".therapist_name",
        "time_sel": ".therapist_time",
    },
    {
        "name": "クイーンテラス",
        "shop_id": SHOP_ID_QUEEN,
        "type": "tsujido",
        "url_tpl": "https://queen-terrace.com/schedule/?works={date}",
        "container": ".castlist",
        "box_selector": ".therapist-box",
        "name_sel": ".therapist_name",
        "time_sel": ".therapist_time",
    },
    {
        "name": "こころリンス浅草橋",
        "shop_id": SHOP_ID_KOKORO_A,
        "type": "kokoro",
        "url_tpl": "https://kokoro-rinse.com/schedule/?works={date}",
        "name_sel": ".therapist_name",
        "time_sel": ".startend",
    },
    {
        "name": "こころリンス大山",
        "shop_id": SHOP_ID_KOKORO_O,
        "type": "kokoro",
        "url_tpl": "https://ooyama.kokoro-rinse.com/schedule/?works={date}",
        "name_sel": ".therapist_name",
        "time_sel": ".startend",
    },
    {
        "name": "ローズカフェ",
        "shop_id": SHOP_ID_ROSECAFE,
        "type": "rosecafe",
        "url_tpl": "https://rosecafe.men-este.com/schedule.html?dat={date}",
    },
    {
        "name": "淑女の秘密スパ",
        "shop_id": SHOP_ID_HIMITSUSPA,
        "type": "himitsuspa",
        "url_tpl": "https://himitsuspa.com/schedule/index.php?day={date_compact}",
    },
    {
        "name": "クリスタルスパ",
        "shop_id": SHOP_ID_CRYSTALSPA,
        "type": "crystalspa",
        "url_tpl": "https://crystalspayokkaichi.com/schedule/?works={date}",
    },
    {
        "name": "裏妻SPA",
        "shop_id": SHOP_ID_URAZUMA,
        "type": "urazuma",
        "url_tpl": "https://urazuma.com/shift-schedule/?date={date_compact}",
    },
]


# ═══════════════════════════════════════════════════════════════════
# ユーティリティ
# ═══════════════════════════════════════════════════════════════════

def normalize_name(raw: str) -> str:
    if not raw:
        return ""
    s = raw.strip()
    s = re.sub(r"[\(（][^\)）]*[\)）]", "", s)
    s = re.sub(r"[〈《<][^〉 sweat_suite>]*[〉》>]", "", s) # Swept other patterns
    s = re.sub(r"\d{1,2}/\d{1,2}(初出勤|デビュー|出勤)?", "", s)
    s = re.sub(r"(初出勤|デビュー|NEW|new|🆕)", "", s)
    s = re.sub(r"[★☆♡♥✨💫🆕✿❤️🌸🌺🌹💋💕💓💗💝♪🎵🎀🍀🌟⭐🌙☀️🌈🦋🐝🌼🌻🍓🍒]", "", s)
    s = re.sub(r"[\s\u3000]+", "", s)
    s = re.sub(r"[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f\u4e00-\u9fff]", "", s)
    return s.strip()


def parse_time(text: str):
    m = re.search(r"(\d{1,2}:\d{2})\s*[～~\-]\s*(LAST|\d{1,2}:\d{2})", text, re.IGNORECASE)
    if not m:
        return None, None
    start = m.group(1)
    end_raw = m.group(2).upper()
    sh, sm = start.split(":")
    if end_raw == "LAST":
        end = "29:00"
    else:
        eh, em = end_raw.split(":")
        end = f"{int(eh):02d}:{em}"
    return f"{int(sh):02d}:{sm}", end


def fetch_html(url: str) -> BeautifulSoup:
    resp = requests.get(url, timeout=15)
    resp.encoding = resp.apparent_encoding
    return BeautifulSoup(resp.text, "html.parser")


# ═══════════════════════════════════════════════════════════════════
# Supabase API ヘルパー
# ═══════════════════════════════════════════════════════════════════

def get_therapists(shop_id: str) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/therapists?shop_id=eq.{shop_id}&select=id,name"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    return {normalize_name(t["name"]): t["id"] for t in r.json()}


def get_rooms(shop_id: str) -> list:
    url = f"{SUPABASE_URL}/rest/v1/rooms?shop_id=eq.{shop_id}&select=id,name"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    return r.json()


def get_existing_shifts(shop_id: str, date_str: str) -> dict:
    """既登録シフトを {therapist_id: {id, start_time, end_time, room_id}} で返す"""
    url = (
        f"{SUPABASE_URL}/rest/v1/shifts"
        f"?shop_id=eq.{shop_id}&date=eq.{date_str}"
        f"&select=id,therapist_id,start_time,end_time,room_id"
    )
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    result = {}
    for s in r.json():
        result[s["therapist_id"]] = {
            "id": s["id"],
            "start_time": s["start_time"][:5] if s["start_time"] else None,
            "end_time":   s["end_time"][:5]   if s["end_time"]   else None,
            "room_id":    s["room_id"],
        }
    return result


def register_shift(therapist_id, shop_id, date_str, room_id, start_time, end_time, dry_run):
    """新規登録（POST）"""
    if dry_run:
        return True
    payload = {
        "therapist_id": therapist_id,
        "shop_id": shop_id,
        "date": date_str,
        "room_id": room_id,
        "start_time": start_time,
        "end_time": end_time,
    }
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/shifts"
        '?columns="therapist_id","shop_id","date","room_id","start_time","end_time"',
        json=payload,
        headers=HEADERS,
    )
    if r.status_code not in (200, 201):
        print(f"    ❌ POST失敗 {r.status_code}: {r.text[:200]}")
        return False
    return True


def update_shift(shift_id, room_id, start_time, end_time, dry_run):
    """既存シフトを更新（PATCH）"""
    if dry_run:
        return True
    payload = {
        "room_id":    room_id,
        "start_time": start_time,
        "end_time":   end_time,
    }
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/shifts?id=eq.{shift_id}",
        json=payload,
        headers=HEADERS,
    )
    if r.status_code not in (200, 204):
        print(f"    ❌ PATCH失敗 {r.status_code}: {r.text[:200]}")
        return False
    return True


def delete_shift(shift_id, dry_run):
    """シフト削除（DELETE）"""
    if dry_run:
        return True
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/shifts?id=eq.{shift_id}",
        headers=HEADERS,
    )
    if r.status_code not in (200, 204):
        print(f"    ❌ DELETE失敗 {r.status_code}: {r.text[:200]}")
        return False
    return True


def match_therapist(norm_name: str, therapist_map: dict):
    if norm_name in therapist_map:
        return therapist_map[norm_name]
    for k, v in therapist_map.items():
        if k.startswith(norm_name) or norm_name.startswith(k):
            return v
    for k, v in therapist_map.items():
        if len(norm_name) >= 2 and (norm_name in k or k in norm_name):
            return v
    return None


def resolve_room(room_name: str, rooms: list):
    if not rooms:
        return None
    if room_name:
        # ① 完全一致を優先
        for r in rooms:
            if r["name"] == room_name:
                return r["id"]
        # ② 部分一致（ただし短い方が長い方に含まれる場合は長い方を優先）
        candidates = [
            r for r in rooms
            if room_name in r["name"] or r["name"] in room_name
        ]
        if candidates:
            # より文字列長が近いものを優先（誤マッチを防ぐ）
            candidates.sort(key=lambda r: abs(len(r["name"]) - len(room_name)))
            return candidates[0]["id"]
        return None
    return rooms[0]["id"]


# ═══════════════════════════════════════════════════════════════════
# スクレイパー
# ═══════════════════════════════════════════════════════════════════

def scrape_tsujido(site: dict, date_str: str) -> list:
    url = site["url_tpl"].format(date=date_str)
    soup = fetch_html(url)
    container = soup.select_one(site["container"])
    if not container:
        print(f"    ⚠ コンテナ '{site['container']}' が見つかりません")
        return []
    results = []
    for box in container.select(site["box_selector"]):
        name_el = (
            box.select_one("h3.name a")
            or box.select_one(".name a")
            or box.select_one(site["name_sel"])
        )
        if not name_el:
            continue
        raw_name = name_el.get_text()

        time_el = (
            box.select_one(".time-box-wrap")
            or box.select_one(".todays-time")
            or box.select_one(site["time_sel"])
        )
        if not time_el:
            continue
        start, end = parse_time(time_el.get_text())
        if not start:
            continue

        room_el = box.select_one("p.room")
        room_raw = room_el.get_text(strip=True) if room_el else ""
        room_name = re.sub(r"[（）()\s]", "", room_raw)

        results.append({"name": raw_name, "start": start, "end": end, "room": room_name})
    return results


def scrape_kokoro(site: dict, date_str: str) -> list:
    url = site["url_tpl"].format(date=date_str)
    soup = fetch_html(url)
    labels = soup.select(".tab_area label")
    panels = soup.select(".tab_panel")
    if not labels or not panels:
        print(f"    ⚠ タブ/パネルが見つかりません")
        return []
    target_dt = datetime.strptime(date_str, "%Y-%m-%d")
    target_label_md = f"{target_dt.month}/{target_dt.day}"
    panel_idx = None
    for i, label in enumerate(labels):
        if label.get_text(strip=True).startswith(target_label_md):
            panel_idx = i
            break
    if panel_idx is None:
        print(f"    ⚠ {date_str} に対応するタブが見つかりません")
        return []
    if panel_idx >= len(panels):
        print(f"    ⚠ パネルインデックス {panel_idx} が範囲外")
        return []
    panel = panels[panel_idx]
    results = []
    for box in panel.select(".cast-flex"):
        raw_name = box.select_one(site["name_sel"])
        raw_time = box.select_one(site["time_sel"])
        if not raw_name or not raw_time:
            continue
        start, end = parse_time(raw_time.get_text())
        if not start:
            continue
        results.append({"name": raw_name.get_text(), "start": start, "end": end, "room": ""})
    return results


def scrape_rosecafe(site: dict, date_str: str) -> list:
    url = site["url_tpl"].format(date=date_str)
    soup = fetch_html(url)
    panels = soup.select(".main-tab-panel")
    container = panels[0] if panels else soup
    results = []
    seen = set()
    for box in container.select(".staff-box"):
        room_wrap = box.select_one(".list_roomicon_wrap")
        if not room_wrap:
            continue
        name_el = box.select_one(".box-inner li")
        if not name_el:
            continue
        raw_name = name_el.get_text(strip=True)
        norm = normalize_name(raw_name)
        if not norm or norm in ("スタッフ", "料金", "新人", "全員"):
            continue
        time_text = room_wrap.get_text()
        start, end = parse_time(time_text)
        if not start:
            continue
        sh = int(start.split(":")[0])
        eh = int(end.split(":")[0])
        if eh > 26 and sh <= 6:
            continue
        room_el = box.select_one(".list_roomicon")
        room_name = room_el.get_text(strip=True) if room_el else ""
        key = (norm, start)
        if key in seen:
            continue
        seen.add(key)
        results.append({"name": raw_name, "start": start, "end": end, "room": room_name})
    return results


def scrape_himitsuspa(site: dict, date_str: str) -> list:
    date_compact = date_str.replace("-", "")
    url = site["url_tpl"].format(date_compact=date_compact)
    soup = fetch_html(url)
    results = []
    for view in soup.select(".therapist_view"):
        name_el = view.select_one(".therapist_name")
        time_el = view.select_one(".therapist_time")
        if not name_el or not time_el:
            continue
        raw_name = name_el.get_text(strip=True)
        raw_time = time_el.get_text(strip=True)
        start, end = parse_time(raw_time)
        if not start:
            continue
        results.append({"name": raw_name, "start": start, "end": end, "room": ""})
    return results


def scrape_crystalspa(site: dict, date_str: str) -> list:
    url = site["url_tpl"].format(date=date_str)
    soup = fetch_html(url)
    results = []
    for box in soup.select(".one-cast"):
        name_el = box.select_one("span.cast-name")
        time_el = box.select_one("span.worktime")
        if not name_el or not time_el:
            continue
        raw_name = name_el.get_text(strip=True)
        start, end = parse_time(time_el.get_text())
        if not start:
            continue
        results.append({"name": raw_name, "start": start, "end": end, "room": ""})
    return results


def scrape_urazuma(site: dict, date_str: str) -> list:
    date_compact = date_str.replace("-", "")
    url = site["url_tpl"].format(date_compact=date_compact)
    soup = fetch_html(url)
    results = []
    for box in soup.select("article"):
        name_el = box.select_one("h3.card-name")
        time_el = box.select_one("span.cast-time__text")
        if not name_el or not time_el:
            continue
        raw_name = name_el.get_text(strip=True)
        start, end = parse_time(time_el.get_text())
        if not start:
            continue
        results.append({"name": raw_name, "start": start, "end": end, "room": ""})
    return results


SCRAPERS = {
    "tsujido":    scrape_tsujido,
    "kokoro":     scrape_kokoro,
    "rosecafe":   scrape_rosecafe,
    "himitsuspa": scrape_himitsuspa,
    "crystalspa": scrape_crystalspa,
    "urazuma":    scrape_urazuma,
}


# ═══════════════════════════════════════════════════════════════════
# メイン処理
# ═══════════════════════════════════════════════════════════════════

def process_site(site: dict, date_str: str, dry_run: bool, update: bool, delete: bool):
    today = date.today().isoformat()
    if date_str < today:
        print(f"  ⏭ {date_str} は過去のためスキップ")
        return

    shop_id   = site["shop_id"]
    site_name = site["name"]

    print(f"\n{'─'*60}")
    print(f"  {site_name}  |  {date_str}{'  [DRY RUN]' if dry_run else ''}{'  [UPDATE]' if update else ''}{'  [DELETE]' if delete else ''}")
    print(f"{'─'*60}")

    try:
        therapist_map   = get_therapists(shop_id)
        rooms           = get_rooms(shop_id)
        existing_shifts = get_existing_shifts(shop_id, date_str)
    except Exception as e:
        print(f"  ❌ Supabase取得エラー: {e}")
        return

    print(f"  セラピスト数: {len(therapist_map)} / ルーム数: {len(rooms)} / 登録済: {len(existing_shifts)}")

    scraper = SCRAPERS.get(site["type"])
    if not scraper:
        print(f"  ❌ 未対応の type: {site['type']}")
        return

    try:
        scraped = scraper(site, date_str)
    except Exception as e:
        print(f"  ❌ スクレイピングエラー: {e}")
        return

    print(f"  スクレイピング件数: {len(scraped)}")

    registered = updated = deleted = skipped_dup = skipped_unmatch = skipped_room = 0

    # ── 登録・更新処理 ───────────────────────────────────────────
    scraped_tids = set()  # サイトに存在したセラピストIDを記録

    for item in scraped:
        norm = normalize_name(item["name"])
        tid  = match_therapist(norm, therapist_map)

        if not tid:
            print(f"    ⚠ 未マッチ: '{item['name']}' → normalize='{norm}'")
            skipped_unmatch += 1
            continue

        room_id = resolve_room(item.get("room", ""), rooms)

        # ルームが指定されているのにマッチしない → ダミー出勤としてスキップ
        if room_id is None:
            print(f"    ⏭ ルーム未登録のためスキップ（ダミー出勤）: {item['name']} [{item.get('room', '')}]")
            skipped_room += 1
            continue

        scraped_tids.add(tid)  # マッチして有効なシフトのみ記録
        room_label = item.get("room", "") or ""

        # ── 既登録シフトがある場合 ──────────────────────────────
        if tid in existing_shifts:
            existing = existing_shifts[tid]

            if not update:
                print(f"    ⏭ 登録済みスキップ: {item['name']}")
                skipped_dup += 1
                continue

            # 変更があるか確認
            changed_parts = []
            if existing["start_time"] != item["start"]:
                changed_parts.append(
                    f"時間: {existing['start_time']}～{existing['end_time']} → {item['start']}～{item['end']}"
                )
            if existing["room_id"] != room_id:
                old_room = next(
                    (r["name"] for r in rooms if r["id"] == existing["room_id"]),
                    existing["room_id"] or "なし",
                )
                changed_parts.append(f"ルーム: {old_room} → {room_label}")

            if not changed_parts:
                print(f"    ⏭ 変更なしスキップ: {item['name']}")
                skipped_dup += 1
                continue

            ok = update_shift(
                shift_id=existing["id"],
                room_id=room_id,
                start_time=item["start"],
                end_time=item["end"],
                dry_run=dry_run,
            )
            if ok:
                tag = "[DRY]" if dry_run else "🔄"
                print(f"    {tag} 更新: {item['name']} ({', '.join(changed_parts)})")
                updated += 1
            continue

        # ── 新規登録 ────────────────────────────────────────────
        ok = register_shift(
            therapist_id=tid,
            shop_id=shop_id,
            date_str=date_str,
            room_id=room_id,
            start_time=item["start"],
            end_time=item["end"],
            dry_run=dry_run,
        )
        if ok:
            tag = "[DRY]" if dry_run else "✅"
            print(f"    {tag} 登録: {item['name']} {item['start']}～{item['end']} [{room_label}]")
            existing_shifts[tid] = {
                "id": None,
                "start_time": item["start"],
                "end_time": item["end"],
                "room_id": room_id,
            }
            registered += 1

        time.sleep(0.3)

    # ── 削除処理 ─────────────────────────────────────────────────
    # Supabase に登録済みだがサイトに存在しないシフトを削除
    if delete:
        for tid, existing in existing_shifts.items():
            if tid not in scraped_tids:
                therapist_name = next(
                    (k for k, v in therapist_map.items() if v == tid), tid
                )
                ok = delete_shift(existing["id"], dry_run=dry_run)
                if ok:
                    tag = "[DRY]" if dry_run else "🗑"
                    print(f"    {tag} 削除: {therapist_name} (サイトから消滅)")
                    deleted += 1

    print(
        f"  → 登録:{registered}  更新:{updated}  削除:{deleted}"
        f"  重複スキップ:{skipped_dup}  未マッチ:{skipped_unmatch}  ルームなしスキップ:{skipped_room}"
    )


def main():
    parser = argparse.ArgumentParser(description="ホームページからシフトをスクレイピングして登録")
    parser.add_argument("--date",    default=date.today().isoformat(), help="開始日 YYYY-MM-DD (デフォルト: 今日)")
    parser.add_argument("--days",    type=int, default=1,              help="登録する日数 (デフォルト: 1)")
    parser.add_argument("--sites",   nargs="*",                        help="対象サイト名 (省略時は全サイト)")
    parser.add_argument("--dry-run", action="store_true",              help="登録せずに確認のみ")
    parser.add_argument("--update",  action="store_true",              help="登録済みシフトも変更があれば上書き更新する")
    parser.add_argument("--delete",  action="store_true",              help="サイトから消えたシフトをSupabaseからも削除する")
    args = parser.parse_args()

    start_date  = datetime.strptime(args.date, "%Y-%m-%d").date()
    site_filter = args.sites or []

    target_sites = [
        s for s in SITES
        if not site_filter or s["name"] in site_filter
    ]

    print(f"対象サイト: {[s['name'] for s in target_sites]}")
    print(f"登録期間  : {start_date} ～ {start_date + timedelta(days=args.days - 1)}")
    print(f"DRY RUN   : {args.dry_run}")
    print(f"UPDATE    : {args.update}")
    print(f"DELETE    : {args.delete}")

    for offset in range(args.days):
        target_date = (start_date + timedelta(days=offset)).isoformat()
        for site in target_sites:
            process_site(
                site, target_date,
                dry_run=args.dry_run,
                update=args.update,
                delete=args.delete,
            )


if __name__ == "__main__":
    main()
