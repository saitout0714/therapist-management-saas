#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from bs4 import BeautifulSoup
from datetime import date, timedelta
import time
import sys

CASKAN_SHOP_CODE = "sparich"
CASKAN_LOGIN_ID  = "mts"
CASKAN_PASSWORD  = "MTS"

SHOPS = [
    {"name": "noel",             "caskan_id": 1055, "supabase_id": "0ffa0c56-c61f-4e41-95a2-8ec3028eefdc"},
    {"name": "aroma",            "caskan_id": 1112, "supabase_id": "d45829ba-a7e3-48d8-8b09-5e49b9f494a7"},
    {"name": "rabbit_tachikawa", "caskan_id": 1631, "supabase_id": "a0000001-0000-0000-0000-000000000003"},
    {"name": "rabbit_machida",   "caskan_id": 1772, "supabase_id": "933b0d5a-d436-453d-a8bc-8741a74a52c9"},
    {"name": "secret_moment",    "caskan_id": 1823, "supabase_id": "a0000001-0000-0000-0000-000000000002"},
    {"name": "spa_rich",         "caskan_id": 1857, "supabase_id": "a0000001-0000-0000-0000-000000000001"},
    {"name": "kamigami",         "caskan_id": 1971, "supabase_id": "3d4e98bd-ed3f-4bea-8327-4891d65c427c"},
]

CASKAN_ROOM_MAP = {
    "729":  "6b7ba35d-4236-4418-973d-798124c87481",
    "309":  "25419824-4503-4987-99bd-e54c592383d5",
    "208":  "20314ce7-397b-4310-bc5f-70857f954a51",
    "209":  "cdd6a7e6-76cf-4ce3-9e98-5dfc1dc1fc5d",
    "210":  "54fc9357-9008-4aea-a190-e656e3c76230",
    "528":  "4e02da50-3c19-4387-8e05-2dbeb871995e",
    "529":  "a83f6891-cda5-416b-bfa8-15991dba30d7",
    "530":  "48a2de10-52f7-45a1-ac42-a236f3ab8281",
    "1977": "c4d0f634-e58d-42c7-a58e-4fa071e0ae00",
    "1978": "deacf801-24dd-404b-866e-0281be03973e",
    "1979": "3212fcf4-15af-4c21-bd1f-067b04b000b6",
    "1971": "9501e6dc-e348-48a1-9fed-4b05ef826726",
    "2089": "e710834b-cb0e-49ba-8d4e-06e705c1215c",
    "2090": "31ebee7e-0fac-46c2-87eb-3b4ca45cf919",
    "2562": "f269bf93-ef2f-425c-915f-8577896b828f",
    "2563": "e2ffebbb-dd6d-42f3-9f57-2eabd7070ef7",
    "2927": "7a3dc129-6738-46f1-b4a8-167835a90e31",
    "4806": "1ec96894-d383-4156-9cab-7354f63b549a",
    "4812": "ddebb857-d5f0-4689-990f-7e80ef033dd3",
    "3962": "a084152b-fced-43c6-8d20-810a596d6db4",
    "2800": "09ba5146-59aa-4ab6-8d12-ed4869cb17e2",
    "3389": "129f4759-961b-4573-8fd1-fcda3cd99066",
    "3166": "94ae822f-7585-41d8-bbfa-57e370a5a176",
    "3169": "a21af0f2-441f-43bd-8718-2057e530b02a",
    "3167": "33d510b9-aa4f-424e-83d5-34e9d26d2c1c",
    "3170": "c8906495-c1e4-440e-88f2-b8bb60a463ce",
    "3330": "101f4c93-b6a8-47cb-8ded-f4ea96007f1c",
    "3320": "8cdc1cef-4d4c-457d-9ae1-2e695c1e7745",
    "4892": "c61876a2-0121-4a3b-8bb2-9585b5101c7d",
    
    # ⚠️ 【ここを書き換えてください】ログから判明した不足ルームID
    "4813": "60ea8984-197f-437b-b3f5-9e3a94e0037a",
    "4814": "6154fad0-0b11-4de6-95c8-5190663ccc22",
    "3168": "657606f0-2f84-4ce6-9899-5e6e8445c428",
    "4812": "debac2e1-22be-46ea-a5a0-d7f20b3bb3e8",
}

SUPABASE_URL = "https://pumkniqtgjsotsxhyvbq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24"
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

