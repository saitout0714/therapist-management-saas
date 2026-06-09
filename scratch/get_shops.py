import requests

SUPABASE_URL = "https://pumkniqtgjsotsxhyvbq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

def main():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/shops?select=id,name", headers=HEADERS)
    r.raise_for_status()
    with open("scratch/shops.txt", "w", encoding="utf-8") as f:
        for shop in r.json():
            f.write(f"{shop['id']}: {shop['name']}\n")

if __name__ == '__main__':
    main()
