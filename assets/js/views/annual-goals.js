app.views['annual-goals'] = {
    editingId: null,
    selectedOrgs: new Set(['ALL']),
    selectedProjectFilters: new Set(['ALL']),
    activeTab: 'clients',
    searchKeyword: '',
    allRevenue: [],
    currentYearRevenue: [],
    currentYearProjects: [],
    allProjects: [],
    allEntries: [],
    projectHoursMap: {},
    projectRevenuesMap: {},
    currentYearGoal: 0,
    channel: null,

    // Smart project name matching helper (Resolves to exactly ONE project in projectsList)
    matchProjectForRevenue: (revenueItem, projectsList) => {
        if (!revenueItem || !projectsList || projectsList.length === 0) return null;

        if (revenueItem.projectId !== undefined && revenueItem.projectId !== null && revenueItem.projectId !== '') {
            const pid = Number(revenueItem.projectId);
            const found = projectsList.find(p => p.id === pid);
            if (found) return found;
        }

        const item = (revenueItem.item || '').toLowerCase().trim();
        const org = (revenueItem.organization || '').toLowerCase().trim();
        if (!item && !org) return null;

        // 1. Sort projects by name length descending to prefer more specific matches
        const sortedProjects = [...projectsList].sort((a, b) => (b.name || '').length - (a.name || '').length);

        // 2. High-precision keyword matching in item description
        for (const p of sortedProjects) {
            const pname = (p.name || '').toLowerCase().trim();
            if (pname && pname.length >= 2 && item.includes(pname)) {
                return p;
            }
        }

        // 3. Fallback: Match by project client organization
        if (org) {
            const matchingClientProjects = projectsList.filter(p => {
                const pClient = (p.client || '').toLowerCase().trim();
                return pClient && (pClient === org || org.includes(pClient) || pClient.includes(org));
            });
            if (matchingClientProjects.length === 1) {
                return matchingClientProjects[0];
            }
        }

        return null;
    },

    init: async () => {
        console.log('Annual Goals View Loaded');

        // 1. Defaults & Year Select
        const currentYear = new Date().getFullYear();
        const yearSelect = document.getElementById('annual-goals-year-select');

        // Populate options if empty
        if (yearSelect && yearSelect.options.length === 0) {
            for (let y = currentYear - 2; y <= currentYear + 2; y++) {
                const opt = document.createElement('option');
                opt.value = y;
                opt.text = y;
                if (y === currentYear) opt.selected = true;
                yearSelect.appendChild(opt);
            }
        }

        let year = yearSelect ? yearSelect.value : currentYear.toString();

        // Bind Year Change
        if (yearSelect && !yearSelect.dataset.listening) {
            yearSelect.addEventListener('change', async (e) => {
                const newYear = e.target.value;
                app.views['annual-goals'].selectedOrgs = new Set(['ALL']);
                await app.views['annual-goals'].refreshAll(newYear);
            });
            yearSelect.dataset.listening = 'true';
        }

        // Bind Refresh Button
        const refreshBtn = document.getElementById('btn-refresh-goals');
        if (refreshBtn && !refreshBtn.dataset.listening) {
            refreshBtn.addEventListener('click', async () => {
                const currentVal = document.getElementById('annual-goals-year-select').value;
                refreshBtn.classList.add('rotating');
                await app.views['annual-goals'].refreshAll(currentVal);
                setTimeout(() => refreshBtn.classList.remove('rotating'), 500);
            });
            refreshBtn.dataset.listening = 'true';
        }

        // Set date input default to today
        const dateInput = document.getElementById('revenue-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // 2. Real-time Setup (BroadcastChannel)
        if (!app.views['annual-goals'].channel) {
            app.views['annual-goals'].channel = new BroadcastChannel('worktime_db_updates');
            app.views['annual-goals'].channel.onmessage = async (event) => {
                if (event.data && (event.data.store === 'manualRevenue' || event.data.store === 'annualGoals' || event.data.store === 'projects' || event.data.store === 'entries')) {
                    console.log(`Received DB update for ${event.data.store}, refreshing annual goals...`);
                    const currentVal = document.getElementById('annual-goals-year-select') ? document.getElementById('annual-goals-year-select').value : null;
                    if (currentVal) {
                        await app.views['annual-goals'].refreshAll(currentVal);
                    }
                }
            };
        }

        // 3. Bind Tabs
        const tabBtns = document.querySelectorAll('#annual-views-tab-bar .view-tab-btn');
        tabBtns.forEach(btn => {
            if (!btn.dataset.listening) {
                btn.addEventListener('click', () => {
                    const targetTab = btn.dataset.tab;
                    app.views['annual-goals'].switchTab(targetTab);
                });
                btn.dataset.listening = 'true';
            }
        });

        // 4. Bind Action-Driven Project Status Filter Chips (Multi-Select Supported)
        const pfilterBtns = document.querySelectorAll('#project-status-filter-chips .filter-chip');
        pfilterBtns.forEach(btn => {
            if (!btn.dataset.listening) {
                btn.addEventListener('click', () => {
                    if (!app.views['annual-goals'].selectedProjectFilters) {
                        app.views['annual-goals'].selectedProjectFilters = new Set(['ALL']);
                    }
                    const filters = app.views['annual-goals'].selectedProjectFilters;
                    const clickedFilter = btn.dataset.pfilter;

                    if (clickedFilter === 'ALL') {
                        filters.clear();
                        filters.add('ALL');
                    } else {
                        filters.delete('ALL');
                        if (filters.has(clickedFilter)) {
                            filters.delete(clickedFilter);
                        } else {
                            filters.add(clickedFilter);
                        }
                        if (filters.size === 0) {
                            filters.add('ALL');
                        }
                    }

                    pfilterBtns.forEach(b => {
                        b.classList.toggle('active', filters.has(b.dataset.pfilter));
                    });

                    app.views['annual-goals'].renderProjectBalanceCards();
                });
                btn.dataset.listening = 'true';
            }
        });

        // 5. Bind Search Input
        const searchInput = document.getElementById('cashflow-search-input');
        if (searchInput && !searchInput.dataset.listening) {
            searchInput.addEventListener('input', (e) => {
                app.views['annual-goals'].searchKeyword = e.target.value.trim();
                app.views['annual-goals'].renderCashFlowDetails();
            });
            searchInput.dataset.listening = 'true';
        }

        // 6. Bind Revenue Project Select dropdown change (Auto fill Org / Item)
        const projSelect = document.getElementById('revenue-project-select');
        if (projSelect && !projSelect.dataset.listening) {
            projSelect.addEventListener('change', (e) => {
                const pid = Number(e.target.value);
                if (pid) {
                    const p = app.views['annual-goals'].allProjects.find(item => item.id === pid);
                    if (p) {
                        const orgInput = document.getElementById('revenue-org');
                        if (p.client && !orgInput.value) {
                            orgInput.value = p.client;
                        }

                        const itemInput = document.getElementById('revenue-item');
                        if (!itemInput.value) {
                            itemInput.value = `${p.name} 款項`;
                        }
                    }
                }
            });
            projSelect.dataset.listening = 'true';
        }

        // 7. Bind Quick Payment Stage Pills
        const stagePills = document.querySelectorAll('#revenue-stage-pills .btn-stage-pill');
        stagePills.forEach(pill => {
            if (!pill.dataset.listening) {
                pill.addEventListener('click', () => {
                    const stage = pill.dataset.stage;
                    const itemInput = document.getElementById('revenue-item');
                    const projSelect = document.getElementById('revenue-project-select');
                    const pid = projSelect ? Number(projSelect.value) : null;
                    const p = pid ? app.views['annual-goals'].allProjects.find(item => item.id === pid) : null;

                    if (p) {
                        itemInput.value = `${p.name} ${stage}`;
                    } else if (itemInput.value && !itemInput.value.includes(stage)) {
                        itemInput.value = `${itemInput.value} ${stage}`;
                    } else {
                        itemInput.value = stage;
                    }
                    itemInput.focus();
                });
                pill.dataset.listening = 'true';
            }
        });

        // 8. Bind Goal Form
        const goalForm = document.getElementById('annual-goal-form');
        if (goalForm && !goalForm.dataset.listening) {
            goalForm.onsubmit = (e) => {
                e.preventDefault();
                const selectedYear = document.getElementById('annual-goals-year-select').value;
                app.views['annual-goals'].saveGoal(selectedYear);
            };
            goalForm.dataset.listening = 'true';
        }

        // 9. Bind Revenue Form
        const revenueForm = document.getElementById('manual-revenue-form');
        if (revenueForm && !revenueForm.dataset.listening) {
            revenueForm.onsubmit = (e) => {
                const selectedYear = document.getElementById('annual-goals-year-select').value;
                app.views['annual-goals'].handleRevenueSubmit(e, selectedYear);
            };
            revenueForm.dataset.listening = 'true';
        }

        // 9.1 Bind Revenue Mode Toggles & Salary Split Form
        const btnSingle = document.getElementById('btn-revenue-mode-single');
        const btnSplit = document.getElementById('btn-revenue-mode-split');
        if (btnSingle && !btnSingle.dataset.listening) {
            btnSingle.addEventListener('click', () => app.views['annual-goals'].setRevenueMode('single'));
            btnSingle.dataset.listening = 'true';
        }
        if (btnSplit && !btnSplit.dataset.listening) {
            btnSplit.addEventListener('click', () => app.views['annual-goals'].setRevenueMode('split'));
            btnSplit.dataset.listening = 'true';
        }

        const splitForm = document.getElementById('salary-split-form');
        if (splitForm && !splitForm.dataset.listening) {
            splitForm.onsubmit = (e) => {
                const selectedYear = document.getElementById('annual-goals-year-select').value;
                app.views['annual-goals'].handleSalarySplitSubmit(e, selectedYear);
            };
            splitForm.dataset.listening = 'true';
        }

        ['split-client-select', 'split-month-select', 'split-total-amount'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.listening) {
                el.addEventListener('input', () => app.views['annual-goals'].updateSalarySplitPreview());
                el.addEventListener('change', () => app.views['annual-goals'].updateSalarySplitPreview());
                el.dataset.listening = 'true';
            }
        });

        // 10. Bind Cancel Button
        const cancelBtn = document.getElementById('cancel-revenue-edit');
        if (cancelBtn && !cancelBtn.dataset.listening) {
            cancelBtn.addEventListener('click', () => {
                app.views['annual-goals'].resetRevenueForm();
            });
            cancelBtn.dataset.listening = 'true';
        }

        // 11. Initial Load
        await app.views['annual-goals'].refreshAll(year);
    },

    switchTab: (tabId) => {
        app.views['annual-goals'].activeTab = tabId;

        document.querySelectorAll('#annual-views-tab-bar .view-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const clientsSec = document.getElementById('tab-clients-section');
        const projectsSec = document.getElementById('tab-projects-section');
        const streamSec = document.getElementById('tab-stream-section');

        if (clientsSec) clientsSec.style.display = tabId === 'clients' ? 'block' : 'none';
        if (projectsSec) projectsSec.style.display = tabId === 'projects' ? 'block' : 'none';
        if (streamSec) streamSec.style.display = tabId === 'stream' ? 'block' : 'none';
    },

    refreshAll: async (year) => {
        try {
            // 1. Load Goal
            await app.views['annual-goals'].loadGoal(year);

            // 2. Load all projects from DB
            app.views['annual-goals'].allProjects = await db.getAll('projects');
            app.views['annual-goals'].currentYearProjects = app.views['annual-goals'].allProjects
                .filter(p => String(p.year) === String(year) || !p.year);

            // 3. Load all time entries to calculate project hours
            app.views['annual-goals'].allEntries = await db.getAll('entries');
            app.views['annual-goals'].projectHoursMap = {};
            app.views['annual-goals'].allEntries.forEach(e => {
                const pid = Number(e.projectId);
                if (pid) {
                    app.views['annual-goals'].projectHoursMap[pid] = (app.views['annual-goals'].projectHoursMap[pid] || 0) + Number(e.hours || 0);
                }
            });

            // 4. Load all manual revenue from DB
            app.views['annual-goals'].allRevenue = await db.getAll('manualRevenue');

            // 5. Build STRICT, 1-TO-1 projectRevenuesMap
            app.views['annual-goals'].projectRevenuesMap = {};
            app.views['annual-goals'].allProjects.forEach(p => {
                app.views['annual-goals'].projectRevenuesMap[p.id] = [];
            });

            app.views['annual-goals'].allRevenue.forEach(r => {
                let targetPid = null;
                if (r.projectId !== undefined && r.projectId !== null && r.projectId !== '') {
                    targetPid = Number(r.projectId);
                } else {
                    const matched = app.views['annual-goals'].matchProjectForRevenue(r, app.views['annual-goals'].allProjects);
                    if (matched) {
                        targetPid = matched.id;
                    }
                }

                if (targetPid && app.views['annual-goals'].projectRevenuesMap[targetPid]) {
                    app.views['annual-goals'].projectRevenuesMap[targetPid].push(r);
                }
            });

            // Filter current year records
            app.views['annual-goals'].currentYearRevenue = app.views['annual-goals'].allRevenue
                .filter(r => String(r.year) === String(year) || (r.date && r.date.startsWith(String(year))));

            const totalRevenue = app.views['annual-goals'].currentYearRevenue
                .reduce((sum, r) => sum + Number(r.amount || 0), 0);

            // 6. Update KPI & Progress summary
            app.views['annual-goals'].updateProgressUI(year, app.views['annual-goals'].currentYearGoal, totalRevenue);

            // 7. Populate Project Dropdown & Organization suggestions datalist
            app.views['annual-goals'].populateProjectDropdown();
            app.views['annual-goals'].populateOrgDatalist(app.views['annual-goals'].allRevenue);
            app.views['annual-goals'].populateSplitClientsDropdown();

            // 8. Render Major Clients Visualizations (Tab 1)
            app.views['annual-goals'].renderOrgVisualizations(year, app.views['annual-goals'].currentYearRevenue, totalRevenue, app.views['annual-goals'].currentYearGoal);

            // 9. Render Project Balance, Hours & Final Payment Cards (Tab 2)
            app.views['annual-goals'].renderProjectBalanceCards();

            // 10. Render Filter Chips & Cash Flow Stream (Tab 3)
            app.views['annual-goals'].renderFilterChips(app.views['annual-goals'].currentYearRevenue);
            app.views['annual-goals'].renderCashFlowDetails();

            // 11. Reset Revenue Form if not actively editing
            if (!app.views['annual-goals'].editingId) {
                app.views['annual-goals'].resetRevenueForm();
            }
        } catch (e) {
            console.error("Error refreshing annual goals view:", e);
        }
    },

    loadGoal: async (year) => {
        try {
            const allGoals = await db.getAll('annualGoals');
            const goalData = allGoals.find(g => String(g.year) === String(year));
            const amount = goalData ? Number(goalData.amount) : 0;
            app.views['annual-goals'].currentYearGoal = amount;

            const goalInput = document.getElementById('annual-goal-input');
            if (goalInput) {
                goalInput.value = amount > 0 ? amount : '';
            }
        } catch (e) {
            console.error("Error loading goal:", e);
            app.views['annual-goals'].currentYearGoal = 0;
        }
    },

    saveGoal: async (year) => {
        const input = document.getElementById('annual-goal-input');
        const saveBtn = document.getElementById('save-goal-btn');
        const amount = Number(input.value);

        if (isNaN(amount) || amount < 0) {
            alert('請輸入有效的目標金額');
            return;
        }

        try {
            await db.put('annualGoals', { year: String(year), amount: amount });
            app.views['annual-goals'].currentYearGoal = amount;

            const originalText = saveBtn.innerText;
            saveBtn.innerText = '✓ 已儲存';
            saveBtn.style.backgroundColor = 'var(--success)';
            setTimeout(() => {
                saveBtn.innerText = originalText;
                saveBtn.style.backgroundColor = '';
            }, 1200);

            const totalRevenue = app.views['annual-goals'].currentYearRevenue
                .reduce((sum, r) => sum + Number(r.amount || 0), 0);
            app.views['annual-goals'].updateProgressUI(year, amount, totalRevenue);
            app.views['annual-goals'].renderOrgVisualizations(year, app.views['annual-goals'].currentYearRevenue, totalRevenue, amount);
        } catch (e) {
            console.error("Error saving goal:", e);
            alert("儲存失敗");
        }
    },

    updateProgressUI: (year, goalAmount, totalRevenue) => {
        const gap = Math.max(0, goalAmount - totalRevenue);

        let percent = 0;
        if (goalAmount > 0) {
            percent = Math.round((totalRevenue / goalAmount) * 100);
        } else if (totalRevenue > 0) {
            percent = 100;
        }

        // 1. Goal Progress Container UI
        const goalTotalEl = document.getElementById('goal-total');
        if (goalTotalEl) goalTotalEl.innerText = `$${goalAmount.toLocaleString()}`;

        const currentTotalEl = document.getElementById('current-total');
        if (currentTotalEl) currentTotalEl.innerText = `$${totalRevenue.toLocaleString()}`;

        const goalGapEl = document.getElementById('goal-gap');
        if (goalGapEl) {
            if (gap === 0 && goalAmount > 0) {
                goalGapEl.innerHTML = `<span style="color: var(--success);">已達標！🎉</span>`;
            } else {
                goalGapEl.innerText = `$${gap.toLocaleString()}`;
            }
        }

        const progressPercentEl = document.getElementById('progress-percentage');
        if (progressPercentEl) progressPercentEl.innerText = `${percent}%`;

        const progressBarEl = document.getElementById('goal-progress-bar');
        if (progressBarEl) progressBarEl.style.width = `${Math.min(100, percent)}%`;

        // 2. Top KPI Cards UI
        const kpiGoalEl = document.getElementById('kpi-goal-amount');
        if (kpiGoalEl) kpiGoalEl.innerText = `$${goalAmount.toLocaleString()}`;

        const kpiGoalGapSub = document.getElementById('kpi-goal-gap-sub');
        if (kpiGoalGapSub) {
            kpiGoalGapSub.innerText = gap > 0 ? `尚差 $${gap.toLocaleString()}` : (goalAmount > 0 ? '已達標' : '未設定目標');
        }

        const kpiTotalEl = document.getElementById('kpi-total-revenue');
        if (kpiTotalEl) kpiTotalEl.innerText = `$${totalRevenue.toLocaleString()}`;

        const kpiProgressSub = document.getElementById('kpi-progress-sub');
        if (kpiProgressSub) {
            kpiProgressSub.innerText = goalAmount > 0 ? `達成率 ${percent}%` : `已累計 $${totalRevenue.toLocaleString()}`;
        }

        // Group by org to compute Top Client
        const orgMap = {};
        app.views['annual-goals'].currentYearRevenue.forEach(r => {
            const org = (r.organization || '未分類').trim();
            if (!orgMap[org]) orgMap[org] = { name: org, total: 0, count: 0 };
            orgMap[org].total += Number(r.amount || 0);
            orgMap[org].count += 1;
        });

        const orgList = Object.values(orgMap).sort((a, b) => b.total - a.total);

        const kpiTopOrgNameEl = document.getElementById('kpi-top-org-name');
        const kpiTopOrgAmountEl = document.getElementById('kpi-top-org-amount');
        if (orgList.length > 0) {
            if (kpiTopOrgNameEl) {
                kpiTopOrgNameEl.innerText = orgList[0].name;
                kpiTopOrgNameEl.title = orgList[0].name;
            }
            if (kpiTopOrgAmountEl) {
                const topShare = totalRevenue > 0 ? Math.round((orgList[0].total / totalRevenue) * 100) : 0;
                kpiTopOrgAmountEl.innerText = `$${orgList[0].total.toLocaleString()} (佔 ${topShare}%)`;
            }
        } else {
            if (kpiTopOrgNameEl) kpiTopOrgNameEl.innerText = '尚無紀錄';
            if (kpiTopOrgAmountEl) kpiTopOrgAmountEl.innerText = '$0';
        }

        // Calculate Lifetime Project Balance & Settled Count
        let settledCount = 0;
        let totalUnpaidBalance = 0;

        app.views['annual-goals'].allProjects.forEach(p => {
            const budget = Number(p.revenue || 0);
            const pRevenues = app.views['annual-goals'].projectRevenuesMap[p.id] || [];
            const pRevenue = pRevenues.reduce((s, r) => s + Number(r.amount || 0), 0);

            if (budget > 0) {
                if (pRevenue >= budget) {
                    settledCount += 1;
                } else {
                    totalUnpaidBalance += (budget - pRevenue);
                }
            }
        });

        const kpiSettledEl = document.getElementById('kpi-project-settled-count');
        if (kpiSettledEl) {
            kpiSettledEl.innerHTML = `${settledCount} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-secondary);">個已結清</span>`;
        }

        const kpiUnpaidSub = document.getElementById('kpi-project-unpaid-sub');
        if (kpiUnpaidSub) {
            kpiUnpaidSub.innerText = `尚欠尾款 $${totalUnpaidBalance.toLocaleString()}`;
        }

        // 3. Calculate Capacity & Proposal Strategy
        const commercialProjects = app.views['annual-goals'].allProjects.filter(p => p.category === 'commercial');
        const commercialProjIds = new Set(commercialProjects.map(p => p.id));

        const commercialRevenue = app.views['annual-goals'].allRevenue
            .filter(r => commercialProjIds.has(Number(r.projectId)))
            .reduce((sum, r) => sum + Number(r.amount || 0), 0);

        const commercialHours = app.views['annual-goals'].allEntries
            .filter(e => commercialProjIds.has(Number(e.projectId)))
            .reduce((sum, e) => sum + Number(e.hours || 0), 0);

        const allHoursTotal = app.views['annual-goals'].allEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
        const avgCommercialRate = commercialHours > 0 && commercialRevenue > 0
            ? Math.round(commercialRevenue / commercialHours)
            : (totalRevenue > 0 && allHoursTotal > 0 ? Math.round(totalRevenue / allHoursTotal) : 1000);

        const strategyEl = document.getElementById('capacity-strategy-content');
        if (strategyEl) {
            if (goalAmount > 0) {
                const requiredTotalHours = Math.round(goalAmount / avgCommercialRate);
                const remainingHours = Math.round(gap / avgCommercialRate);
                const weeklyHours = (requiredTotalHours / 50).toFixed(1);

                strategyEl.innerHTML = `
                    • 平均商業實質時薪：<strong style="color: var(--accent-primary);">$${avgCommercialRate.toLocaleString()}/h</strong><br>
                    • 達標需投入商業工時：<strong>${requiredTotalHours} 小時</strong>（全年平均每週約 <strong>${weeklyHours} 小時</strong>）<br>
                    • 目前目標尚差 <strong>$${gap.toLocaleString()}</strong>（約需再交付 <strong>${remainingHours} 小時</strong> 商業委託工時）<br>
                    <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 4px;">📌 <strong>策略提示</strong>：每週維持約 ${weeklyHours}h 的商業專案交付，其餘時間可完整保留給案源開拓、公益陪伴與寫作進修！</span>
                `;
            } else {
                strategyEl.innerHTML = `
                    目前平均商業實質時薪為 <strong style="color: var(--accent-primary);">$${avgCommercialRate.toLocaleString()}/h</strong>。請設定年度目標金額以取得精準的工時產能與每週時數換算！
                `;
            }
        }
    },

    populateProjectDropdown: () => {
        const select = document.getElementById('revenue-project-select');
        if (!select) return;

        const currentVal = select.value;
        const projects = app.views['annual-goals'].allProjects || [];

        select.innerHTML = Utils.buildStandardProjectOptions(projects, {
            showClosed: true,
            placeholder: '(無關聯專案 / 客戶月薪與一般收入)'
        });

        if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
            select.value = currentVal;
        }

        if (window.CustomSelect) {
            CustomSelect.enhance(select);
        }
    },

    populateOrgDatalist: (allRevenue) => {
        const datalist = document.getElementById('org-suggestions');
        const masterDatalist = document.getElementById('clients-master-datalist');

        const uniqueOrgs = Utils.extractUniqueClients(app.views['annual-goals'].allProjects, allRevenue);

        const optionsHtml = uniqueOrgs.map(org => `<option value="${Utils.escapeHtml(org)}">`).join('');
        if (datalist) datalist.innerHTML = optionsHtml;
        if (masterDatalist) masterDatalist.innerHTML = optionsHtml;
    },

    // Tab 1: Major Clients Ranking Visualization
    renderOrgVisualizations: (year, revenueList, totalRevenue, goalAmount) => {
        const container = document.getElementById('org-ranking-chart');
        const badgeEl = document.getElementById('org-rank-summary-badge');
        if (!container) return;

        if (revenueList.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏢</div>
                    <p style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${year} 年度尚無發款單位收入紀錄</p>
                    <p style="font-size: 0.85rem;">可使用上方表單登記第一筆收入</p>
                </div>
            `;
            if (badgeEl) badgeEl.innerText = '共 0 個發款單位';
            return;
        }

        const orgMap = {};
        revenueList.forEach(r => {
            const org = (r.organization || '未分類').trim();
            if (!orgMap[org]) {
                orgMap[org] = {
                    name: org,
                    total: 0,
                    count: 0,
                    lastDate: r.date || '',
                    items: [],
                    projects: new Set()
                };
            }
            orgMap[org].total += Number(r.amount || 0);
            orgMap[org].count += 1;
            if (r.item) orgMap[org].items.push(r.item);
            if (r.date && (!orgMap[org].lastDate || r.date > orgMap[org].lastDate)) {
                orgMap[org].lastDate = r.date;
            }

            const matchedP = app.views['annual-goals'].matchProjectForRevenue(r, app.views['annual-goals'].allProjects);
            if (matchedP) {
                orgMap[org].projects.add(matchedP.name);
            }
        });

        const orgList = Object.values(orgMap).sort((a, b) => b.total - a.total);
        const maxOrgTotal = orgList[0].total || 1;

        if (badgeEl) {
            badgeEl.innerText = `共 ${orgList.length} 個主要客戶 · 總計 $${totalRevenue.toLocaleString()}`;
        }

        const html = `
            <div class="org-rank-list">
                ${orgList.map((org, index) => {
                    const rank = index + 1;
                    const rankClass = rank === 1 ? 'top-1' : (rank === 2 ? 'top-2' : (rank === 3 ? 'top-3' : ''));
                    const rankIcon = rank === 1 ? '🥇 主要第一大客戶' : (rank === 2 ? '🥈 第二大客戶' : (rank === 3 ? '🥉 第三大客戶' : `#${rank}`));
                    const shareOfTotal = totalRevenue > 0 ? ((org.total / totalRevenue) * 100).toFixed(1) : '0.0';
                    const shareOfGoal = goalAmount > 0 ? ((org.total / goalAmount) * 100).toFixed(1) : null;
                    const barWidth = Math.max(4, Math.round((org.total / maxOrgTotal) * 100));
                    const selectedSet = app.views['annual-goals'].selectedOrgs || new Set(['ALL']);
                    const isActive = selectedSet.has(org.name);
                    const projectNames = Array.from(org.projects);

                    return `
                        <div class="org-rank-card ${isActive ? 'active' : ''}" data-org="${org.name}">
                            <div class="org-rank-header">
                                <div class="org-rank-name-wrap">
                                    <span class="rank-badge ${rankClass}" style="width: auto; padding: 2px 8px; border-radius: 12px;">${rankIcon}</span>
                                    <span class="org-rank-name" title="${org.name}" style="font-size: 1.1rem; font-weight: 700;">${org.name}</span>
                                    ${isActive ? '<span style="font-size: 0.75rem; background: var(--accent-primary); color: #fff; padding: 2px 6px; border-radius: 4px;">檢視中</span>' : ''}
                                </div>
                                <div class="org-rank-amount" style="font-size: 1.15rem; color: var(--accent-primary);">
                                    $${org.total.toLocaleString()}
                                </div>
                            </div>
                            <div class="org-bar-track">
                                <div class="org-bar-fill" style="width: ${barWidth}%;"></div>
                            </div>
                            <div class="org-rank-meta" style="margin-top: 0.5rem;">
                                <span>共 <strong>${org.count}</strong> 筆收款 · 佔總營收 <strong>${shareOfTotal}%</strong>${shareOfGoal ? ` · 貢獻目標 ${shareOfGoal}%` : ''}</span>
                                <span>最後收款: ${org.lastDate || '-'}</span>
                            </div>
                            ${projectNames.length > 0 ? `
                                <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed rgba(0,0,0,0.06);">
                                    <span style="font-size: 0.75rem; color: var(--text-muted);">關聯專案:</span>
                                    ${projectNames.map(p => `<span class="cashflow-project-tag" style="margin: 0;">📁 ${p}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = html;

        container.querySelectorAll('.org-rank-card').forEach(card => {
            card.addEventListener('click', () => {
                const orgName = card.dataset.org;
                app.views['annual-goals'].toggleOrg(orgName);
                app.views['annual-goals'].switchTab('stream');
            });
        });
    },

    // Tab 2: Action-Driven Project Balance & Status Prioritization
    renderProjectBalanceCards: () => {
        const container = document.getElementById('project-balance-cards-container');
        if (!container) return;

        const allProjects = app.views['annual-goals'].allProjects;
        const projectRevenuesMap = app.views['annual-goals'].projectRevenuesMap || {};
        const hoursMap = app.views['annual-goals'].projectHoursMap || {};
        const selectedYear = document.getElementById('annual-goals-year-select') ? document.getElementById('annual-goals-year-select').value : '';

        if (allProjects.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 2rem 0; grid-column: 1 / -1;">
                    尚無專案資料，請先至「專案儀表板」建立專案。
                </div>
            `;
            return;
        }

        const projectData = allProjects.map(p => {
            const budget = Number(p.revenue || 0);
            const hours = hoursMap[p.id] || 0;
            const category = p.category || 'commercial';
            const catInfo = Utils.getCategoryInfo(category);

            // Get strictly assigned revenues for this project
            const matchedRevenues = [...(projectRevenuesMap[p.id] || [])];
            matchedRevenues.sort((a, b) => new Date(a.date) - new Date(b.date));

            const lifetimeReceived = matchedRevenues.reduce((sum, r) => sum + Number(r.amount || 0), 0);
            const thisYearReceived = matchedRevenues
                .filter(r => String(r.year) === String(selectedYear) || (r.date && r.date.startsWith(String(selectedYear))))
                .reduce((sum, r) => sum + Number(r.amount || 0), 0);

            const unpaid = Math.max(0, budget - lifetimeReceived);
            const progress = budget > 0 ? Math.min(100, Math.round((lifetimeReceived / budget) * 100)) : (lifetimeReceived > 0 ? 100 : 0);
            const hourlyRate = hours > 0 && lifetimeReceived > 0 ? Math.round(lifetimeReceived / hours) : 0;

            const revenueYears = Array.from(new Set(matchedRevenues.map(r => r.date ? r.date.slice(0, 4) : r.year).filter(Boolean))).sort();
            const isMultiYear = revenueYears.length > 1;

            // Compute dynamic Action Status
            let actionStatus = 'ACTIVE';
            let statusBadge = '';
            let statusClass = 'unpaid';
            let priorityRank = 3; // 1 = Pending Payment, 2 = Active Commercial, 3 = BD/Study, 4 = Paid/Closed

            if (p.status === 'closed') {
                actionStatus = 'CLOSED';
                statusBadge = '📁 已結案';
                statusClass = 'unpaid';
                priorityRank = 5;
            } else if (category === 'pro_bono' || category === 'self_study') {
                actionStatus = 'PRO_BONO_STUDY';
                statusBadge = category === 'pro_bono' ? '🌱 公益專案' : '💡 進修與創作';
                statusClass = 'pro-bono-badge';
                priorityRank = 4;
            } else if (category === 'bd') {
                actionStatus = 'BD';
                statusBadge = p.status === 'bidding' ? '💡 提案申請中' : '🎯 案源開拓';
                statusClass = 'pending-balance';
                priorityRank = 3;
            } else if (budget > 0 && unpaid > 0) {
                actionStatus = 'PENDING';
                statusBadge = `🚨 尚欠尾款 $${unpaid.toLocaleString()}`;
                statusClass = 'pending-balance';
                priorityRank = 1;
            } else if (budget === 0 && lifetimeReceived === 0 && hours > 0) {
                actionStatus = 'PENDING';
                statusBadge = '⏳ 待請款 / 尚未入帳';
                statusClass = 'pending-balance';
                priorityRank = 1;
            } else if (budget > 0 && lifetimeReceived >= budget) {
                actionStatus = 'PAID';
                statusBadge = '✅ 尾款已收齊';
                statusClass = 'paid-full';
                priorityRank = 4;
            } else {
                actionStatus = 'ACTIVE';
                statusBadge = lifetimeReceived > 0 ? `🟢 執行中 (已收 $${lifetimeReceived.toLocaleString()})` : '🟢 執行中';
                statusClass = 'paid-full';
                priorityRank = 2;
            }

            const client = p.client || (matchedRevenues.length > 0 ? matchedRevenues[0].organization : '未指定客戶');

            return {
                project: p,
                budget,
                hours,
                hourlyRate,
                lifetimeReceived,
                thisYearReceived,
                unpaid,
                progress,
                category,
                catInfo,
                actionStatus,
                statusBadge,
                statusClass,
                priorityRank,
                client,
                revenueYears,
                isMultiYear,
                revenues: matchedRevenues
            };
        });

        // Filter projects by active multi-select filters
        const activeFilters = app.views['annual-goals'].selectedProjectFilters || new Set(['ALL']);
        const filtered = projectData.filter(item => {
            if (activeFilters.has('ALL')) return true;
            if (activeFilters.has('PENDING') && item.actionStatus === 'PENDING') return true;
            if (activeFilters.has('ACTIVE') && item.actionStatus === 'ACTIVE') return true;
            if (activeFilters.has('BD') && item.actionStatus === 'BD') return true;
            if (activeFilters.has('PRO_BONO_STUDY') && item.actionStatus === 'PRO_BONO_STUDY') return true;
            if (activeFilters.has('CLOSED') && (item.actionStatus === 'CLOSED' || item.actionStatus === 'PAID')) return true;
            return false;
        });

        // Action-Driven Sorting: Priority 1 (Pending) -> Priority 2 (Active) -> Priority 3 (BD) -> Priority 4 (Study) -> Priority 5 (Closed)
        filtered.sort((a, b) => {
            if (a.priorityRank !== b.priorityRank) {
                return a.priorityRank - b.priorityRank;
            }
            return b.hours - a.hours;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 2rem 0; grid-column: 1 / -1;">
                    無符合此篩選條件的專案
                </div>
            `;
            return;
        }

        const html = filtered.map(item => `
            <div class="project-balance-card" style="${item.actionStatus === 'PENDING' ? 'border-left: 4px solid #ea580c;' : ''}">
                <div>
                    <div class="project-balance-header">
                        <div>
                            <div class="project-balance-name">${item.project.name}</div>
                            <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; margin-top: 2px;">
                                <span class="project-client-badge">🏢 ${item.client}</span>
                                <span style="font-size: 0.75rem; background: rgba(0,0,0,0.05); color: ${item.catInfo.color}; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${item.catInfo.icon} ${item.catInfo.label}</span>
                                ${item.isMultiYear ? `<span class="cashflow-project-tag" style="background: #e0e7ff; color: #3730a3; margin: 0;">📅 跨年度 (${item.revenueYears.join('-')})</span>` : ''}
                            </div>
                        </div>
                        <span class="payment-status-badge ${item.statusClass}">${item.statusBadge}</span>
                    </div>

                    <!-- 3-Column Metric Box: Hours, Lifetime Received, Hourly Rate -->
                    <div class="project-metric-grid">
                        <div class="project-metric-item">
                            <span class="project-metric-label">⏱️ 累積工時</span>
                            <span class="project-metric-val">${item.hours.toFixed(1)} h</span>
                        </div>
                        <div class="project-metric-item">
                            <span class="project-metric-label">${item.actionStatus === 'PRO_BONO_STUDY' ? '🌱 專案收入' : '💵 專案總入帳'}</span>
                            <span class="project-metric-val" style="color: ${item.lifetimeReceived > 0 ? 'var(--success)' : 'var(--text-muted)'};">$${item.lifetimeReceived.toLocaleString()}</span>
                        </div>
                        <div class="project-metric-item">
                            <span class="project-metric-label">⚡ 實質時薪</span>
                            <span class="project-metric-val" style="color: ${item.hourlyRate > 0 ? 'var(--accent-primary)' : 'var(--text-muted)'};">${item.hourlyRate > 0 ? `$${item.hourlyRate.toLocaleString()}/h` : '-'}</span>
                        </div>
                    </div>

                    ${item.actionStatus === 'PRO_BONO_STUDY' ? `
                        <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.75rem; background: var(--bg-primary); padding: 6px 10px; border-radius: 4px;">
                            ${item.catInfo.icon} 純工時投入，無合約款項或尾款追蹤
                        </div>
                    ` : (item.budget > 0 ? `
                        <div class="project-balance-numbers">
                            <div>
                                <span style="color: var(--text-secondary); font-size: 0.8rem;">總入帳進度: </span>
                                <strong style="color: var(--success); font-size: 0.95rem;">${item.progress}%</strong>
                            </div>
                            <div>
                                <span style="color: var(--text-secondary); font-size: 0.8rem;">合約總額: </span>
                                <strong style="color: var(--text-primary); font-size: 0.95rem;">$${item.budget.toLocaleString()}</strong>
                            </div>
                        </div>

                        <div class="project-balance-progress-track">
                            <div class="project-balance-progress-fill ${item.statusClass}" style="width: ${item.progress}%;"></div>
                        </div>

                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem; flex-wrap: wrap;">
                            <span>${item.unpaid > 0 ? `尚欠尾款: <strong style="color: #ea580c;">$${item.unpaid.toLocaleString()}</strong>` : '✅ 全額已收齊結清'}</span>
                            <span>${item.isMultiYear ? `今年度實收: $${item.thisYearReceived.toLocaleString()}` : (item.project.status === 'closed' ? '📁 專案已結案' : '🟢 進行中')}</span>
                        </div>
                    ` : `
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                            ${item.lifetimeReceived > 0 ? `全期累計已入帳 $${item.lifetimeReceived.toLocaleString()}${item.isMultiYear ? ` (今年實收 $${item.thisYearReceived.toLocaleString()})` : ''}` : '尚未登記合約金額或入帳'}
                        </div>
                    `)}
                </div>

                <div>
                    ${item.revenues.length > 0 ? `
                        <button type="button" class="project-balance-tx-toggle btn-toggle-tx" data-pid="${item.project.id}">
                            <span>📄 查看全期收款紀錄 (${item.revenues.length} 筆${item.isMultiYear ? ` · 跨 ${item.revenueYears.join('與')} 年` : ''})</span>
                            <span>▾</span>
                        </button>
                        <div class="project-balance-tx-list" id="project-tx-list-${item.project.id}" style="display: none;">
                            ${item.revenues.map(r => `
                                <div class="project-tx-item">
                                    <span>📅 <strong>${r.date}</strong> · ${r.item || '款項'}</span>
                                    <strong style="color: var(--success);">+$${Number(r.amount).toLocaleString()}</strong>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">尚未有入帳明細紀錄</div>
                    `}

                    <button type="button" class="btn btn-secondary btn-quick-add-project-revenue" style="width: 100%; margin-top: 0.75rem; padding: 6px 12px; font-size: 0.85rem;" data-pid="${item.project.id}" data-pname="${item.project.name}" data-client="${item.client}">
                        ➕ 登記此專案入帳 / 尾款
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;

        // Bind toggle transactions list
        container.querySelectorAll('.btn-toggle-tx').forEach(btn => {
            btn.onclick = () => {
                const pid = btn.dataset.pid;
                const txList = document.getElementById(`project-tx-list-${pid}`);
                if (txList) {
                    const isShown = txList.style.display === 'flex';
                    txList.style.display = isShown ? 'none' : 'flex';
                    btn.querySelector('span:last-child').innerText = isShown ? '▾' : '▴';
                }
            };
        });

        // Bind Quick Add Revenue for project
        container.querySelectorAll('.btn-quick-add-project-revenue').forEach(btn => {
            btn.onclick = () => {
                const pid = btn.dataset.pid;
                const pname = btn.dataset.pname;
                const client = btn.dataset.client;

                const projSelect = document.getElementById('revenue-project-select');
                if (projSelect) projSelect.value = pid;

                const orgInput = document.getElementById('revenue-org');
                if (orgInput && client && client !== '未指定客戶') orgInput.value = client;

                const itemInput = document.getElementById('revenue-item');
                if (itemInput) itemInput.value = `${pname} 款項`;

                const form = document.getElementById('manual-revenue-form');
                if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.getElementById('revenue-amount').focus();
            };
        });
    },

    // Tab 3: Detailed Cash Flow Stream & Filter Chips (Multi-Select Supported)
    renderFilterChips: (revenueList) => {
        const container = document.getElementById('org-filter-chips');
        if (!container) return;

        if (revenueList.length === 0) {
            container.innerHTML = '';
            return;
        }

        const orgMap = {};
        revenueList.forEach(r => {
            const org = (r.organization || '未分類').trim();
            if (!orgMap[org]) orgMap[org] = { name: org, total: 0, count: 0 };
            orgMap[org].total += Number(r.amount || 0);
            orgMap[org].count += 1;
        });

        const orgList = Object.values(orgMap).sort((a, b) => b.total - a.total);
        if (!app.views['annual-goals'].selectedOrgs) {
            app.views['annual-goals'].selectedOrgs = new Set(['ALL']);
        }
        const selectedSet = app.views['annual-goals'].selectedOrgs;

        const html = `
            <button type="button" class="filter-chip ${selectedSet.has('ALL') ? 'active' : ''}" data-org="ALL" title="顯示全部單位">
                <span>全部單位</span>
                <span class="chip-count">${revenueList.length}</span>
            </button>
            ${orgList.map(org => `
                <button type="button" class="filter-chip ${selectedSet.has(org.name) ? 'active' : ''}" data-org="${org.name}" title="點擊可複選多個單位">
                    <span>${org.name}</span>
                    <span class="chip-count">$${org.total.toLocaleString()}</span>
                </button>
            `).join('')}
        `;

        container.innerHTML = html;

        container.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const org = chip.dataset.org;
                app.views['annual-goals'].toggleOrg(org);
            });
        });
    },

    toggleOrg: (orgName) => {
        if (!app.views['annual-goals'].selectedOrgs) {
            app.views['annual-goals'].selectedOrgs = new Set(['ALL']);
        }
        const selectedSet = app.views['annual-goals'].selectedOrgs;

        if (orgName === 'ALL') {
            selectedSet.clear();
            selectedSet.add('ALL');
        } else {
            selectedSet.delete('ALL');
            if (selectedSet.has(orgName)) {
                selectedSet.delete(orgName);
            } else {
                selectedSet.add(orgName);
            }
            if (selectedSet.size === 0) {
                selectedSet.add('ALL');
            }
        }

        document.querySelectorAll('.org-rank-card').forEach(card => {
            const cOrg = card.dataset.org;
            card.classList.toggle('active', selectedSet.has(cOrg));
        });

        document.querySelectorAll('#org-filter-chips .filter-chip').forEach(chip => {
            const chipOrg = chip.dataset.org;
            chip.classList.toggle('active', selectedSet.has(chipOrg));
        });

        app.views['annual-goals'].renderCashFlowDetails();
    },

    renderCashFlowDetails: () => {
        const banner = document.getElementById('org-drilldown-banner');
        const listContainer = document.getElementById('manual-revenue-list');
        if (!listContainer) return;

        const selectedSet = app.views['annual-goals'].selectedOrgs || new Set(['ALL']);
        const searchKw = (app.views['annual-goals'].searchKeyword || '').toLowerCase();
        let list = [...app.views['annual-goals'].currentYearRevenue];

        // Render Drilldown Banner if single specific org selected
        if (!selectedSet.has('ALL') && selectedSet.size === 1 && banner) {
            const singleOrg = Array.from(selectedSet)[0];
            const orgRecords = list.filter(r => (r.organization || '').trim() === singleOrg);
            const orgTotal = orgRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
            const orgCount = orgRecords.length;
            const orgAvg = orgCount > 0 ? Math.round(orgTotal / orgCount) : 0;
            const latestRecord = [...orgRecords].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            banner.innerHTML = `
                <div class="org-banner-header">
                    <div class="org-banner-title">
                        <span style="font-size: 1.6rem;">🏢</span>
                        <div>
                            <h4 style="margin-bottom: 0; font-size: 1.2rem; color: var(--text-primary); font-weight: 700;">
                                ${singleOrg}
                            </h4>
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">主要客戶專屬金流看板</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button type="button" class="btn btn-secondary btn-quick-add-for-org" style="padding: 6px 12px; font-size: 0.85rem;" data-org="${singleOrg}">
                            ➕ 登記此客戶收入
                        </button>
                        <button type="button" class="btn btn-secondary btn-clear-drilldown" style="padding: 6px 12px; font-size: 0.85rem;">
                            ✕ 查看全部
                        </button>
                    </div>
                </div>
                <div class="org-banner-metrics">
                    <div class="banner-metric-item">
                        <span class="banner-metric-label">累計收款總額</span>
                        <span class="banner-metric-val" style="color: var(--success);">$${orgTotal.toLocaleString()}</span>
                    </div>
                    <div class="banner-metric-item">
                        <span class="banner-metric-label">收款筆數</span>
                        <span class="banner-metric-val">${orgCount} 筆</span>
                    </div>
                    <div class="banner-metric-item">
                        <span class="banner-metric-label">平均單筆收款</span>
                        <span class="banner-metric-val">$${orgAvg.toLocaleString()}</span>
                    </div>
                    <div class="banner-metric-item">
                        <span class="banner-metric-label">最近收款日期</span>
                        <span class="banner-metric-val" style="font-size: 1rem;">${latestRecord ? latestRecord.date : '-'}</span>
                    </div>
                </div>
            `;
            banner.style.display = 'block';

            const clearBtn = banner.querySelector('.btn-clear-drilldown');
            if (clearBtn) clearBtn.onclick = () => app.views['annual-goals'].toggleOrg('ALL');

            const quickAddBtn = banner.querySelector('.btn-quick-add-for-org');
            if (quickAddBtn) {
                quickAddBtn.onclick = () => {
                    document.getElementById('revenue-org').value = singleOrg;
                    document.getElementById('revenue-item').focus();
                    document.getElementById('manual-revenue-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
                };
            }
        } else if (banner) {
            banner.style.display = 'none';
        }

        // Filter list by selectedOrgs
        if (!selectedSet.has('ALL')) {
            list = list.filter(r => selectedSet.has((r.organization || '').trim()));
        }

        if (searchKw) {
            list = list.filter(r => {
                const matchedP = app.views['annual-goals'].matchProjectForRevenue(r, app.views['annual-goals'].allProjects);
                const pname = matchedP ? matchedP.name.toLowerCase() : '';
                return (r.organization && r.organization.toLowerCase().includes(searchKw)) ||
                    (r.item && r.item.toLowerCase().includes(searchKw)) ||
                    (r.note && r.note.toLowerCase().includes(searchKw)) ||
                    (r.date && r.date.includes(searchKw)) ||
                    pname.includes(searchKw);
            });
        }

        list.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (list.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 2rem 0;">
                    <p style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.25rem;">尚無符合條件的金流紀錄</p>
                </div>
            `;
            return;
        }

        const html = list.map(r => {
            const matchedP = app.views['annual-goals'].matchProjectForRevenue(r, app.views['annual-goals'].allProjects);
            return `
                <div class="cashflow-item" data-id="${r.id}">
                    <div class="cashflow-left">
                        <div class="cashflow-date-badge">${r.date}</div>
                        <div class="cashflow-details">
                            <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 2px;">
                                <span class="cashflow-org-tag" title="點擊切換為此單位">${r.organization}</span>
                                ${matchedP ? `<span class="cashflow-project-tag" title="關聯專案">📁 ${matchedP.name}</span>` : ''}
                            </div>
                            <div class="cashflow-item-name" title="${r.item || ''}">${r.item || '(未填寫項目)'}</div>
                        </div>
                    </div>
                    <div class="cashflow-right">
                        <div class="cashflow-amount">+$${Number(r.amount || 0).toLocaleString()}</div>
                        <div class="cashflow-actions">
                            <button class="btn-icon-action btn-edit-revenue" data-id="${r.id}" title="編輯此筆金流">✏️</button>
                            <button class="btn-icon-action btn-delete-revenue" data-id="${r.id}" title="刪除此筆金流">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = html;

        // Bind Org Tag Clicks to filter
        listContainer.querySelectorAll('.cashflow-org-tag').forEach(tag => {
            tag.style.cursor = 'pointer';
            tag.onclick = (e) => {
                e.stopPropagation();
                const orgName = tag.innerText.trim();
                app.views['annual-goals'].selectOrg(orgName);
            };
        });

        // Bind Edit Buttons
        listContainer.querySelectorAll('.btn-edit-revenue').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.id);
                app.views['annual-goals'].startEditRevenue(id);
            };
        });

        // Bind Delete Buttons
        listContainer.querySelectorAll('.btn-delete-revenue').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.id);
                if (confirm('確定要刪除此筆收入紀錄嗎？此操作無法復原。')) {
                    try {
                        await db.delete('manualRevenue', id);
                        const currentYear = document.getElementById('annual-goals-year-select').value;
                        await app.views['annual-goals'].refreshAll(currentYear);
                    } catch (err) {
                        console.error("Delete error", err);
                        alert("刪除失敗");
                    }
                }
            };
        });
    },

    handleRevenueSubmit: async (e, year) => {
        e.preventDefault();
        const date = document.getElementById('revenue-date').value;
        const org = document.getElementById('revenue-org').value.trim();
        const item = document.getElementById('revenue-item').value.trim();
        const amount = Number(document.getElementById('revenue-amount').value);
        const projSelect = document.getElementById('revenue-project-select');
        const projectId = projSelect && projSelect.value ? Number(projSelect.value) : null;

        if (!date || !org || !item || isNaN(amount) || amount < 0) {
            alert('請填寫完整的收款資訊與有效金額');
            return;
        }

        const entryYear = date.split('-')[0];
        if (entryYear !== String(year)) {
            if (!confirm(`您輸入的收款日期 (${date}) 不在目前檢視的年份 (${year}) 中。\n這筆收入將會計入 ${entryYear} 年的年度目標與統計。\n確定要繼續嗎？`)) {
                return;
            }
        }

        try {
            const data = {
                date,
                organization: org,
                item,
                amount,
                projectId,
                year: entryYear,
                createdAt: new Date().toISOString()
            };

            if (app.views['annual-goals'].editingId) {
                const id = app.views['annual-goals'].editingId;
                const existing = await db.get('manualRevenue', id);
                data.id = id;
                data.createdAt = existing ? existing.createdAt : new Date().toISOString();
                await db.put('manualRevenue', data);
            } else {
                await db.add('manualRevenue', data);
            }

            app.views['annual-goals'].resetRevenueForm();
            await app.views['annual-goals'].refreshAll(year);
        } catch (err) {
            console.error("Revenue submit error", err);
            alert('儲存收入失敗');
        }
    },

    startEditRevenue: async (id) => {
        try {
            const r = await db.get('manualRevenue', id);
            if (!r) return;

            app.views['annual-goals'].editingId = id;
            document.getElementById('revenue-date').value = r.date;
            document.getElementById('revenue-org').value = r.organization;
            document.getElementById('revenue-item').value = r.item || '';
            document.getElementById('revenue-amount').value = r.amount;

            const projSelect = document.getElementById('revenue-project-select');
            if (projSelect) {
                const matchedP = app.views['annual-goals'].matchProjectForRevenue(r, app.views['annual-goals'].allProjects);
                projSelect.value = r.projectId || (matchedP ? matchedP.id : '');
            }

            const titleEl = document.getElementById('revenue-form-title');
            if (titleEl) titleEl.innerText = '✏️ 編輯收入紀錄';

            const submitBtn = document.getElementById('revenue-submit-btn');
            if (submitBtn) {
                submitBtn.innerText = '儲存修改';
                submitBtn.style.backgroundColor = 'var(--accent-primary)';
            }

            const cancelBtn = document.getElementById('cancel-revenue-edit');
            if (cancelBtn) {
                cancelBtn.style.display = 'inline-flex';
            }

            document.getElementById('manual-revenue-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
            console.error("Edit revenue error", e);
        }
    },

    resetRevenueForm: () => {
        app.views['annual-goals'].editingId = null;
        const form = document.getElementById('manual-revenue-form');
        if (form) form.reset();

        const dateInput = document.getElementById('revenue-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const titleEl = document.getElementById('revenue-form-title');
        if (titleEl) titleEl.innerText = '✍️ 登記收入 / 專案期款與尾款';

        const submitBtn = document.getElementById('revenue-submit-btn');
        if (submitBtn) {
            submitBtn.innerText = '新增入帳紀錄';
            submitBtn.style.backgroundColor = '';
        }

        const cancelBtn = document.getElementById('cancel-revenue-edit');
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
    },

    setRevenueMode: (mode) => {
        const singleForm = document.getElementById('manual-revenue-form');
        const splitForm = document.getElementById('salary-split-form');
        const btnSingle = document.getElementById('btn-revenue-mode-single');
        const btnSplit = document.getElementById('btn-revenue-mode-split');
        const descEl = document.getElementById('revenue-form-desc');

        if (mode === 'split') {
            if (singleForm) singleForm.style.display = 'none';
            if (splitForm) splitForm.style.display = 'block';
            if (btnSingle) {
                btnSingle.style.background = 'transparent';
                btnSingle.style.color = 'var(--text-secondary)';
            }
            if (btnSplit) {
                btnSplit.style.background = 'var(--accent-primary)';
                btnSplit.style.color = '#ffffff';
            }
            if (descEl) descEl.innerText = '選擇客戶組織與月份，輸入當月發放總薪資，系統自動按各專案工時佔比一秒拆帳！';
            app.views['annual-goals'].populateSplitClientsDropdown();
            app.views['annual-goals'].updateSalarySplitPreview();
        } else {
            if (singleForm) singleForm.style.display = 'block';
            if (splitForm) splitForm.style.display = 'none';
            if (btnSingle) {
                btnSingle.style.background = 'var(--accent-primary)';
                btnSingle.style.color = '#ffffff';
            }
            if (btnSplit) {
                btnSplit.style.background = 'transparent';
                btnSplit.style.color = 'var(--text-secondary)';
            }
            if (descEl) descEl.innerText = '可關聯專案以追蹤尾款入帳，或登記一般/額外收入';
        }
    },

    populateSplitClientsDropdown: () => {
        const select = document.getElementById('split-client-select');
        if (!select) return;

        const currentVal = select.value;
        const projects = app.views['annual-goals'].allProjects || [];
        
        // Find clients that have hourly projects
        const clients = Utils.extractUniqueClients(projects, app.views['annual-goals'].allRevenue);

        select.innerHTML = clients.map(c => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`).join('');

        if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
            select.value = currentVal;
        } else if (clients.length > 0) {
            select.value = clients[0];
        }

        // Initialize date and month if empty
        const monthInput = document.getElementById('split-month-select');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            const yearStr = now.getFullYear();
            const monthStr = String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${yearStr}-${monthStr}`;
        }

        const dateInput = document.getElementById('split-revenue-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    },

    updateSalarySplitPreview: () => {
        const previewContainer = document.getElementById('salary-split-preview');
        const submitBtn = document.getElementById('btn-submit-salary-split');
        if (!previewContainer) return;

        const client = document.getElementById('split-client-select')?.value;
        const month = document.getElementById('split-month-select')?.value;
        const totalAmount = Number(document.getElementById('split-total-amount')?.value || 0);

        if (!client || !month) {
            previewContainer.style.display = 'none';
            return;
        }

        previewContainer.style.display = 'block';

        // 1. Get all projects of this client (excluding fixed fee projects)
        const projects = (app.views['annual-goals'].allProjects || []).filter(p => {
            const pClient = (p.client || '').trim();
            return (pClient === client || p.name.includes(client)) && p.billingType !== 'fixed';
        });

        const projectIds = new Set(projects.map(p => Number(p.id)));

        // 2. Filter entries in that month
        const entries = (app.views['annual-goals'].allEntries || []).filter(e => {
            return projectIds.has(Number(e.projectId)) && e.date && e.date.startsWith(month);
        });

        // 3. Sum hours per project
        const hoursMap = {};
        let totalHours = 0;
        entries.forEach(e => {
            const pid = Number(e.projectId);
            hoursMap[pid] = (hoursMap[pid] || 0) + Number(e.hours || 0);
            totalHours += Number(e.hours || 0);
        });

        // List of projects with hours
        const activeProjects = projects.filter(p => (hoursMap[p.id] || 0) > 0);

        if (totalHours === 0 || activeProjects.length === 0) {
            previewContainer.innerHTML = `
                <div style="color: #b45309; font-size: 0.85rem; padding: 4px 0;">
                    ⚠️「<strong>${Utils.escapeHtml(client)}</strong>」在 <strong>${month}</strong> 尚無任何計時專案的工時紀錄。<br>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">請確認是否已在「專案工時」完成該月份的任務打卡或補登。</span>
                </div>
            `;
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        if (submitBtn) submitBtn.disabled = false;

        const effectiveRate = totalAmount > 0 ? Math.round(totalAmount / totalHours) : 0;

        // Calculate distribution
        let distributedSum = 0;
        const distribution = activeProjects.map((p, idx) => {
            const h = hoursMap[p.id] || 0;
            const pct = (h / totalHours);
            let amt = totalAmount > 0 ? Math.round(totalAmount * pct) : 0;
            return {
                project: p,
                hours: h,
                pct: (pct * 100).toFixed(1),
                amount: amt
            };
        });

        // Adjust rounding remainder to the project with highest hours
        if (totalAmount > 0 && distribution.length > 0) {
            const currentTotal = distribution.reduce((sum, d) => sum + d.amount, 0);
            const diff = totalAmount - currentTotal;
            if (diff !== 0) {
                distribution[0].amount += diff;
            }
        }

        previewContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px; margin-bottom: 8px; font-size: 0.85rem;">
                <div>
                    📅 <strong>${month} 結算工時</strong>：<strong style="color: var(--accent-primary);">${totalHours.toFixed(1)} h</strong>
                    ${activeProjects.length > 0 ? ` (涵蓋 ${activeProjects.length} 個專案)` : ''}
                </div>
                ${totalAmount > 0 ? `
                <div>
                    ⚡ 實質時薪：<strong style="color: var(--success); font-size: 0.95rem;">$${effectiveRate.toLocaleString()} /h</strong>
                </div>` : ''}
            </div>
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">
                📊 預計自動拆帳明細${totalAmount === 0 ? ' (輸入上方總月薪即可即時試算金額)' : ''}：
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${distribution.map(d => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.85rem;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-weight: 600;">${Utils.escapeHtml(d.project.name)}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">(${d.hours.toFixed(1)}h · ${d.pct}%)</span>
                        </div>
                        <strong style="color: ${totalAmount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)'};">
                            ${totalAmount > 0 ? `$${d.amount.toLocaleString()}` : '-'}
                        </strong>
                    </div>
                `).join('')}
            </div>
        `;
    },

    handleSalarySplitSubmit: async (e, selectedYear) => {
        e.preventDefault();
        const client = document.getElementById('split-client-select')?.value;
        const month = document.getElementById('split-month-select')?.value;
        const splitDate = document.getElementById('split-revenue-date')?.value;
        const totalAmount = Number(document.getElementById('split-total-amount')?.value || 0);

        if (!client || !month || !splitDate || totalAmount <= 0) {
            alert('請填寫完整的結算資訊與收款金額！');
            return;
        }

        // Get projects & entries
        const projects = (app.views['annual-goals'].allProjects || []).filter(p => {
            const pClient = (p.client || '').trim();
            return (pClient === client || p.name.includes(client)) && p.billingType !== 'fixed';
        });

        const projectIds = new Set(projects.map(p => Number(p.id)));
        const entries = (app.views['annual-goals'].allEntries || []).filter(e => {
            return projectIds.has(Number(e.projectId)) && e.date && e.date.startsWith(month);
        });

        const hoursMap = {};
        let totalHours = 0;
        entries.forEach(e => {
            const pid = Number(e.projectId);
            hoursMap[pid] = (hoursMap[pid] || 0) + Number(e.hours || 0);
            totalHours += Number(e.hours || 0);
        });

        const activeProjects = projects.filter(p => (hoursMap[p.id] || 0) > 0);

        if (totalHours === 0 || activeProjects.length === 0) {
            alert(`「${client}」在 ${month} 尚無任何計時專案的工時紀錄，無法進行拆帳！`);
            return;
        }

        const effectiveRate = Math.round(totalAmount / totalHours);
        const distribution = activeProjects.map(p => {
            const h = hoursMap[p.id] || 0;
            const pct = (h / totalHours);
            const amt = Math.round(totalAmount * pct);
            return { project: p, hours: h, amount: amt };
        });

        // Rounding fix
        const currentTotal = distribution.reduce((sum, d) => sum + d.amount, 0);
        const diff = totalAmount - currentTotal;
        if (diff !== 0 && distribution.length > 0) {
            distribution[0].amount += diff;
        }

        try {
            for (const d of distribution) {
                const revItem = {
                    date: splitDate,
                    projectId: d.project.id,
                    organization: client,
                    amount: d.amount,
                    item: `${d.project.name} ${month} 時薪結算 (${d.hours.toFixed(1)}h)`,
                    note: `由客戶 ${client} 月薪 $${totalAmount.toLocaleString()} 自動拆帳（當月投入 ${d.hours.toFixed(1)}h / 總計 ${totalHours.toFixed(1)}h · 時薪 $${effectiveRate.toLocaleString()}）`,
                    type: 'salary_split',
                    createdAt: new Date().toISOString()
                };
                await db.add('manualRevenue', revItem);
            }

            alert(`🎉 成功完成自動拆帳！\n已將 ${client} ${month} 月薪 $${totalAmount.toLocaleString()} 依照工時比例分別登記至 ${distribution.length} 個專案中。`);

            // Reset split form
            document.getElementById('salary-split-form').reset();
            app.views['annual-goals'].updateSalarySplitPreview();

            // Refresh UI
            await app.views['annual-goals'].refreshAll(selectedYear);

        } catch (err) {
            console.error('Salary split save error', err);
            alert('拆帳存檔失敗：' + err.message);
        }
    }
};