WEEKS = int(sys.argv[1]) if len(sys.argv) > 1 else 1


def normalize_cast_name(raw: str) -> str:
    if not raw:
        return ""
    # スラッシュや括弧以降を取り除く
    s = raw.split("/")[0].split("(")[0].split("（")[0]
    return s.strip()


def match_therapist(caskan_name: str, therapist_map: dict):
    # ① 完全一致
    if caskan_name in therapist_map:
        return therapist_map[caskan_name]
    
    # ② キャス観名を正規化して一致するか
    norm_caskan = normalize_cast_name(caskan_name)
    if norm_caskan in therapist_map:
        return therapist_map[norm_caskan]
        
    # ③ Supabase側の名前も正規化して一致するか
    for t_name, t_id in therapist_map.items():
        if normalize_cast_name(t_name) == norm_caskan:
            return t_id
            
    # ④ 部分一致（前方・後方一致）
    for t_name, t_id in therapist_map.items():
        norm_t = normalize_cast_name(t_name)
        if norm_t and norm_caskan:
            if norm_t.startswith(norm_caskan) or norm_caskan.startswith(norm_t):
                return t_id
                
    return None



def caskan_login(session):
    r = session.post("https://my.caskan.jp/login", data={"mode": "step1", "shop_code": CASKAN_SHOP_CODE, "code": CASKAN_LOGIN_ID}, allow_redirects=True)
    if r.status_code != 200:
        return False
    r2 = session.post("https://my.caskan.jp/login/password", data={"mode": "step2", "login_password": CASKAN_PASSWORD}, allow_redirects=True)
    return "login" not in r2.url


def caskan_switch_shop(session, shop_id):
    r = session.get("https://my.caskan.jp/assist_agent/login?shop_id=" + str(shop_id), allow_redirects=True)
    return r.status_code == 200


def caskan_get_shifts(session, target_date):
    r = session.get("https://my.caskan.jp/shift?date=" + target_date.isoformat())
    soup = BeautifulSoup(r.text, "html.parser")
    shifts = []
    rows = soup.select(".tbl-calendar tr")
    for row in rows:
        name_link = row.select_one('a[href^="/cast/view"]')
        cast_name = name_link.get_text(strip=True) if name_link else ""
        if not cast_name:
            continue
        for cell in row.select("td[data-cast-id]"):
            shift_id = cell.get("data-id", "")
            if not shift_id:
                continue
            from_h = cell.get("data-from-hour", "")
            from_m = cell.get("data-from-min", "0")
            to_h = cell.get("data-to-hour", "")
            to_m = cell.get("data-to-min", "0")
            if cell.get("data-time-undecided") == "1" or not from_h or not to_h:
                continue
            
            raw_room_id = cell.get("data-room-id", "")
            room_id = CASKAN_ROOM_MAP.get(raw_room_id, None)
            
            if raw_room_id and not room_id:
                print(f"[WARN] [ルームMAP未登録] キャスト:{cast_name} / キャス観側部屋ID:{raw_room_id} が CASKAN_ROOM_MAP にありません。")

            shifts.append({
                "cast_name": cast_name,
                "day": cell.get("data-day"),
                "start_time": "%02d:%02d:00" % (int(from_h), int(from_m)),
                "end_time": "%02d:%02d:00" % (int(to_h), int(to_m)),
                "room_id": room_id,
            })
    return shifts


def get_therapist_map(supabase_id):
    r = requests.get(SUPABASE_URL + "/rest/v1/therapists?select=id,name&shop_id=eq." + supabase_id, headers=SUPABASE_HEADERS)
    result = {}
    for t in r.json():
        if t["name"] not in result:
            result[t["name"]] = t["id"]
    return result


def get_existing_shifts(supabase_id, date_from, date_to):
    r = requests.get(SUPABASE_URL + "/rest/v1/shifts?select=id,therapist_id,date,start_time,end_time,room_id&shop_id=eq." + supabase_id + "&date=gte." + date_from + "&date=lte." + date_to, headers=SUPABASE_HEADERS)
    result = {}
    for row in r.json():
        key = (row["therapist_id"], row["date"])
        if key not in result:
            result[key] = []
        result[key].append({"id": row["id"], "start_time": row["start_time"], "end_time": row["end_time"], "room_id": row["room_id"]})
    return result


