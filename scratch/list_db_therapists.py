import requests

SUPABASE_URL = "https://pumkniqtgjsotsxhyvbq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}
SHOP_ID_URBAN_HIMITSU = "7d430288-8aed-4381-b3bf-f35fad962d2f"

def main():
    url = f"{SUPABASE_URL}/rest/v1/therapists?shop_id=eq.{SHOP_ID_URBAN_HIMITSU}&select=id,name"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    therapists = r.json()
    
    lines = []
    lines.append(f"Total therapists in DB for Urban Shimitsuma: {len(therapists)}")
    for t in sorted(therapists, key=lambda x: x['name']):
        lines.append(f"{t['id']}: {t['name']}")
        
    with open("scratch/db_therapists.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

if __name__ == '__main__':
    main()
