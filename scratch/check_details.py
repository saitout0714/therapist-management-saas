import requests
from bs4 import BeautifulSoup

def analyze(name, url):
    print(f"=== {name} ===")
    r = requests.get(url, timeout=10)
    r.encoding = r.apparent_encoding
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # タブエリアとパネルが存在するかチェック
    tab_area = soup.select(".tab_area label")
    tab_panel = soup.select(".tab_panel")
    print(f"tab_area labels count: {len(tab_area)}")
    print(f"tab_panel count: {len(tab_panel)}")
    
    # .cast-flex が全体で何個あるか
    cast_flex_all = soup.select(".cast-flex")
    print(f"Total .cast-flex count: {len(cast_flex_all)}")
    
    # tab_panel がある場合、各パネル内の .cast-flex の数
    if tab_panel:
        for idx, panel in enumerate(tab_panel):
            label_text = tab_area[idx].get_text(strip=True) if idx < len(tab_area) else "No Label"
            panel_casts = panel.select(".cast-flex")
            print(f"  Panel {idx} [{label_text}]: contains {len(panel_casts)} casts")
    else:
        # tab_panel がない場合、直接 .cast-flex からキャスト名と時間を取得できるか試す
        for idx, box in enumerate(cast_flex_all[:5]):
            name_el = box.select_one(".therapist_name")
            time_el = box.select_one(".startend")
            name_text = name_el.get_text(strip=True) if name_el else "None"
            time_text = time_el.get_text(strip=True) if time_el else "None"
            print(f"  Cast {idx}: name='{name_text}', time='{time_text}'")

def main():
    analyze("アーバンスパ", "https://urbanspa.jp/schedule/?works=2026-06-07")
    analyze("秘密妻", "https://himitsuma.com/schedule/?works=2026-06-07")

if __name__ == '__main__':
    main()
