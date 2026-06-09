import requests
from bs4 import BeautifulSoup

def analyze_html(name, url):
    print(f"=== {name}: {url} ===")
    try:
        r = requests.get(url, timeout=10)
        r.encoding = r.apparent_encoding
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # 辻堂茅ヶ崎タイプのチェック
        # tsujido タイプ: .therapist-box.archive-sche, .therapist_name, .therapist_time
        # もしくは、他のセレクタを探すために、いくつかの典型的なクラスがあるか調べる
        
        # クラス名に "therapist" や "cast" や "staff" や "name" や "time" を含む要素をいくつか出力
        classes = set()
        for tag in soup.find_all(class_=True):
            for cls in tag['class']:
                if any(x in cls.lower() for x in ['therapist', 'cast', 'staff', 'sche', 'room', 'time', 'name']):
                    classes.add(cls)
        print("Related classes found:", sorted(list(classes))[:30])
        
        # "name" を含む要素やリンクのテキストを出力
        names = []
        for tag in soup.find_all(class_=True):
            if any('name' in cls for cls in tag['class']):
                text = tag.get_text(strip=True)
                if text and len(text) < 15:
                    names.append(f"{tag.name}.{'.'.join(tag['class'])}: {text}")
        print("Sample name-like elements:")
        for name_el in names[:10]:
            print(f"  {name_el}")
            
        # "time" を含む要素を出力
        times = []
        for tag in soup.find_all(class_=True):
            if any('time' in cls for cls in tag['class']):
                text = tag.get_text(strip=True)
                if text and len(text) < 30:
                    times.append(f"{tag.name}.{'.'.join(tag['class'])}: {text}")
        print("Sample time-like elements:")
        for time_el in times[:10]:
            print(f"  {time_el}")

        # テキストの中に「出勤」や時間表示（例：12:00〜）があるか
        import re
        time_pattern = re.compile(r'\d{1,2}:\d{2}')
        time_matches = soup.find_all(text=time_pattern)
        print(f"Elements containing time pattern ({len(time_matches)}):")
        for match in time_matches[:10]:
            parent = match.parent
            print(f"  [{match.strip()}] -> parent: {parent.name} class={parent.get('class')}")
            
    except Exception as e:
        print(f"Error: {e}")

def main():
    # 辻堂茅ヶ崎タイプか確かめる
    # 2026-06-07 は今日の日付
    analyze_html("アーバンスパ (tsujido)", "https://urbanspa.jp/schedule/?works=2026-06-07")
    analyze_html("秘密妻 (tsujido)", "https://himitsuma.com/schedule/?works=2026-06-07")
    
    # 秘密スパタイプか確かめる (day=YYYYMMDD)
    analyze_html("アーバンスパ (himitsu)", "https://urbanspa.jp/schedule/index.php?day=20260607")
    analyze_html("秘密妻 (himitsu)", "https://himitsuma.com/schedule/index.php?day=20260607")

if __name__ == '__main__':
    main()
