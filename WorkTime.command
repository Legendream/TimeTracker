#!/bin/bash
# 終止舊的 python 伺服器，避免衝突
pkill -f "python3.*server.py"
pkill -f "python3 -m http.server"

# 取得當前腳本目錄及其父目錄
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$( dirname "$SCRIPT_DIR" )"
cd "$PARENT_DIR"

# 在背景啟動本地 Python 自訂伺服器
python3 "Time Tracker/server.py" > /dev/null 2>&1 &

# 等待伺服器啟動
sleep 1

# 以預設瀏覽器開啟網頁
if [ -d "/Applications/Firefox.app" ]; then
    open -a "Firefox" "http://127.0.0.1:5500/Time%20Tracker/index.html"
else
    open "http://127.0.0.1:5500/Time%20Tracker/index.html"
fi

echo "Time Tracker 服務已成功啟動！"
echo "請勿關閉此終端機視窗，若要關閉服務，直接關閉此視窗即可。"
