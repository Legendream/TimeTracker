app.views['dashboard'] = {
    editingId: null,
    deletingId: null,
    selectedCategoryFilter: 'ALL',

    init: async () => {
        console.log('Dashboard View Loaded (Modern Above-The-Fold Layout)');
        await app.views['dashboard'].loadProjectTypes();
        await app.views['dashboard'].populateClientsDatalist();
        await app.views['dashboard'].renderProjects();

        // 1. Bind Modal and Form Events (Global fallback)
        app.views['dashboard'].bindModalEvents();

        // 1b. Bind Open Create Modal Button
        const openModalBtn = document.getElementById('btn-open-create-project-modal');
        if (openModalBtn && !openModalBtn.dataset.listening) {
            openModalBtn.addEventListener('click', () => {
                app.views['dashboard'].openCreateModal();
            });
            openModalBtn.dataset.listening = 'true';
        }

        // 3. Bind Collapsible Chart Toggle Button
        const toggleChartBtn = document.getElementById('btn-toggle-annual-chart');
        if (toggleChartBtn && !toggleChartBtn.dataset.listening) {
            toggleChartBtn.addEventListener('click', () => {
                app.views['dashboard'].toggleAnnualChart();
            });
            toggleChartBtn.dataset.listening = 'true';
        }

        // 3b. Bind Universal Benchmark Toggle Button
        const toggleBenchBtn = document.getElementById('btn-toggle-universal-benchmark');
        if (toggleBenchBtn && !toggleBenchBtn.dataset.listening) {
            toggleBenchBtn.addEventListener('click', () => {
                app.views['dashboard'].toggleUniversalBenchmark();
            });
            toggleBenchBtn.dataset.listening = 'true';
        }

        // 3c. Bind Taxonomy Settings Modal Events
        const openTaxonomyBtn = document.getElementById('btn-open-taxonomy-settings');
        if (openTaxonomyBtn && !openTaxonomyBtn.dataset.listening) {
            openTaxonomyBtn.addEventListener('click', () => {
                app.views['dashboard'].openTaxonomySettingsModal();
            });
            openTaxonomyBtn.dataset.listening = 'true';
        }

        const addNatureBtn = document.getElementById('btn-add-custom-nature');
        if (addNatureBtn && !addNatureBtn.dataset.listening) {
            addNatureBtn.addEventListener('click', app.views['dashboard'].handleAddCustomNature);
            addNatureBtn.dataset.listening = 'true';
        }

        const resetTaxonomyBtn = document.getElementById('btn-reset-taxonomy-default');
        if (resetTaxonomyBtn && !resetTaxonomyBtn.dataset.listening) {
            resetTaxonomyBtn.addEventListener('click', app.views['dashboard'].handleResetTaxonomyDefault);
            resetTaxonomyBtn.dataset.listening = 'true';
        }

        const saveTaxonomyBtn = document.getElementById('btn-save-taxonomy-settings');
        if (saveTaxonomyBtn && !saveTaxonomyBtn.dataset.listening) {
            saveTaxonomyBtn.addEventListener('click', app.views['dashboard'].handleSaveTaxonomySettings);
            saveTaxonomyBtn.dataset.listening = 'true';
        }

        // 6. Bind Year Change for Chart
        const chartYearSelect = document.getElementById('annual-chart-year');
        if (chartYearSelect && !chartYearSelect.dataset.listening) {
            chartYearSelect.addEventListener('change', () => {
                app.views['dashboard'].renderAnnualChart(chartYearSelect.value);
            });
            chartYearSelect.dataset.listening = 'true';
        }

        // 7. Bind Search Input & Secondary Category Filter Dropdown (Plan A)
        const searchInput = document.getElementById('dashboard-search-input');
        if (searchInput && !searchInput.dataset.listening) {
            searchInput.addEventListener('input', (e) => {
                app.views['dashboard'].searchQuery = e.target.value.trim().toLowerCase();
                app.views['dashboard'].renderProjects();
            });
            searchInput.dataset.listening = 'true';
        }

        const catSelect = document.getElementById('dashboard-category-select');
        if (catSelect && !catSelect.dataset.listening) {
            catSelect.addEventListener('change', (e) => {
                app.views['dashboard'].selectedCategoryFilter = e.target.value;
                app.views['dashboard'].renderProjects();
            });
            catSelect.dataset.listening = 'true';
        }

        // Project Billing Type toggle in modal
        const projBillingSelect = document.getElementById('proj-billing-type');
        if (projBillingSelect && !projBillingSelect.dataset.listening) {
            projBillingSelect.addEventListener('change', () => {
                app.views['dashboard'].syncBillingFormUI();
            });
            projBillingSelect.dataset.listening = 'true';
        }

        // 8. Event Delegation for Project List Card Actions
        const list = document.getElementById('projects-list');
        if (list && !list.dataset.listening) {
            list.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.btn-delete');
                const editBtn = e.target.closest('.btn-edit');
                const confirmBtn = e.target.closest('.btn-confirm-delete');
                const cancelBtn = e.target.closest('.btn-cancel-delete');
                const closeBtn = e.target.closest('.btn-close-project');
                const projectCard = e.target.closest('.project-card');

                // Handle Delete Request
                if (deleteBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = Number(deleteBtn.dataset.id);
                    if (!isNaN(id)) {
                        app.views['dashboard'].deletingId = id;
                        app.views['dashboard'].renderProjects();
                    }
                }
                // Handle Confirm Delete
                else if (confirmBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = Number(confirmBtn.dataset.id);
                    if (!isNaN(id)) app.views['dashboard'].executeDelete(id);
                }
                // Handle Cancel Delete
                else if (cancelBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    app.views['dashboard'].deletingId = null;
                    app.views['dashboard'].renderProjects();
                }
                // Handle Edit
                else if (editBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = Number(editBtn.dataset.id);
                    if (!isNaN(id)) app.views['dashboard'].startEdit(id);
                }
                // Handle Close/Reopen
                else if (closeBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = Number(closeBtn.dataset.id);
                    if (!isNaN(id)) app.views['dashboard'].executeCloseProject(id);
                }
                // Handle Navigation (Card Click)
                else if (projectCard) {
                    e.preventDefault();
                    const id = Number(projectCard.dataset.navId);
                    if (!isNaN(id)) app.views['dashboard'].handleProjectClick(id);
                }
            });
            list.dataset.listening = 'true';
        }
    },

    syncBillingFormUI: () => {
        const billingSelect = document.getElementById('proj-billing-type');
        const rateGroup = document.getElementById('proj-hourly-rate-group');
        const revLabel = document.getElementById('proj-revenue-label');
        if (!billingSelect) return;

        const isHourly = billingSelect.value === 'hourly';
        if (rateGroup) {
            rateGroup.style.display = isHourly ? 'block' : 'none';
        }
        if (revLabel) {
            revLabel.innerText = isHourly ? '預算/合約上限 (元)' : '合約總額 (元)';
        }
    },

    bindModalEvents: () => {
        // Bind Close Modal Buttons
        const closeModalBtn = document.getElementById('btn-close-project-modal');
        if (closeModalBtn && !closeModalBtn.dataset.listening) {
            closeModalBtn.addEventListener('click', () => {
                app.views['dashboard'].closeModal();
            });
            closeModalBtn.dataset.listening = 'true';
        }

        const cancelModalBtn = document.getElementById('btn-cancel-project-modal');
        if (cancelModalBtn && !cancelModalBtn.dataset.listening) {
            cancelModalBtn.addEventListener('click', () => {
                app.views['dashboard'].closeModal();
            });
            cancelModalBtn.dataset.listening = 'true';
        }

        // Close on Backdrop Click
        const modalOverlay = document.getElementById('create-project-modal');
        if (modalOverlay && !modalOverlay.dataset.listening) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    app.views['dashboard'].closeModal();
                }
            });
            modalOverlay.dataset.listening = 'true';
        }

        // Close on ESC key
        if (!document.body.dataset.escModalBound) {
            document.addEventListener('keydown', (e) => {
                const overlay = document.getElementById('create-project-modal');
                if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
                    app.views['dashboard'].closeModal();
                }
            });
            document.body.dataset.escModalBound = 'true';
        }

        // Bind Create / Edit Project Form Submit
        const form = document.getElementById('create-project-form');
        if (form && !form.dataset.listening) {
            form.addEventListener('submit', app.views['dashboard'].handleFormSubmit);
            form.dataset.listening = 'true';
        }

        // Bind Add Project Type Tag Button
        const addTypeBtn = document.getElementById('add-type-btn');
        if (addTypeBtn && !addTypeBtn.dataset.listening) {
            addTypeBtn.addEventListener('click', app.views['dashboard'].handleAddType);
            addTypeBtn.dataset.listening = 'true';
        }

        // Project Billing Type toggle in modal
        const projBillingSelect = document.getElementById('proj-billing-type');
        if (projBillingSelect && !projBillingSelect.dataset.listening) {
            projBillingSelect.addEventListener('change', () => {
                app.views['dashboard'].syncBillingFormUI();
            });
            projBillingSelect.dataset.listening = 'true';
        }
    },

    openCreateModal: async () => {
        app.views['dashboard'].editingId = null;
        app.views['dashboard'].bindModalEvents();
        await app.views['dashboard'].loadProjectTypes();
        await app.views['dashboard'].populateClientsDatalist();

        const modal = document.getElementById('create-project-modal');
        const form = document.getElementById('create-project-form');
        const titleEl = document.getElementById('project-modal-title');
        const submitBtn = document.getElementById('btn-submit-project-modal');

        if (form) form.reset();
        if (titleEl) titleEl.innerText = '建立新專案';
        if (submitBtn) {
            submitBtn.innerHTML = `${Icons.render('plus', { size: 14 })} 建立專案`;
            submitBtn.style.backgroundColor = '';
        }

        const dateInput = document.getElementById('proj-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const yearSelect = document.getElementById('proj-year');
        if (yearSelect) yearSelect.value = '2026';

        const catSelect = document.getElementById('proj-category');
        if (catSelect) catSelect.value = 'commercial';

        const statusSelect = document.getElementById('proj-status');
        if (statusSelect) statusSelect.value = 'active';

        const billingSelect = document.getElementById('proj-billing-type');
        if (billingSelect) billingSelect.value = 'hourly';

        const rateInput = document.getElementById('proj-hourly-rate');
        if (rateInput) rateInput.value = Utils.DEFAULT_HOURLY_RATE;

        app.views['dashboard'].syncBillingFormUI();

        if (document.getElementById('proj-subitems')) {
            document.getElementById('proj-subitems').value = '';
        }

        if (modal) modal.classList.add('active');
        document.getElementById('proj-name').focus();
    },

    closeModal: () => {
        const modal = document.getElementById('create-project-modal');
        if (modal) modal.classList.remove('active');
        app.views['dashboard'].editingId = null;
    },

    toggleAnnualChart: () => {
        const collapseEl = document.getElementById('annual-chart-collapse');
        const arrowEl = document.getElementById('chart-toggle-arrow');
        if (!collapseEl) return;

        const isHidden = collapseEl.style.display === 'none' || !collapseEl.style.display;
        if (isHidden) {
            collapseEl.style.display = 'block';
            if (arrowEl) arrowEl.innerText = '▴';
            const chartYearSelect = document.getElementById('annual-chart-year');
            const currentYear = chartYearSelect ? chartYearSelect.value : '2026';
            app.views['dashboard'].renderAnnualChart(currentYear);
        } else {
            collapseEl.style.display = 'none';
            if (arrowEl) arrowEl.innerText = '▾';
        }
    },

    toggleUniversalBenchmark: () => {
        const collapseEl = document.getElementById('universal-benchmark-collapse');
        const arrowEl = document.getElementById('benchmark-toggle-arrow');
        if (!collapseEl) return;

        const isHidden = collapseEl.style.display === 'none' || !collapseEl.style.display;
        if (isHidden) {
            collapseEl.style.display = 'block';
            if (arrowEl) arrowEl.innerText = '▴';
            app.views['dashboard'].renderUniversalBenchmark();
        } else {
            collapseEl.style.display = 'none';
            if (arrowEl) arrowEl.innerText = '▾';
        }
    },

    renderUniversalBenchmark: async () => {
        const container = document.getElementById('universal-benchmark-container');
        if (!container) return;

        try {
            const entries = await db.getAll('entries');
            const projects = await db.getAll('projects');
            const projectsMap = new Map(projects.map(p => [p.id, p]));
            const totalHours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

            const natureMap = {};
            entries.forEach(e => {
                const nature = Utils.classifyWorkNature(e.subItem, e.description);
                if (!natureMap[nature.key]) {
                    natureMap[nature.key] = {
                        key: nature.key,
                        name: `${nature.icon} ${nature.label}`,
                        color: nature.color,
                        hours: 0,
                        count: 0,
                        projects: new Set(),
                        entries: []
                    };
                }
                natureMap[nature.key].hours += Number(e.hours || 0);
                natureMap[nature.key].count += 1;
                if (e.projectId) natureMap[nature.key].projects.add(e.projectId);
                natureMap[nature.key].entries.push(e);
            });

            const list = Object.values(natureMap).sort((a, b) => b.hours - a.hours);

            container.innerHTML = `
                <!-- Multi-segment visual progress bar -->
                <div style="width: 100%; height: 14px; border-radius: 7px; overflow: hidden; display: flex; background: rgba(0,0,0,0.06); margin-bottom: 1rem;">
                    ${list.map(item => {
                        const pct = Math.max(1, (item.hours / totalHours) * 100);
                        return `<div style="width: ${pct}%; height: 100%; background: ${item.color}; cursor: pointer;" title="${item.name}: ${item.hours.toFixed(1)}h (${pct.toFixed(1)}%)"></div>`;
                    }).join('')}
                </div>

                <!-- Table breakdown -->
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary); text-align: left;">
                                <th style="padding: 8px 10px;">專業工作性質 (跨專案統計)</th>
                                <th style="padding: 8px 10px; text-align: right;">全站累計工時</th>
                                <th style="padding: 8px 10px; text-align: right;">總工時佔比</th>
                                <th style="padding: 8px 10px; text-align: right;">執行總筆數 (點擊查看明細)</th>
                                <th style="padding: 8px 10px; text-align: right;">平均單次耗時</th>
                                <th style="padding: 8px 10px; text-align: right;">涉及專案數</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map((item, idx) => {
                                const pct = ((item.hours / totalHours) * 100).toFixed(1);
                                const avg = (item.hours / item.count).toFixed(1);
                                return `
                                    <tr class="wbs-row-interactive" data-univ-idx="${idx}" style="border-bottom: 1px solid rgba(0,0,0,0.04);">
                                        <td style="padding: 8px 10px; font-weight: 600;">
                                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${item.color}; margin-right: 8px;"></span>
                                            ${item.name}
                                        </td>
                                        <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: var(--text-primary);">${item.hours.toFixed(1)} h</td>
                                        <td style="padding: 8px 10px; text-align: right; color: var(--accent-primary); font-weight: 600;">${pct}%</td>
                                        <td style="padding: 8px 10px; text-align: right;">
                                            <button type="button" class="wbs-clickable-count btn-univ-item-drilldown" data-univ-idx="${idx}" title="點擊查看全站「${item.name}」共 ${item.count} 筆原始工時明細">
                                                ${item.count} 筆 🔍
                                            </button>
                                        </td>
                                        <td style="padding: 8px 10px; text-align: right; color: var(--text-muted);">${avg} h/次</td>
                                        <td style="padding: 8px 10px; text-align: right; color: var(--text-secondary);">${item.projects.size} 個</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="margin-top: 1rem; padding: 12px 16px; background: rgba(0, 102, 204, 0.05); border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-primary); border: 1px solid rgba(0, 102, 204, 0.15); line-height: 1.6;">
                    <strong>💡 全站提案估時經驗法則 (Estimation Benchmarks)</strong>：<br>
                    • <strong>🎤 專家訪談</strong>：平均每場深度訪談（含訪綱準備、訪談與筆記）約需 <strong>2.5 ~ 3.5 小時</strong>。<br>
                    • <strong>🎯 工作坊 / 培訓活動</strong>：平均每場交付約需 <strong>10 ~ 15 小時</strong>（含前置籌備 5h、現場主持 3h、成果整理 4h）。<br>
                    • <strong>✍️ 報告 / 指引撰寫</strong>：每萬字撰寫修訂約需 <strong>20 ~ 25 小時</strong>（含調研 8h、撰寫 12h、審查修改 5h）。<br>
                    • <strong>🔍 桌面研究</strong>：中型顧問專案平均需投入約 <strong>12 ~ 18 小時</strong> 進行文獻與資料研讀。
                </div>
            `;

            // Bind Drilldown Clicks
            container.querySelectorAll('.btn-univ-item-drilldown').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = Number(btn.dataset.univIdx);
                    const item = list[idx];
                    if (item) {
                        app.openWbsDrilldown({
                            title: item.name,
                            color: item.color,
                            entries: item.entries,
                            isUniversal: true,
                            projectsMap: projectsMap,
                            natureKey: item.key
                        });
                    }
                });
            });

            container.querySelectorAll('.wbs-row-interactive').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    const idx = Number(row.dataset.univIdx);
                    const item = list[idx];
                    if (item) {
                        app.openWbsDrilldown({
                            title: item.name,
                            color: item.color,
                            entries: item.entries,
                            isUniversal: true,
                            projectsMap: projectsMap,
                            natureKey: item.key
                        });
                    }
                });
            });

        } catch (e) {
            console.error("Error rendering universal benchmark:", e);
            container.innerHTML = `<p style="color: var(--danger)">載入失敗</p>`;
        }
    },

    openTaxonomySettingsModal: () => {
        const modal = document.getElementById('taxonomy-settings-modal');
        if (!modal) return;
        app.views['dashboard'].renderTaxonomyRows(Utils.WORK_NATURES);
        modal.classList.add('active');
    },

    renderTaxonomyRows: (naturesObj) => {
        const tbody = document.getElementById('taxonomy-settings-tbody');
        if (!tbody) return;
        const rows = Object.values(naturesObj).map(n => {
            const isOther = n.key === 'other';
            return `
                <tr data-key="${n.key}" style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <td style="padding: 6px 8px;"><input type="text" class="nature-icon-input" value="${n.icon || '🏷️'}" style="width: 40px; text-align: center; padding: 4px;" ${isOther ? 'disabled' : ''}></td>
                    <td style="padding: 6px 8px;"><input type="text" class="nature-label-input" value="${n.label}" style="width: 100%; padding: 4px 6px;" ${isOther ? 'disabled' : ''}></td>
                    <td style="padding: 6px 8px;"><input type="text" class="nature-keywords-input" value="${n.keywords || ''}" placeholder="${isOther ? '無須關鍵字 (預設歸納)' : '逗號分隔關鍵字...'}" style="width: 100%; padding: 4px 6px;" ${isOther ? 'disabled' : ''}></td>
                    <td style="padding: 6px 8px; text-align: center;"><input type="color" class="nature-color-input" value="${n.color || '#64748b'}" style="padding: 1px; height: 28px; width: 36px; cursor: pointer; border-radius: 4px;" ${isOther ? 'disabled' : ''}></td>
                    <td style="padding: 6px 8px; text-align: center;">
                        ${!isOther ? '<button type="button" class="btn-delete-nature" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1rem;" title="刪除此型態">🗑️</button>' : '<span style="color: var(--text-muted);">-</span>'}
                    </td>
                </tr>
            `;
        }).join('');
        tbody.innerHTML = rows;

        tbody.querySelectorAll('.btn-delete-nature').forEach(btn => {
            btn.onclick = () => {
                btn.closest('tr').remove();
            };
        });
    },

    handleAddCustomNature: () => {
        const icon = document.getElementById('new-nature-icon').value.trim() || '🏷️';
        const label = document.getElementById('new-nature-label').value.trim();
        const keywords = document.getElementById('new-nature-keywords').value.trim();
        const color = document.getElementById('new-nature-color').value || '#06b6d4';

        if (!label) {
            alert('請填寫型態名稱');
            return;
        }

        const tbody = document.getElementById('taxonomy-settings-tbody');
        if (!tbody) return;

        const key = 'custom_' + Date.now();
        const tr = document.createElement('tr');
        tr.dataset.key = key;
        tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
        tr.innerHTML = `
            <td style="padding: 6px 8px;"><input type="text" class="nature-icon-input" value="${icon}" style="width: 40px; text-align: center; padding: 4px;"></td>
            <td style="padding: 6px 8px;"><input type="text" class="nature-label-input" value="${label}" style="width: 100%; padding: 4px 6px;"></td>
            <td style="padding: 6px 8px;"><input type="text" class="nature-keywords-input" value="${keywords}" placeholder="逗號分隔關鍵字..." style="width: 100%; padding: 4px 6px;"></td>
            <td style="padding: 6px 8px; text-align: center;"><input type="color" class="nature-color-input" value="${color}" style="padding: 1px; height: 28px; width: 36px; cursor: pointer; border-radius: 4px;"></td>
            <td style="padding: 6px 8px; text-align: center;">
                <button type="button" class="btn-delete-nature" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1rem;" title="刪除此型態">🗑️</button>
            </td>
        `;
        tr.querySelector('.btn-delete-nature').onclick = () => tr.remove();

        const otherRow = tbody.querySelector('tr[data-key="other"]');
        if (otherRow) {
            tbody.insertBefore(tr, otherRow);
        } else {
            tbody.appendChild(tr);
        }

        document.getElementById('new-nature-icon').value = '';
        document.getElementById('new-nature-label').value = '';
        document.getElementById('new-nature-keywords').value = '';
    },

    handleResetTaxonomyDefault: () => {
        if (confirm('確定要將工作型態字典恢復為系統預設值？自訂的型態將被重設。')) {
            app.views['dashboard'].renderTaxonomyRows(Utils.DEFAULT_WORK_NATURES);
        }
    },

    handleSaveTaxonomySettings: async () => {
        const tbody = document.getElementById('taxonomy-settings-tbody');
        if (!tbody) return;

        const result = {};
        const trs = tbody.querySelectorAll('tr');
        trs.forEach(tr => {
            const key = tr.dataset.key;
            const icon = tr.querySelector('.nature-icon-input') ? tr.querySelector('.nature-icon-input').value.trim() : '🏷️';
            const label = tr.querySelector('.nature-label-input') ? tr.querySelector('.nature-label-input').value.trim() : '';
            const keywords = tr.querySelector('.nature-keywords-input') ? tr.querySelector('.nature-keywords-input').value.trim() : '';
            const color = tr.querySelector('.nature-color-input') ? tr.querySelector('.nature-color-input').value : '#64748b';

            if (key && (label || key === 'other')) {
                result[key] = { key, icon, label: label || (key === 'other' ? '一般執行與其他' : ''), keywords, color };
            }
        });

        try {
            await db.put('settings', { key: 'customWorkNatures', value: result });
            await Utils.initTaxonomy();

            const modal = document.getElementById('taxonomy-settings-modal');
            if (modal) modal.classList.remove('active');

            // Refresh dashboard universal benchmark
            await app.views['dashboard'].renderUniversalBenchmark();

            // If project-details view is currently loaded, refresh it
            const select = document.getElementById('project-details-select');
            if (select && select.value && app.views['project-details'].loadProjectDetails) {
                await app.views['project-details'].loadProjectDetails(select.value);
            }

            alert('全站工作型態字典已更新，並重新計算所有分析！');
        } catch (err) {
            console.error("Error saving taxonomy settings", err);
            alert('儲存設定失敗');
        }
    },

    populateClientsDatalist: async () => {
        try {
            const datalist = document.getElementById('clients-master-datalist');
            if (!datalist) return;

            const projects = await db.getAll('projects');
            const revenue = await db.getAll('manualRevenue');
            const uniqueClients = Utils.extractUniqueClients(projects, revenue);
            datalist.innerHTML = uniqueClients.map(c => `<option value="${Utils.escapeHtml(c)}">`).join('');
        } catch (e) {
            console.error('Error populating clients datalist:', e);
        }
    },

    loadProjectTypes: async () => {
        try {
            let typesSetting = await db.get('settings', 'projectTypes');
            let types = typesSetting ? typesSetting.value : ['研究', 'PM', '寫作', '顧問', '課程'];
            if (!typesSetting) {
                await db.put('settings', { key: 'projectTypes', value: types });
            }
            app.views['dashboard'].renderProjectTypes(types);
        } catch (e) {
            console.error("Error loading project types", e);
            app.views['dashboard'].renderProjectTypes(['研究', 'PM', '寫作', '顧問', '課程']);
        }
    },

    renderProjectTypes: (types) => {
        const container = document.getElementById('proj-types-container');
        if (!container) return;

        container.innerHTML = types.map(type => `
            <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none; font-size: 0.85rem;">
                <input type="checkbox" name="proj-type" value="${type}" style="width: auto;"> ${type}
            </label>
        `).join('');
    },

    handleAddType: async () => {
        const input = document.getElementById('new-type-input');
        const newType = input.value.trim();
        if (!newType) return;

        try {
            let typesSetting = await db.get('settings', 'projectTypes');
            let types = typesSetting ? typesSetting.value : ['研究', 'PM', '寫作', '顧問', '課程'];

            if (!types.includes(newType)) {
                types.push(newType);
                await db.put('settings', { key: 'projectTypes', value: types });
                app.views['dashboard'].renderProjectTypes(types);
                const newCheckbox = document.querySelector(`input[value="${newType}"]`);
                if (newCheckbox) newCheckbox.checked = true;
            }
            input.value = '';
        } catch (e) {
            console.error("Error adding project type", e);
            alert("新增失敗");
        }
    },

    handleFormSubmit: async (e) => {
        e.preventDefault();

        const year = document.getElementById('proj-year').value;
        const startDate = document.getElementById('proj-date').value;
        const name = document.getElementById('proj-name').value.trim();
        const client = document.getElementById('proj-client') ? document.getElementById('proj-client').value.trim() : '';
        const revenueStr = document.getElementById('proj-revenue').value;
        const category = document.getElementById('proj-category') ? document.getElementById('proj-category').value : 'commercial';
        const status = document.getElementById('proj-status') ? document.getElementById('proj-status').value : 'active';
        const billingType = document.getElementById('proj-billing-type') ? document.getElementById('proj-billing-type').value : 'hourly';
        const hourlyRateStr = document.getElementById('proj-hourly-rate') ? document.getElementById('proj-hourly-rate').value.trim() : '';
        const hourlyRate = (hourlyRateStr !== '' && !isNaN(Number(hourlyRateStr))) ? Number(hourlyRateStr) : Utils.DEFAULT_HOURLY_RATE;

        const types = Array.from(document.querySelectorAll('input[name="proj-type"]:checked'))
            .map(cb => cb.value);

        if (!name || !startDate) {
            alert('請填寫完整專案名稱與開始日期');
            return;
        }

        const subitemsInput = document.getElementById('proj-subitems');
        const subItems = subitemsInput ? subitemsInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];

        const projectData = {
            year,
            startDate,
            name,
            client: client || '未指定客戶',
            revenue: revenueStr ? Number(revenueStr) : 0,
            hourlyRate,
            category,
            status,
            billingType,
            subItems,
            types,
            createdAt: new Date().toISOString()
        };

        try {
            let savedPid = null;
            if (app.views['dashboard'].editingId) {
                const pid = app.views['dashboard'].editingId;
                savedPid = pid;
                const existing = await db.get('projects', pid);
                projectData.id = pid;
                projectData.createdAt = existing ? existing.createdAt : new Date().toISOString();
                await db.put('projects', projectData);
            } else {
                savedPid = await db.add('projects', projectData);
            }

            app.views['dashboard'].closeModal();
            await app.views['dashboard'].populateClientsDatalist();
            await app.views['dashboard'].renderProjects();

            // Refresh project dropdowns across views (Timer, Project Details, Export)
            if (app.views['timer'] && app.views['timer'].populateProjectDropdown) {
                await app.views['timer'].populateProjectDropdown();
            }
            if (app.views['project-details'] && app.views['project-details'].populateProjectDropdown) {
                await app.views['project-details'].populateProjectDropdown();
            }

            // If user is currently in project details view for this project, reload details
            if (savedPid && app.views['project-details'] && app.views['project-details'].currentProjectId === savedPid) {
                await app.views['project-details'].loadProjectDetails(savedPid);
            }
        } catch (err) {
            console.error('Error saving project:', err);
            alert('儲存失敗');
        }
    },

    startEdit: async (id) => {
        try {
            app.views['dashboard'].deletingId = null;

            const project = await db.get('projects', id);
            if (!project) return;

            app.views['dashboard'].editingId = id;

            document.getElementById('proj-year').value = project.year || '2026';
            document.getElementById('proj-date').value = project.startDate || '';
            document.getElementById('proj-name').value = project.name || '';
            if (document.getElementById('proj-client')) {
                document.getElementById('proj-client').value = project.client || '';
            }
            document.getElementById('proj-revenue').value = project.revenue || '';

            if (document.getElementById('proj-category')) {
                document.getElementById('proj-category').value = project.category || 'commercial';
            }
            if (document.getElementById('proj-status')) {
                document.getElementById('proj-status').value = project.status || 'active';
            }
            if (document.getElementById('proj-billing-type')) {
                document.getElementById('proj-billing-type').value = project.billingType || 'hourly';
            }
            if (document.getElementById('proj-hourly-rate')) {
                document.getElementById('proj-hourly-rate').value = (project.hourlyRate !== undefined && project.hourlyRate !== null && project.hourlyRate !== '') ? project.hourlyRate : Utils.DEFAULT_HOURLY_RATE;
            }
            if (document.getElementById('proj-subitems')) {
                document.getElementById('proj-subitems').value = (project.subItems || []).join(', ');
            }

            app.views['dashboard'].syncBillingFormUI();

            document.querySelectorAll('input[name="proj-type"]').forEach(cb => cb.checked = false);
            if (project.types) {
                project.types.forEach(type => {
                    const cb = document.querySelector(`input[value="${type}"]`);
                    if (cb) cb.checked = true;
                });
            }

            const titleEl = document.getElementById('project-modal-title');
            if (titleEl) titleEl.innerText = `編輯專案：${project.name}`;

            const submitBtn = document.getElementById('btn-submit-project-modal');
            if (submitBtn) {
                submitBtn.innerHTML = `${Icons.render('save', { size: 14 })} 儲存變更`;
                submitBtn.style.backgroundColor = 'var(--accent-primary)';
            }

            app.views['dashboard'].bindModalEvents();
            const modal = document.getElementById('create-project-modal');
            if (modal) modal.classList.add('active');

        } catch (e) {
            console.error("Edit error", e);
        }
    },

    executeDelete: async (id) => {
        try {
            await db.delete('projects', id);
            if (app.views['dashboard'].editingId === id) {
                app.views['dashboard'].closeModal();
            }
            app.views['dashboard'].deletingId = null;
            await app.views['dashboard'].renderProjects();
        } catch (e) {
            console.error("Delete error", e);
            alert("刪除失敗");
        }
    },

    handleProjectClick: (id) => {
        localStorage.setItem('pending_project_id', id);
        window.location.hash = 'project-details';
    },

    executeCloseProject: async (id) => {
        try {
            const project = await db.get('projects', id);
            if (!project) return;

            const isClosed = project.status === 'closed';
            project.status = isClosed ? 'active' : 'closed';

            await db.put('projects', project);
            await app.views['dashboard'].renderProjects();
        } catch (e) {
            console.error("Close project error", e);
        }
    },

    renderProjects: async () => {
        const list = document.getElementById('projects-list');
        if (!list) return;
        list.innerHTML = '<p>載入中...</p>';

        try {
            const projects = await db.getAll('projects');
            const entries = await db.getAll('entries');
            const revenues = await db.getAll('manualRevenue');

            // Calculate total hours per project
            const hoursMap = {};
            let totalAllHours = 0;
            entries.forEach(e => {
                const pid = Number(e.projectId);
                const h = Number(e.hours || 0);
                if (pid) hoursMap[pid] = (hoursMap[pid] || 0) + h;
                totalAllHours += h;
            });

            // Calculate total revenue per project
            const revMap = {};
            revenues.forEach(r => {
                const pid = Number(r.projectId);
                if (pid) revMap[pid] = (revMap[pid] || 0) + Number(r.amount || 0);
            });

            // Calculate Pipeline Stage Counts (Plan A - Strict 1:1 Status Mapping)
            const activeCount = projects.filter(p => p.status === 'active').length;
            const biddingCount = projects.filter(p => p.status === 'bidding').length;
            const pendingPaymentCount = projects.filter(p => p.status === 'pending_payment').length;
            const closedCount = projects.filter(p => p.status === 'closed').length;
            const allCount = projects.filter(p => p.status !== 'closed').length;

            // Initialize selectedStatusFilters as Set if not already
            if (!app.views['dashboard'].selectedStatusFilters) {
                app.views['dashboard'].selectedStatusFilters = new Set(['active']);
            }
            const activeStatusSet = app.views['dashboard'].selectedStatusFilters;

            // Render Interactive Pipeline Tabs (Multi-Select Supported)
            const pipelineTabsContainer = document.getElementById('dashboard-pipeline-tabs');
            if (pipelineTabsContainer) {
                const tabs = [
                    { key: 'active', dotClass: 'status-active', label: '執行中', count: activeCount },
                    { key: 'bidding', dotClass: 'status-bidding', label: '提案/開拓中', count: biddingCount },
                    { key: 'pending_payment', dotClass: 'status-pending', label: '待請款', count: pendingPaymentCount },
                    { key: 'closed', dotClass: 'status-closed', label: '歷史結案', count: closedCount },
                    { key: 'ALL', dotClass: '', label: '全部進行中', count: allCount }
                ];

                pipelineTabsContainer.innerHTML = tabs.map(tab => {
                    const isTabActive = activeStatusSet.has(tab.key);
                    const dotHtml = tab.dotClass ? `<span class="status-indicator-dot ${tab.dotClass}"></span>` : '';
                    return `
                        <button type="button" class="pipeline-tab-btn ${isTabActive ? 'active' : ''}" data-status="${tab.key}" title="可點擊複選多個狀態">
                            ${dotHtml}<span>${tab.label}</span>
                            <span class="pipeline-tab-count">${tab.count}</span>
                        </button>
                    `;
                }).join('');

                pipelineTabsContainer.querySelectorAll('.pipeline-tab-btn').forEach(btn => {
                    btn.onclick = () => {
                        const clickedKey = btn.dataset.status;
                        if (clickedKey === 'ALL') {
                            app.views['dashboard'].selectedStatusFilters = new Set(['ALL']);
                        } else {
                            if (app.views['dashboard'].selectedStatusFilters.has('ALL')) {
                                app.views['dashboard'].selectedStatusFilters.clear();
                            }
                            if (app.views['dashboard'].selectedStatusFilters.has(clickedKey)) {
                                app.views['dashboard'].selectedStatusFilters.delete(clickedKey);
                            } else {
                                app.views['dashboard'].selectedStatusFilters.add(clickedKey);
                            }
                            if (app.views['dashboard'].selectedStatusFilters.size === 0) {
                                app.views['dashboard'].selectedStatusFilters = new Set(['ALL']);
                            }
                        }
                        app.views['dashboard'].renderProjects();
                    };
                });
            }

            // Update Total Hours Value
            const totalHoursVal = document.getElementById('dashboard-total-hours-val');
            if (totalHoursVal) {
                totalHoursVal.innerText = `${totalAllHours.toFixed(1)} h`;
            }

            if (projects.length === 0) {
                list.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">尚無專案，請點擊上方「建立新專案」按鈕。</div>';
                return;
            }

            const catFilter = app.views['dashboard'].selectedCategoryFilter || 'ALL';
            const query = (app.views['dashboard'].searchQuery || '').toLowerCase();

            const projectData = projects.map(p => {
                const hours = hoursMap[p.id] || 0;
                const isHourly = p.billingType === 'hourly';
                const isFixed = p.billingType === 'fixed';
                const rate = (p.hourlyRate !== undefined && p.hourlyRate !== null && p.hourlyRate !== '' && !isNaN(Number(p.hourlyRate))) ? Number(p.hourlyRate) : Utils.DEFAULT_HOURLY_RATE;
                
                // For hourly projects, estimated value is hours * hourlyRate
                const hourlyVal = Math.round(hours * rate);
                const actualReceived = revMap[p.id] || 0;

                const displayAmount = isHourly ? hourlyVal : actualReceived;
                const displayAmountLabel = isHourly ? '預估產值' : '已入帳';
                const displayRate = isHourly ? rate : (hours > 0 && actualReceived > 0 ? Math.round(actualReceived / hours) : 0);
                const displayRateLabel = isHourly ? `$${rate}/h` : (displayRate > 0 ? `$${displayRate.toLocaleString()}/h` : '-');

                const budget = Number(p.revenue || 0);
                const category = p.category || 'commercial';
                const status = p.status || 'active';
                const catInfo = Utils.getCategoryInfo(category);
                const statusInfo = Utils.getStatusInfo(status);
                const billingInfo = Utils.getBillingTypeInfo(p.billingType);

                return {
                    project: p,
                    hours,
                    hourlyRate: rate,
                    displayAmount,
                    displayAmountLabel,
                    displayRate,
                    displayRateLabel,
                    isHourly,
                    budget,
                    category,
                    status,
                    catInfo,
                    statusInfo,
                    billingInfo
                };
            });

            // Unified 3-Way Filter (Multi-Select Status + Category Dropdown + Real-time Search)
            let filtered = projectData.filter(item => {
                const p = item.project;

                // 1. Multi-select Status Filter
                if (activeStatusSet.has('ALL')) {
                    if (item.status === 'closed') return false;
                } else {
                    if (!activeStatusSet.has(item.status)) return false;
                }

                // 2. Category Filter
                if (catFilter !== 'ALL' && item.category !== catFilter) return false;

                // 3. Search Filter
                if (query) {
                    const matchName = p.name.toLowerCase().includes(query);
                    const matchClient = (p.client || '').toLowerCase().includes(query);
                    if (!matchName && !matchClient) return false;
                }

                return true;
            });

            const countBadge = document.getElementById('dashboard-projects-count-badge');
            if (countBadge) {
                countBadge.innerText = `共 ${filtered.length} 個專案`;
            }

            // Sort by lifecycle priority and hours
            filtered.sort((a, b) => {
                const priority = { 'bidding': 1, 'active': 2, 'pending_payment': 3, 'paid': 4, 'closed': 5 };
                const pa = priority[a.status] || 2;
                const pb = priority[b.status] || 2;
                if (pa !== pb) return pa - pb;
                return b.hours - a.hours;
            });

            const renderCard = (item) => {
                const p = item.project;
                const isClosed = item.status === 'closed';
                const isDeleting = app.views['dashboard'].deletingId === p.id;
                const yearDisplay = p.year || (p.startDate ? p.startDate.split('-')[0] : '2026');

                let actionsHtml = '';
                if (isDeleting) {
                    actionsHtml = `
                         <button type="button" class="btn-cancel-delete" data-id="${p.id}" style="border: 1px solid var(--text-muted); background: var(--bg-primary); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; margin-right: 0.5rem; color: var(--text-primary);">取消</button>
                         <button type="button" class="btn-confirm-delete" data-id="${p.id}" style="border: none; background: var(--danger); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">確定刪除？</button>
                     `;
                } else {
                    actionsHtml = `
                          <button type="button" class="btn-edit" data-id="${p.id}" style="border:none; background:none; cursor:pointer; color: var(--text-secondary); padding: 4px;" title="編輯專案">${Icons.render('edit', { size: 15 })}</button>
                          <button type="button" class="btn-close-project" data-id="${p.id}" style="border:none; background:none; cursor:pointer; color: var(--text-secondary); padding: 4px;" title="${isClosed ? '重新開啟' : '結案/封存'}">${isClosed ? Icons.render('link', { size: 15 }) : Icons.render('check-circle', { size: 15 })}</button>
                          <button type="button" class="btn-delete" data-id="${p.id}" style="border:none; background:none; cursor:pointer; color: var(--text-muted); padding: 4px;" title="刪除專案">${Icons.render('trash', { size: 15 })}</button>
                     `;
                }

                return `
                 <div class="card project-card" style="position: relative; cursor: pointer; ${isClosed ? 'background: var(--bg-tertiary); opacity: 0.75;' : ''}" data-nav-id="${p.id}">
                     <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
                         <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
                             <span style="background: var(--bg-tertiary); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">${yearDisplay}</span>
                             <span class="project-client-badge">${Icons.render('building', { size: 12 })} ${p.client || '未指定客戶'}</span>
                         </div>
                         <div style="display: flex; gap: 0.4rem; align-items: center;">
                              <span style="font-size: 0.75rem; color: var(--text-muted);">${Utils.formatDate(p.startDate)}</span>
                              ${actionsHtml}
                         </div>
                     </div>

                     <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem; color: var(--text-primary);">
                         ${p.name}
                     </h3>

                     <div class="project-metric-grid" style="margin-bottom: 0.6rem;">
                         <div class="project-metric-item">
                             <span class="project-metric-label">投入工時</span>
                             <span class="project-metric-val">${item.hours.toFixed(1)} h</span>
                         </div>
                         <div class="project-metric-item">
                             <span class="project-metric-label">${item.displayAmountLabel}</span>
                             <span class="project-metric-val" style="color: ${item.displayAmount > 0 ? 'var(--success)' : 'var(--text-muted)'};">$${item.displayAmount.toLocaleString()}</span>
                         </div>
                         <div class="project-metric-item">
                             <span class="project-metric-label">實質時薪</span>
                             <span class="project-metric-val" style="color: ${item.displayRateLabel !== '-' ? 'var(--accent-primary)' : 'var(--text-muted)'};">${item.displayRateLabel}</span>
                         </div>
                     </div>

                     <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
                         <span style="background: ${item.catInfo.color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 600;">${item.catInfo.label}</span>
                         <span style="background: ${item.statusInfo.bg}; color: ${item.statusInfo.color}; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700;"><span class="status-indicator-dot" style="background-color: ${item.statusInfo.color};"></span>${item.statusInfo.label}</span>
                         <span style="background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 600;">${item.isHourly ? `計時 ($${item.hourlyRate}/h)` : '固定金額'}</span>
                         ${(p.types || []).map(t => `<span style="background: rgba(0, 102, 204, 0.08); color: var(--accent-primary); padding: 2px 6px; border-radius: 8px; font-size: 0.72rem;">${t}</span>`).join('')}
                     </div>
                 </div>
             `};

            if (filtered.length === 0) {
                list.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">此分類下尚無專案</div>';
            } else {
                list.innerHTML = filtered.map(item => renderCard(item)).join('');
            }

            // Render Chart if open
            const chartYearSelect = document.getElementById('annual-chart-year');
            const currentYear = chartYearSelect ? chartYearSelect.value : new Date().getFullYear().toString();
            app.views['dashboard'].renderAnnualChart(currentYear);

        } catch (err) {
            console.error('Error rendering projects:', err);
            list.innerHTML = '<p style="color: var(--danger)">載入失敗</p>';
        }
    },

    renderAnnualChart: async (year) => {
        const container = document.getElementById('annual-chart-container');
        if (!container) return;

        try {
            const projects = await db.getAll('projects');
            const entries = await db.getAll('entries');

            const projCategory = {};
            projects.forEach(p => projCategory[p.id] = p.category || 'commercial');

            const monthlyData = Array.from({length: 12}, () => ({ commercial: 0, bd: 0, pro_bono: 0, self_study: 0, total: 0 }));

            entries.forEach(e => {
                if (!e.date || !e.date.startsWith(year)) return;
                const parts = e.date.split('-');
                if (parts.length >= 2) {
                    const month = parseInt(parts[1], 10) - 1;
                    const cat = projCategory[e.projectId] || 'commercial';
                    const hours = Number(e.hours || 0);

                    if (month >= 0 && month <= 11) {
                        const standardCat = (cat === 'paid' ? 'commercial' : cat);
                        if (monthlyData[month][standardCat] !== undefined) {
                            monthlyData[month][standardCat] += hours;
                        } else {
                            monthlyData[month].commercial += hours;
                        }
                        monthlyData[month].total += hours;
                    }
                }
            });

            const maxTotal = Math.max(...monthlyData.map(m => m.total), 1);

            let html = '';
            monthlyData.forEach((m, idx) => {
                const commPct = (m.commercial / maxTotal) * 100;
                const bdPct = (m.bd / maxTotal) * 100;
                const bonoPct = (m.pro_bono / maxTotal) * 100;
                const studyPct = (m.self_study / maxTotal) * 100;

                html += `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative;">
                        <div style="width: 80%; display: flex; flex-direction: column; justify-content: flex-end; height: calc(100% - 24px); position: absolute; bottom: 24px;">
                            ${m.total > 0 ? `<div style="text-align: center; font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 2px;">${m.total.toFixed(1)}</div>` : ''}
                            ${m.self_study > 0 ? `<div style="width: 100%; height: ${studyPct}%; background: #7c3aed; transition: height 0.3s;" title="進修與創作: ${m.self_study.toFixed(1)}h"></div>` : ''}
                            ${m.pro_bono > 0 ? `<div style="width: 100%; height: ${bonoPct}%; background: #16a34a; transition: height 0.3s;" title="公益: ${m.pro_bono.toFixed(1)}h"></div>` : ''}
                            ${m.bd > 0 ? `<div style="width: 100%; height: ${bdPct}%; background: #d97706; transition: height 0.3s;" title="案源開拓: ${m.bd.toFixed(1)}h"></div>` : ''}
                            ${m.commercial > 0 ? `<div style="width: 100%; height: ${commPct}%; background: #2563eb; transition: height 0.3s;" title="合作委託: ${m.commercial.toFixed(1)}h"></div>` : ''}
                        </div>
                        <div style="position: absolute; bottom: 4px; font-size: 0.8rem; color: var(--text-muted);">${idx + 1}月</div>
                    </div>
                `;
            });

            container.innerHTML = html;
        } catch (e) {
            console.error('Error rendering annual chart:', e);
        }
    }
};
