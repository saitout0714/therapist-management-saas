import re

def main():
    # GSファイル読み込み
    with open("gas/shift_spreadsheet.gs", "r", encoding="utf-8") as f:
        gs_content = f.read()
        
    # 新しい設定の読み込み
    with open("scratch/shop_config_js.txt", "r", encoding="utf-8") as f:
        new_config = f.read().strip()
        
    # 正規表現で置換
    # SHOP_CONFIG = { ... }; の構造を探して置換する
    pattern = r"const SHOP_CONFIG = \{[\s\S]*?\};"
    
    # マッチするか確認
    if not re.search(pattern, gs_content):
        print("Error: const SHOP_CONFIG pattern not found in shift_spreadsheet.gs")
        return
        
    updated_content = re.sub(pattern, new_config, gs_content)
    
    # GSファイルへ書き出し
    with open("gas/shift_spreadsheet.gs", "w", encoding="utf-8") as f:
        f.write(updated_content)
        
    print("Successfully updated SHOP_CONFIG in shift_spreadsheet.gs!")

if __name__ == '__main__':
    main()
