import requests
from bs4 import BeautifulSoup
from datetime import datetime

def analyze(name, url, date_str):
    print(f"=== {name} ===")
    r = requests.get(url, timeout=10)
    r.encoding = r.apparent_encoding
    soup = BeautifulSoup(r.text, 'html.parser')
    
    target_dt = datetime.strptime(date_str, "%Y-%m-%d")
    target_label_md = f"{target_dt.month}/{target_dt.day}"
    print(f"target_label_md = '{target_label_md}'")
    
    labels = soup.select(".tab_area label")
    for idx, label in enumerate(labels):
        text = label.get_text(strip=True)
        # バイト列でどうなっているかも見てみる
        bytes_repr = text.encode('utf-8')
        match = text.startswith(target_label_md)
        print(f"  Label {idx}: '{text}' (bytes: {bytes_repr}), starts_with_target: {match}")

def main():
    analyze("アーバンスパ", "https://urbanspa.jp/schedule/?works=2026-06-07", "2026-06-07")
    analyze("秘密妻", "https://himitsuma.com/schedule/?works=2026-06-07", "2026-06-07")

if __name__ == '__main__':
    main()
