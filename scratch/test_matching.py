import requests
from bs4 import BeautifulSoup
import re
from datetime import date, datetime

SUPABASE_URL = "https://pumkniqtgjsotsxhyvbq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

SHOP_ID_URBAN_HIMITSU = "7d430288-8aed-4381-b3bf-f35fad962d2f"

def normalize_name(raw: str) -> str:
    if not raw:
        return ""
    s = raw.strip()
    s = re.sub(r"[\(（][^\)）]*[\)）]", "", s)
    s = re.sub(r"[〈《<][^〉》>]*[〉》>]", "", s)
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

def get_therapists(shop_id: str) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/therapists?shop_id=eq.{shop_id}&select=id,name"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    return {normalize_name(t["name"]): t["id"] for t in r.json()}

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

def scrape_kokoro(url: str, date_str: str, name_sel: str, time_sel: str) -> list:
    soup = fetch_html(url)
    labels = soup.select(".tab_area label")
    panels = soup.select(".tab_panel")
    if not labels or not panels:
        print(f"    ⚠ タブ/パネルが見つかりません")
        return []
    target_dt = datetime.strptime(date_str, "%Y-%m-%d")
    
    panel_idx = None
    for i, label in enumerate(labels):
        label_text = label.get_text(strip=True)
        m = re.search(r"(\d{1,2})[/\u6708](\d{1,2})", label_text)
        if m:
            l_month = int(m.group(1))
            l_day = int(m.group(2))
            if l_month == target_dt.month and l_day == target_dt.day:
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
        raw_name = box.select_one(name_sel)
        raw_time = box.select_one(time_sel)
        if not raw_name or not raw_time:
            continue
        start, end = parse_time(raw_time.get_text())
        if not start:
            continue
        results.append({"name": raw_name.get_text(), "start": start, "end": end, "room": ""})
    return results

def main():
    date_str = date.today().isoformat()
    output_lines = []
    output_lines.append(f"Target Date: {date_str}")
    
    try:
        therapists = get_therapists(SHOP_ID_URBAN_HIMITSU)
        output_lines.append(f"Loaded {len(therapists)} therapists from Supabase (Urban Shimitsuma)")
        output_lines.append("Sample therapists in DB:")
        for name in list(therapists.keys())[:20]:
            output_lines.append(f"  - {name}")
    except Exception as e:
        output_lines.append(f"Error fetching therapists: {e}")
        with open("scratch/test_matching_result.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(output_lines))
        return

    # スクレイピング実行
    urbanspa_url = f"https://urbanspa.jp/schedule/?works={date_str}"
    himitsuma_url = f"https://himitsuma.com/schedule/?works={date_str}"
    
    output_lines.append("\n--- Scraping Urban Spa ---")
    scraped_urban = scrape_kokoro(urbanspa_url, date_str, ".therapist_name", ".startend")
    output_lines.append(f"Scraped {len(scraped_urban)} cast from Urban Spa")
    
    output_lines.append("\n--- Scraping Himitsuma ---")
    scraped_himitsu = scrape_kokoro(himitsuma_url, date_str, ".therapist_name", ".startend")
    output_lines.append(f"Scraped {len(scraped_himitsu)} cast from Himitsuma")
    
    all_scraped = scraped_urban + scraped_himitsu
    output_lines.append(f"\nTotal scraped: {len(all_scraped)}")
    
    matched_count = 0
    for idx, cast in enumerate(all_scraped):
        norm = normalize_name(cast["name"])
        tid = match_therapist(norm, therapists)
        status = f"✅ Match! (ID: {tid})" if tid else "❌ MISMATCH!"
        if tid:
            matched_count += 1
        output_lines.append(f"[{idx}] Raw: '{cast['name']}' -> Norm: '{norm}' -> {status}")
        
    output_lines.append(f"\nMatch rate: {matched_count}/{len(all_scraped)} ({matched_count/len(all_scraped)*100:.1f}%)" if len(all_scraped) > 0 else "\nMatch rate: 0/0 (0%)")

    # ファイルにUTF-8で書き出し
    with open("scratch/test_matching_result.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))
    print("Execution completed successfully. Results written to scratch/test_matching_result.txt")

if __name__ == '__main__':
    main()
