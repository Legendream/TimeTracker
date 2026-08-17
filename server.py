import os
import json
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer

# 設定工作目錄為專案的父目錄，確保靜態檔案的網址路徑維持 /Time%20Tracker/index.html
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(SCRIPT_DIR)
os.chdir(PARENT_DIR)

# 本地 JSON 資料庫路徑
DB_FILE = os.path.expanduser("~/Documents/TimeTrackerData.json")

# 初始化空白資料庫
def init_db():
    if not os.path.exists(DB_FILE):
        default_data = {
            "projects": [],
            "entries": [],
            "settings": [],
            "annualGoals": [],
            "manualRevenue": []
        }
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_data, f, ensure_ascii=False, indent=2)
        print(f"已在 {DB_FILE} 初始化空白資料庫。")

init_db()

def read_db():
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("讀取資料庫失敗：", e)
        return {}

def write_db(data):
    try:
        # 先寫入臨時檔案，再更名，以確保寫入的安全與原子性
        temp_file = DB_FILE + ".tmp"
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(temp_file, DB_FILE)
    except Exception as e:
        print("寫入資料庫失敗：", e)

def get_key_path(store_name):
    if store_name == 'settings':
        return 'key'
    elif store_name == 'annualGoals':
        return 'year'
    else:
        return 'id'

def get_next_id(items):
    ids = [item.get('id') for item in items if isinstance(item, dict) and 'id' in item]
    ids = [x for x in ids if isinstance(x, (int, float))]
    return max(ids) + 1 if ids else 1

class TimeTrackerAPIHandler(SimpleHTTPRequestHandler):
    # 處理 CORS 首部與防快取
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

        # 根路徑重定向，方便使用者直接造訪
        if path in ('/', '/index.html'):
            self.send_response(302)
            self.send_header('Location', '/Time%20Tracker/index.html')
            self.end_headers()
            return

        # API 讀取路由
        if path == '/api/store':
            store_name = query.get('name', [None])[0]
            key_val = query.get('key', [None])[0]

            if not store_name:
                self.send_error_json(400, "缺少參數 'name'")
                return

            db_data = read_db()
            items = db_data.get(store_name, [])

            # 若有指定 key，則搜尋單筆
            if key_val is not None:
                key_path = get_key_path(store_name)
                found_item = None
                for item in items:
                    if isinstance(item, dict):
                        target_val = item.get(key_path)
                        if target_val is not None and str(target_val) == str(key_val):
                            found_item = item
                            break

                self.send_json_response(200, found_item)
            else:
                self.send_json_response(200, items)
            return

        # 預設：提供靜態網頁檔案
        super().do_GET()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

        # 1. 舊資料遷移 API
        if path == '/api/migrate':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                migration_data = json.loads(body.decode('utf-8'))
            except Exception as e:
                self.send_error_json(400, f"JSON 解析失敗: {e}")
                return

            # 直接覆蓋寫入本地資料庫
            db_data = read_db()
            for store, data in migration_data.items():
                if isinstance(data, list):
                    db_data[store] = data
            write_db(db_data)
            print("資料成功完成遷移！")
            self.send_json_response(200, {"success": True})
            return

        # 2. CRUD 新增 API
        if path == '/api/store':
            store_name = query.get('name', [None])[0]
            if not store_name:
                self.send_error_json(400, "缺少參數 'name'")
                return

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                new_item = json.loads(body.decode('utf-8'))
            except Exception as e:
                self.send_error_json(400, f"JSON 解析失敗: {e}")
                return

            db_data = read_db()
            if store_name not in db_data:
                db_data[store_name] = []

            key_path = get_key_path(store_name)
            
            # 若是自增 ID，且對象沒有提供 ID，自動生成
            if key_path == 'id' and 'id' not in new_item:
                new_item['id'] = get_next_id(db_data[store_name])

            db_data[store_name].append(new_item)
            write_db(db_data)
            self.send_json_response(200, new_item)
            return

        self.send_error_json(404, "Not Found")

    def do_PUT(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

        if path == '/api/store':
            store_name = query.get('name', [None])[0]
            if not store_name:
                self.send_error_json(400, "缺少參數 'name'")
                return

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                update_item = json.loads(body.decode('utf-8'))
            except Exception as e:
                self.send_error_json(400, f"JSON 解析失敗: {e}")
                return

            db_data = read_db()
            items = db_data.get(store_name, [])
            key_path = get_key_path(store_name)
            key_val = update_item.get(key_path)

            if key_val is None:
                self.send_error_json(400, f"缺少主鍵欄位 '{key_path}'")
                return

            # 搜尋並更新
            updated = False
            for idx, item in enumerate(items):
                if isinstance(item, dict) and item.get(key_path) == key_val:
                    items[idx] = update_item
                    updated = True
                    break

            if not updated:
                items.append(update_item)

            db_data[store_name] = items
            write_db(db_data)
            self.send_json_response(200, update_item)
            return

        self.send_error_json(404, "Not Found")

    def do_DELETE(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

        if path == '/api/store':
            store_name = query.get('name', [None])[0]
            key_val = query.get('key', [None])[0]

            if not store_name or key_val is None:
                self.send_error_json(400, "缺少參數 'name' 或 'key'")
                return

            key_path = get_key_path(store_name)
            if key_path == 'id':
                try:
                    key_val = int(key_val)
                except ValueError:
                    pass

            db_data = read_db()
            items = db_data.get(store_name, [])
            
            # 過濾掉要刪除的資料
            new_items = [item for item in items if not (isinstance(item, dict) and item.get(key_path) == key_val)]
            db_data[store_name] = new_items
            write_db(db_data)
            self.send_json_response(200, {"success": True})
            return

        self.send_error_json(404, "Not Found")

    def send_json_response(self, status, data):
        response_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_json(self, status, message):
        self.send_json_response(status, {"error": message})

def run(port=5500):
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, TimeTrackerAPIHandler)
    print(f"本地 Python 伺服器正在 127.0.0.1:{port} 啟動中...")
    print(f"網頁目錄設為：{os.getcwd()}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n伺服器已終止。")
        httpd.server_close()

if __name__ == '__main__':
    run()
