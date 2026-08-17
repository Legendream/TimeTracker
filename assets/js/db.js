class WorkTimeDB {
    constructor() {
        this.channel = new BroadcastChannel('worktime_db_updates');
    }

    async init() {
        // 先從 Python 伺服器檢查資料是否為空
        let isServerEmpty = false;
        try {
            const response = await fetch('/api/store?name=projects');
            const projects = await response.json();
            const response2 = await fetch('/api/store?name=entries');
            const entries = await response2.json();
            if (projects.length === 0 && entries.length === 0) {
                isServerEmpty = true;
            }
        } catch (e) {
            console.error("無法連線至 Python 本地 API，可能仍在使用 file:// 開啟中：", e);
        }

        // 如果伺服器資料庫是空的，嘗試從本機的 IndexedDB 讀取並遷移
        if (isServerEmpty) {
            try {
                const hasIndexedDB = await this.checkAndMigrateIndexedDB();
                if (hasIndexedDB) {
                    console.log("偵測到 IndexedDB 有舊資料，已成功發送遷移！");
                    // 重新整理頁面以讀取新資料
                    window.location.reload();
                    return;
                }
            } catch (e) {
                console.error("資料遷移過程中發生錯誤：", e);
            }
        }
        
        console.log("Time Tracker 本地 JSON 儲存庫初始化成功。");
    }

    checkAndMigrateIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('WorkTimeDB');
            request.onerror = () => resolve(false);
            
            // 如果不存在該資料庫，會觸發 upgrade，這時我們就中斷並返回 false
            request.onupgradeneeded = (e) => {
                e.target.transaction.abort();
                resolve(false);
            };
            
            request.onsuccess = async (e) => {
                const db = e.target.result;
                const storeNames = Array.from(db.objectStoreNames);
                if (storeNames.length === 0) {
                    db.close();
                    resolve(false);
                    return;
                }

                const migrationData = {};
                // 讀取 IndexedDB 的所有 ObjectStore 資料
                try {
                    const tx = db.transaction(storeNames, 'readonly');
                    for (const storeName of storeNames) {
                        migrationData[storeName] = await new Promise((res, rej) => {
                            const store = tx.objectStore(storeName);
                            const req = store.getAll();
                            req.onsuccess = () => res(req.result);
                            req.onerror = () => rej(req.error);
                        });
                    }
                } catch (err) {
                    db.close();
                    reject(err);
                    return;
                }

                db.close();

                // 計算資料總筆數，若沒有任何資料就不需要遷移
                const totalRecords = Object.values(migrationData).reduce((sum, list) => sum + (list ? list.length : 0), 0);
                if (totalRecords === 0) {
                    resolve(false);
                    return;
                }

                console.log(`準備將 IndexedDB 中的 ${totalRecords} 筆資料遷移至 Python 伺服器...`);

                // 傳送到 Python 後端寫入 JSON 檔
                try {
                    const response = await fetch('/api/migrate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(migrationData)
                    });
                    if (response.ok) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch (err) {
                    reject(err);
                }
            };
        });
    }

    async getAll(storeName) {
        try {
            const response = await fetch(`/api/store?name=${storeName}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error(`讀取 ${storeName} 失敗:`, e);
            return [];
        }
    }

    async add(storeName, data) {
        try {
            const response = await fetch(`/api/store?name=${storeName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const savedData = await response.json();
            this.channel.postMessage({ type: 'db_update', store: storeName });
            return savedData;
        } catch (e) {
            console.error(`新增 ${storeName} 失敗:`, e);
            throw e;
        }
    }

    async put(storeName, data) {
        try {
            const response = await fetch(`/api/store?name=${storeName}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const savedData = await response.json();
            this.channel.postMessage({ type: 'db_update', store: storeName });
            return savedData;
        } catch (e) {
            console.error(`更新 ${storeName} 失敗:`, e);
            throw e;
        }
    }

    async get(storeName, key) {
        try {
            const response = await fetch(`/api/store?name=${storeName}&key=${encodeURIComponent(key)}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error(`查詢 ${storeName} 的 key ${key} 失敗:`, e);
            return null;
        }
    }

    async delete(storeName, key) {
        try {
            const response = await fetch(`/api/store?name=${storeName}&key=${encodeURIComponent(key)}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.channel.postMessage({ type: 'db_update', store: storeName });
            return true;
        } catch (e) {
            console.error(`刪除 ${storeName} 的 key ${key} 失敗:`, e);
            throw e;
        }
    }
}

// 建立全域實例
const db = new WorkTimeDB();