def register_shift(therapist_id, supabase_id, day, start_time, end_time, room_id):
    data = {"therapist_id": therapist_id, "shop_id": supabase_id, "date": day, "start_time": start_time, "end_time": end_time}
    if room_id:
        data["room_id"] = room_id
    r = requests.post(SUPABASE_URL + "/rest/v1/shifts", headers=SUPABASE_HEADERS, json=data)
    return r.status_code == 201


def update_shift(shift_id, start_time, end_time, room_id):
    data = {"start_time": start_time, "end_time": end_time}
    data["room_id"] = room_id if room_id else None
    r = requests.patch(SUPABASE_URL + "/rest/v1/shifts?id=eq." + shift_id, headers=SUPABASE_HEADERS, json=data)
    return r.status_code == 204


def delete_shift(shift_id):
    r = requests.delete(SUPABASE_URL + "/rest/v1/shifts?id=eq." + shift_id, headers=SUPABASE_HEADERS)
    return r.status_code == 204


def main():
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    print("Login...")
    if not caskan_login(session):
        print("LOGIN FAILED")
        return
    print("Login OK")

    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    for shop in SHOPS:
        print("=" * 50)
        print("Shop: " + shop["name"] + " (caskan:" + str(shop["caskan_id"]) + ")")
        print("=" * 50)
        time.sleep(3)
        caskan_switch_shop(session, shop["caskan_id"])
        time.sleep(2)

        therapist_map = get_therapist_map(shop["supabase_id"])
        print("Therapists: " + str(len(therapist_map)))

        total_ok, total_update, total_delete, total_skip, unknown = 0, 0, 0, 0, []

        for week_offset in range(WEEKS):
            target = week_start + timedelta(weeks=week_offset)
            date_from = target.isoformat()
            date_to = (target + timedelta(days=6)).isoformat()

            tomorrow = (today + timedelta(days=1)).isoformat()
            if date_to < tomorrow:
                continue
            if date_from < tomorrow:
                date_from = tomorrow

            print("Date: " + date_from + " - " + date_to)

            caskan_shifts = caskan_get_shifts(session, target)
            existing = get_existing_shifts(shop["supabase_id"], date_from, date_to)

            caskan_index = {}
            for s in caskan_shifts:
                raw_name = s["cast_name"]
                t_id = match_therapist(raw_name, therapist_map)
                if not t_id:
                    if raw_name not in unknown:
                        unknown.append(raw_name)
                    continue
                if s["day"] < date_from:
                    continue
                key = (t_id, s["day"])
                if key not in caskan_index:
                    caskan_index[key] = []
                caskan_index[key].append(s)

            all_keys = set(list(existing.keys()) + list(caskan_index.keys()))
            for key in all_keys:
                t_id, day = key
                caskan_list = caskan_index.get(key, [])
                existing_list = existing.get(key, [])

                caskan_list.sort(key=lambda x: x["start_time"])
                existing_list.sort(key=lambda x: x["start_time"])

                max_len = max(len(caskan_list), len(existing_list))
                for i in range(max_len):
                    
                    if i < len(caskan_list) and i < len(existing_list):
                        s = caskan_list[i]
                        ex = existing_list[i]
                        
                        if (ex["start_time"] != s["start_time"] or 
                            ex["end_time"] != s["end_time"] or 
                            ex["room_id"] != s["room_id"]):
                            
                            if update_shift(ex["id"], s["start_time"], s["end_time"], s["room_id"]):
                                print(f"UPDATED: {day} {ex['start_time'][:5]}->{s['start_time'][:5]} ({s['end_time'][:5]})")
                                total_update += 1
                        else:
                            total_skip += 1

                    elif i < len(caskan_list):
                        s = caskan_list[i]
                        if register_shift(t_id, shop["supabase_id"], day, s["start_time"], s["end_time"], s["room_id"]):
                            print(f"OK: {day} {s['start_time'][:5]}-{s['end_time'][:5]}" + (" room:OK" if s["room_id"] else " room:none"))
                            total_ok += 1

                    elif i < len(existing_list):
                        ex = existing_list[i]
                        if delete_shift(ex["id"]):
                            print(f"DELETED: {day} {ex['start_time'][:5]}")
                            total_delete += 1

        print("Registered:" + str(total_ok) + " Updated:" + str(total_update) + " Deleted:" + str(total_delete) + " Skipped:" + str(total_skip))
        if unknown:
            print("Unmatched: " + ", ".join(unknown))
        time.sleep(2)

    print("ALL DONE!")


if __name__ == "__main__":
    main()
