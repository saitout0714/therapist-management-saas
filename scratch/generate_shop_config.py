import requests
import json

SUPABASE_URL = "https://pumkniqtgjsotsxhyvbq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# 除外する店舗
EXCLUDE_SHOPS = ["カレッツァ", "バカラ"]

# カラーパレット（ルームの背景色用）
COLORS = ["#00FFFF", "#FFFF00", "#00FF00", "#FF9900", "#FF00FF", "#A4C2F4", "#D9EAD3", "#FFE599", "#F4CCCC", "#E6B8AF"]

def get_shops():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/shops?select=id,name", headers=HEADERS)
    r.raise_for_status()
    return [s for s in r.json() if s["name"] not in EXCLUDE_SHOPS]

def get_rooms(shop_id):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/rooms?shop_id=eq.{shop_id}&select=id,name", headers=HEADERS)
    r.raise_for_status()
    # idはUUIDなので、GASのキーは1からの連番にする
    rooms_data = {}
    for idx, room in enumerate(r.json()):
        color = COLORS[idx % len(COLORS)]
        rooms_data[str(idx + 1)] = {
            "name": room["name"],
            "color": color
        }
    return rooms_data

def get_therapists(shop_id):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/therapists?shop_id=eq.{shop_id}&select=name", headers=HEADERS)
    r.raise_for_status()
    return [t["name"] for t in r.json() if t["name"]]

def main():
    shops = get_shops()
    print(f"Generating config for {len(shops)} shops...")
    
    shop_config = {}
    for i, shop in enumerate(sorted(shops, key=lambda x: x["name"])):
        shop_id = shop["id"]
        name = shop["name"]
        
        # 予約キー (shop_1, shop_2...) もしくは店名をベースにしたキー
        # アルファベットのキーにしよう (例: shop_tsujido, shop_crystalなど)
        # ここでは単純に shop_1, shop_2...
        key = f"shop_{i+1}"
        
        rooms = get_rooms(shop_id)
        therapists = get_therapists(shop_id)
        
        shop_config[key] = {
            "name": name,
            "sheetName": name,
            "supabaseShopId": shop_id,
            "rooms": rooms,
            "staffList": therapists
        }
        
    # JSON文字列に変換（インデントあり）
    config_json = json.dumps(shop_config, ensure_ascii=False, indent=2)
    
    with open("scratch/shop_config_js.txt", "w", encoding="utf-8") as f:
        f.write(f"const SHOP_CONFIG = {config_json};")
        
    print("Generation complete! Output written to scratch/shop_config_js.txt")

if __name__ == '__main__':
    main()
