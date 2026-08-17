app.views['export'] = {
    currentStatement: null,

    init: async () => {
        console.log('Export View Loaded');

        // 1. Populate Billing Clients Dropdown
        await app.views['export'].populateBillingClientsDropdown();

        // 2. Set Default Billing Month if not set
        const monthInput = document.getElementById('billing-month-input');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${y}-${m}`;
        }

        // 3. Bind Billing Statement Event Listeners
        ['billing-client-select', 'billing-month-input', 'billing-hourly-rate'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.listening) {
                el.addEventListener('change', () => app.views['export'].renderBillingStatement());
                el.addEventListener('input', () => app.views['export'].renderBillingStatement());
                el.dataset.listening = 'true';
            }
        });

        const btnCopy = document.getElementById('btn-copy-billing-text');
        if (btnCopy && !btnCopy.dataset.listening) {
            btnCopy.addEventListener('click', () => app.views['export'].copyBillingStatementText());
            btnCopy.dataset.listening = 'true';
        }

        const btnRecordRev = document.getElementById('btn-quick-record-monthly-revenue');
        if (btnRecordRev && !btnRecordRev.dataset.listening) {
            btnRecordRev.addEventListener('click', () => app.views['export'].recordMonthlySalaryRevenue());
            btnRecordRev.dataset.listening = 'true';
        }

        // 4. Populate Project Select for Single Project Export
        const select = document.getElementById('export-project-select');
        const btn = document.getElementById('btn-export-csv');
        const showArchivedCb = document.getElementById('export-show-archived');

        const populateProjectSelect = async () => {
            try {
                const projects = await db.getAll('projects');
                const showArchived = showArchivedCb ? showArchivedCb.checked : true;
                const currentVal = select.value;

                select.innerHTML = Utils.buildStandardProjectOptions(projects, {
                    showClosed: showArchived,
                    placeholder: '請選擇專案...'
                });

                if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
                    select.value = currentVal;
                    btn.disabled = false;
                } else {
                    select.value = '';
                    btn.disabled = true;
                }
            } catch (e) {
                console.error("Error loading projects for export", e);
            }
        };

        await populateProjectSelect();

        if (showArchivedCb && !showArchivedCb.dataset.listening) {
            showArchivedCb.addEventListener('change', populateProjectSelect);
            showArchivedCb.dataset.listening = 'true';
        }

        select.onchange = () => {
            btn.disabled = !select.value;
        };

        btn.onclick = async () => {
            const projectId = Number(select.value);
            if (!projectId) return;
            await app.views['export'].exportCSV(projectId);
        };

        // 5. Bind Date Range Shortcut Buttons and Export All
        const startDateInput = document.getElementById('export-start-date');
        const endDateInput = document.getElementById('export-end-date');
        const btnExportAll = document.getElementById('btn-export-all-csv');

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const setDates = (start, end) => {
            startDateInput.value = formatDate(start);
            endDateInput.value = formatDate(end);
        };

        const bindShortcut = (id, fn) => {
            const el = document.getElementById(id);
            if (el && !el.dataset.listening) {
                el.onclick = fn;
                el.dataset.listening = 'true';
            }
        };

        bindShortcut('btn-shortcut-this-week', () => {
            const now = new Date();
            const currentDay = now.getDay();
            const monday = new Date(now);
            const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
            monday.setDate(now.getDate() + distanceToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            setDates(monday, sunday);
        });

        bindShortcut('btn-shortcut-this-month', () => {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setDates(firstDay, lastDay);
        });

        bindShortcut('btn-shortcut-last-month', () => {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            setDates(firstDay, lastDay);
        });

        bindShortcut('btn-shortcut-this-year', () => {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), 0, 1);
            const lastDay = new Date(now.getFullYear(), 11, 31);
            setDates(firstDay, lastDay);
        });

        if (btnExportAll && !btnExportAll.dataset.listening) {
            btnExportAll.onclick = async () => {
                const start = startDateInput.value;
                const end = endDateInput.value;
                await app.views['export'].exportAllCSV(start, end);
            };
            btnExportAll.dataset.listening = 'true';
        }

        // 6. Initial Render Billing Statement
        await app.views['export'].renderBillingStatement();
    },

    populateBillingClientsDropdown: async () => {
        const select = document.getElementById('billing-client-select');
        if (!select) return;

        try {
            const projects = await db.getAll('projects');
            const revenue = await db.getAll('manualRevenue');
            const uniqueClients = Utils.extractUniqueClients(projects, revenue);

            const currentVal = select.value;
            select.innerHTML = uniqueClients.map(c => `
                <option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>
            `).join('');

            if (currentVal && uniqueClients.includes(currentVal)) {
                select.value = currentVal;
            } else if (uniqueClients.length > 0) {
                select.value = uniqueClients[0];
            }
        } catch (e) {
            console.error('Error populating billing clients dropdown:', e);
        }
    },

    renderBillingStatement: async () => {
        const container = document.getElementById('billing-statement-container');
        if (!container) return;

        const client = document.getElementById('billing-client-select')?.value;
        const month = document.getElementById('billing-month-input')?.value;
        const rate = Number(document.getElementById('billing-hourly-rate')?.value) || Utils.DEFAULT_HOURLY_RATE;

        if (!client || !month) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1.5rem 0;">請選擇發款客戶與月份以載入對帳單據</p>';
            app.views['export'].currentStatement = null;
            return;
        }

        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem 0;">資料統計中...</p>';

        try {
            const projects = await db.getAll('projects');
            const allEntries = await db.getAll('entries');

            // Find all projects belonging to this client
            const matchedProjects = projects.filter(p => {
                const pClient = (p.client || '').trim();
                return pClient === client || (client && pClient.includes(client));
            });

            const projectMap = new Map(projects.map(p => [Number(p.id), p]));
            const targetPids = new Set(matchedProjects.map(p => Number(p.id)));

            // Filter entries by date (starts with YYYY-MM) and matching project
            const monthlyEntries = allEntries.filter(e => {
                const pid = Number(e.projectId);
                return targetPids.has(pid) && e.date && e.date.startsWith(month);
            });

            // Sort chronologically (earliest to latest)
            monthlyEntries.sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return (a.id || 0) - (b.id || 0);
            });

            // Calculate hours per project
            const projectHoursMap = {};
            let totalHours = 0;
            monthlyEntries.forEach(e => {
                const pid = Number(e.projectId);
                const h = Number(e.hours || 0);
                projectHoursMap[pid] = (projectHoursMap[pid] || 0) + h;
                totalHours += h;
            });

            const totalAmount = Math.round(totalHours * rate);

            // Active projects list
            const activeProjectsList = matchedProjects.filter(p => (projectHoursMap[p.id] || 0) > 0)
                .sort((a, b) => (projectHoursMap[b.id] || 0) - (projectHoursMap[a.id] || 0));

            // Save to currentStatement
            app.views['export'].currentStatement = {
                client,
                month,
                rate,
                totalHours,
                totalAmount,
                entries: monthlyEntries,
                projectMap,
                activeProjectsList,
                projectHoursMap
            };

            if (monthlyEntries.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem 1rem; color: #b45309;">
                        <span style="font-size: 1.5rem;">⚠️</span><br>
                        <strong>「${Utils.escapeHtml(client)}」在 ${month} 尚無任何工時紀錄。</strong><br>
                        <span style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; display: inline-block;">
                            若有該月份的工作請至「當日計時」或各專案頁面補登工時。
                        </span>
                    </div>
                `;
                return;
            }

            // Render Output
            container.innerHTML = `
                <!-- Summary Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0, 102, 204, 0.05); border: 1px solid rgba(0, 102, 204, 0.15); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">🏢 發款單位：<strong>${Utils.escapeHtml(client)}</strong> ｜ 📅 結算月份：<strong>${month}</strong></div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
                            ⏱️ 當月累計：<span style="color: var(--accent-primary);">${totalHours.toFixed(1)} h</span>
                            <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted);">（涵蓋 ${activeProjectsList.length} 個專案）</span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: var(--text-muted);">依時薪 $${rate}/h 計算</div>
                        <div style="font-size: 1.25rem; font-weight: 800; color: var(--success);">
                            💵 應收總額：$${totalAmount.toLocaleString()}
                        </div>
                    </div>
                </div>

                <!-- Timeline Entries Table -->
                <div style="margin-bottom: 1.25rem;">
                    <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; display: flex; justify-content: space-between;">
                        <span>📅 每日工作紀錄明細（時間軸流水帳，共 ${monthlyEntries.length} 筆）：</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow-y: auto; padding-right: 4px;">
                        ${monthlyEntries.map(e => {
                            const p = projectMap.get(Number(e.projectId));
                            const pName = p ? p.name : '未知專案';
                            return `
                                <div style="display: flex; align-items: baseline; gap: 10px; background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.88rem; line-height: 1.5;">
                                    <span style="font-weight: 700; color: var(--accent-primary); width: 85px; flex-shrink: 0; font-family: monospace;">${e.date}</span>
                                    <span style="font-weight: 600; width: 50px; flex-shrink: 0; color: var(--text-primary); text-align: right;">${Number(e.hours).toFixed(1)} h</span>
                                    <span style="background: rgba(0, 102, 204, 0.08); color: var(--accent-primary); padding: 1px 7px; border-radius: 4px; font-size: 0.78rem; font-weight: 600; flex-shrink: 0;">${Utils.escapeHtml(pName)}</span>
                                    <span style="color: var(--text-primary); flex: 1; word-break: break-word;">${Utils.escapeHtml(e.description || '日常工時執行')}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Project Subtotals Breakdown -->
                <div style="background: var(--bg-tertiary); border-radius: var(--radius-sm); padding: 12px 16px;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
                        📊 各專案工時小計與金額換算：
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;">
                        ${activeProjectsList.map(p => {
                            const ph = projectHoursMap[p.id] || 0;
                            const pAmt = Math.round(ph * rate);
                            const pct = totalHours > 0 ? ((ph / totalHours) * 100).toFixed(1) : 0;
                            return `
                                <div style="background: #ffffff; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600; color: var(--text-primary);">${Utils.escapeHtml(p.name)}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">${ph.toFixed(1)}h (${pct}%)</div>
                                    </div>
                                    <strong style="color: var(--accent-primary); font-size: 0.95rem;">$${pAmt.toLocaleString()}</strong>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

        } catch (e) {
            console.error('Error rendering billing statement:', e);
            container.innerHTML = `<p style="color: var(--danger); text-align: center;">載入請款單據失敗：${e.message}</p>`;
        }
    },

    copyBillingStatementText: () => {
        const stmt = app.views['export'].currentStatement;
        if (!stmt || !stmt.entries || stmt.entries.length === 0) {
            alert('目前無可複製之請款明細，請先選擇有工時紀錄的月份！');
            return;
        }

        const lines = [];
        lines.push(`【${stmt.client} ${stmt.month} 工作紀錄與工時結算】`);
        lines.push('');
        lines.push(`📅 結算月份：${stmt.month}`);
        lines.push(`⏱️ 總計時數：${stmt.totalHours.toFixed(1)} 小時`);
        lines.push(`💵 應收時薪：$${stmt.totalAmount.toLocaleString()} (以 $${stmt.rate}/hr 計算)`);
        lines.push('');
        lines.push('────────────────────────────────────────');
        lines.push('【每日工作紀錄明細（時間軸）】');

        stmt.entries.forEach(e => {
            const p = stmt.projectMap.get(Number(e.projectId));
            const pName = p ? p.name : '專案';
            const shortDate = e.date.length >= 10 ? e.date.substring(5) : e.date;
            lines.push(`• ${shortDate} (${Number(e.hours).toFixed(1)}h) [${pName}] ${e.description || '工作執行'}`);
        });

        lines.push('');
        lines.push('────────────────────────────────────────');
        lines.push('【各專案時數小計】');
        stmt.activeProjectsList.forEach((p, idx) => {
            const ph = stmt.projectHoursMap[p.id] || 0;
            const pAmt = Math.round(ph * stmt.rate);
            lines.push(`${idx + 1}. ${p.name}：${ph.toFixed(1)} 小時 ($${pAmt.toLocaleString()})`);
        });

        lines.push('========================================');
        lines.push(`合計請款總金額：$${stmt.totalAmount.toLocaleString()}`);

        const fullText = lines.join('\n');

        navigator.clipboard.writeText(fullText).then(() => {
            alert('📋 請款明細文字已成功複製到剪貼簿！\n您可以直接貼到 LINE、Email 或通訊軟體傳給客戶。');
        }).catch(err => {
            console.error('Copy to clipboard failed', err);
            prompt('請手動複製下方文字：', fullText);
        });
    },

    recordMonthlySalaryRevenue: async () => {
        const stmt = app.views['export'].currentStatement;
        if (!stmt || !stmt.entries || stmt.entries.length === 0 || stmt.totalAmount <= 0) {
            alert('目前尚無結算金額可登記！');
            return;
        }

        const confirmMsg = `確定要將「${stmt.client}」${stmt.month} 薪資 $${stmt.totalAmount.toLocaleString()} (${stmt.totalHours.toFixed(1)}h) 登記為總收入嗎？`;
        if (!confirm(confirmMsg)) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const revItem = {
                date: today,
                organization: stmt.client,
                amount: stmt.totalAmount,
                item: `${stmt.client} ${stmt.month} 計時薪資 (${stmt.totalHours.toFixed(1)}h)`,
                note: `依月度工時對帳單一鍵登記（總投入 ${stmt.totalHours.toFixed(1)}h，時薪 $${stmt.rate}/h）`,
                type: 'monthly_salary',
                createdAt: new Date().toISOString()
            };

            await db.add('manualRevenue', revItem);
            alert(`🎉 成功登記收入！\n已將 ${stmt.client} ${stmt.month} 薪資 $${stmt.totalAmount.toLocaleString()} 登記至年度總收入。`);

            // If annual-goals view is loaded, trigger refresh
            if (app.views['annual-goals'] && app.views['annual-goals'].refreshAll) {
                const year = stmt.month.split('-')[0];
                await app.views['annual-goals'].refreshAll(year);
            }
        } catch (e) {
            console.error('Error recording monthly salary revenue:', e);
            alert('登記收入失敗：' + e.message);
        }
    },

    exportCSV: async (projectId) => {
        const btn = document.getElementById('btn-export-csv');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '匯出中...';

        try {
            const project = await db.get('projects', projectId);
            if (!project) throw new Error("Project not found");

            const allEntries = await db.getAll('entries');
            const entries = allEntries
                .filter(e => Number(e.projectId) === Number(projectId))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (entries.length === 0) {
                alert('此專案尚無工時紀錄');
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }

            let csvContent = "\uFEFF";
            csvContent += "日期,描述,時數,子項目,建立時間\n";

            entries.forEach(e => {
                const date = e.date || '';
                const desc = (e.description || '').replace(/"/g, '""');
                const subItem = (e.subItem || '').replace(/"/g, '""');
                const hours = e.hours || 0;
                const createdAt = e.createdAt || '';

                csvContent += `"${date}","${desc}",${hours},"${subItem}","${createdAt}"\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            const filename = `${project.name}_工時紀錄_${new Date().toISOString().split('T')[0]}.csv`;
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            btn.innerText = '匯出完成';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerText = originalText;
            }, 2000);

        } catch (e) {
            console.error("Export failed", e);
            alert("匯出失敗：" + e.message);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    },

    exportAllCSV: async (startDate, endDate) => {
        const btn = document.getElementById('btn-export-all-csv');
        const originalText = btn.innerText;

        if (startDate && endDate && startDate > endDate) {
            alert('開始日期不能晚於結束日期！');
            return;
        }

        btn.disabled = true;
        btn.innerText = '匯出中...';

        try {
            const projects = await db.getAll('projects');
            const projectMap = new Map(projects.map(p => [p.id, p.name]));
            const allEntries = await db.getAll('entries');

            let entries = allEntries;
            if (startDate) {
                entries = entries.filter(e => e.date >= startDate);
            }
            if (endDate) {
                entries = entries.filter(e => e.date <= endDate);
            }

            entries.sort((a, b) => new Date(a.date) - new Date(b.date));

            if (entries.length === 0) {
                alert('此時間範圍內尚無工時紀錄');
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }

            let csvContent = "\uFEFF";
            csvContent += "日期,專案名稱,子項目,描述,時數,建立時間\n";

            entries.forEach(e => {
                const date = e.date || '';
                const projName = projectMap.get(Number(e.projectId)) || '未知專案';
                const subItem = (e.subItem || '').replace(/"/g, '""');
                const desc = (e.description || '').replace(/"/g, '""');
                const hours = e.hours || 0;
                const createdAt = e.createdAt || '';

                csvContent += `"${date}","${projName}","${subItem}","${desc}",${hours},"${createdAt}"\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);

            let rangeStr = '全部';
            if (startDate && endDate) {
                rangeStr = `${startDate}_至_${endDate}`;
            } else if (startDate) {
                rangeStr = `${startDate}_起`;
            } else if (endDate) {
                rangeStr = `至_${endDate}`;
            }

            const filename = `所有專案工時紀錄_${rangeStr}.csv`;
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            btn.innerText = '匯出完成';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerText = originalText;
            }, 2000);

        } catch (e) {
            console.error("Export all failed", e);
            alert("匯出失敗：" + e.message);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
};
