import requests
from bs4 import BeautifulSoup

def test_site(name, url):
    print(f"=== {name} ({url}) ===")
    try:
        r = requests.get(url, timeout=10)
        r.encoding = r.apparent_encoding
        soup = BeautifulSoup(r.text, 'html.parser')
        print(f"Title: {soup.title.text if soup.title else 'No Title'}")
        # スケジュールらしきリンクを検索
        links = soup.find_all('a', href=True)
        schedule_links = []
        for a in links:
            href = a['href']
            text = a.get_text(strip=True)
            if 'schedule' in href.lower() or 'shift' in href.lower() or 'sch' in href.lower() or '出勤' in text or 'スケジュール' in text:
                schedule_links.append((text, href))
        print("Schedule links found:")
        for text, href in schedule_links[:10]:
            print(f"  - [{text}]: {href}")
    except Exception as e:
        print(f"Error: {e}")

def main():
    test_site("アーバンスパ", "https://urbanspa.jp/")
    test_site("秘密妻", "https://himitsuma.com/")

if __name__ == '__main__':
    main()
