app.views['project-details'] = {
    // ------------------------------------------------------------------------
    // TODO: USER MUST FILL THESE IN FOR THE FEATURE TO WORK
    // ------------------------------------------------------------------------
    // APIs removed


    init: async () => {
        console.log('Project Details View Loaded');

        // Bind Back to Projects Button
        const backBtn = document.getElementById('btn-back-to-projects');
        if (backBtn && !backBtn.dataset.listening) {
            backBtn.addEventListener('click', () => {
                window.location.hash = 'dashboard';
            });
            backBtn.dataset.listening = 'true';
        }

        // Bind show-archived checkbox event
        const showArchivedCb = document.getElementById('details-show-archived');
        const projectSelect = document.getElementById('project-details-select');

        if (showArchivedCb && !showArchivedCb.dataset.listening) {
            showArchivedCb.addEventListener('change', async () => {
                const currentVal = projectSelect.value;
                await app.views['project-details'].loadProjectsDropdown();
                if (currentVal && projectSelect.querySelector(`option[value="${currentVal}"]`)) {
                    projectSelect.value = currentVal;
                    await app.views['project-details'].loadProjectDetails(currentVal);
                } else {
                    projectSelect.value = '';
                    await app.views['project-details'].loadProjectDetails('');
                }
            });
            showArchivedCb.dataset.listening = 'true';
        }

        // 1. Load Projects for Dropdown
        await app.views['project-details'].loadProjectsDropdown();

        // 4. Bind Project Select Event for Persistence
        if (projectSelect && !projectSelect.dataset.listening) {
            projectSelect.addEventListener('change', async (e) => {
                const pid = e.target.value;
                if (pid) {
                    localStorage.setItem('last_viewed_project_id', pid);
                } else {
                    localStorage.removeItem('last_viewed_project_id');
                }
                await app.views['project-details'].loadProjectDetails(pid);
            });
            projectSelect.dataset.listening = 'true';
        }

        // 6. Bind Timer Buttons
        const startBtn = document.getElementById('btn-timer-start');
        const stopBtn = document.getElementById('btn-timer-stop');

        if (startBtn && !startBtn.dataset.listening) {
            startBtn.addEventListener('click', app.views['project-details'].startTimer);
            startBtn.dataset.listening = 'true';
        }
        if (stopBtn && !stopBtn.dataset.listening) {
            stopBtn.addEventListener('click', app.views['project-details'].stopTimer);
            stopBtn.dataset.listening = 'true';
        }

        // 7. Bind Manual Entry Form
        const manualForm = document.getElementById('manual-entry-form');
        if (manualForm && !manualForm.dataset.listening) {
            manualForm.addEventListener('submit', app.views['project-details'].handleManualEntry);

            // Set max date to today
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('manual-date');
            if (dateInput) dateInput.setAttribute('max', today);

            manualForm.dataset.listening = 'true';
        }

        // 8. Check active timer
        app.views['project-details'].initTimer();

        // 9. Update Datalist
        if (typeof app.updateSubitemsDatalist === 'function') {
            app.updateSubitemsDatalist();
        }

        // 10. Bind Quick Project Subitems Modal
        const editSubitemsBtn = document.getElementById('btn-quick-edit-project-subitems');
        if (editSubitemsBtn && !editSubitemsBtn.dataset.listening) {
            editSubitemsBtn.addEventListener('click', () => {
                app.views['project-details'].openQuickSubitemsModal();
            });
            editSubitemsBtn.dataset.listening = 'true';
        }

        const subitemsForm = document.getElementById('project-subitems-quick-form');
        if (subitemsForm && !subitemsForm.dataset.listening) {
            subitemsForm.addEventListener('submit', app.views['project-details'].saveQuickSubitems);
            subitemsForm.dataset.listening = 'true';
        }

        const presetContainer = document.getElementById('quick-subitem-presets');
        if (presetContainer && !presetContainer.dataset.listening) {
            presetContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-insert]');
                if (btn) {
                    const tag = btn.dataset.insert;
                    const input = document.getElementById('quick-proj-subitems-input');
                    if (input) {
                        const cur = input.value.trim();
                        if (!cur) {
                            input.value = tag;
                        } else if (!cur.includes(tag)) {
                            input.value = `${cur}, ${tag}`;
                        }
                    }
                }
            });
            presetContainer.dataset.listening = 'true';
        }

        // 11. Bind Batch Reclassify Modal
        const batchBtn = document.getElementById('btn-batch-reclassify-subitems');
        if (batchBtn && !batchBtn.dataset.listening) {
            batchBtn.addEventListener('click', app.views['project-details'].openBatchReclassifyModal);
            batchBtn.dataset.listening = 'true';
        }

        const batchForm = document.getElementById('batch-reclassify-form');
        if (batchForm && !batchForm.dataset.listening) {
            batchForm.addEventListener('submit', app.views['project-details'].handleBatchReclassify);
            batchForm.dataset.listening = 'true';
        }

        const batchSelectAllBtn = document.getElementById('btn-batch-select-all');
        if (batchSelectAllBtn && !batchSelectAllBtn.dataset.listening) {
            batchSelectAllBtn.addEventListener('click', () => {
                const cbs = document.querySelectorAll('.batch-source-tag-cb');
                const allChecked = Array.from(cbs).every(cb => cb.checked);
                cbs.forEach(cb => cb.checked = !allChecked);
                batchSelectAllBtn.innerText = allChecked ? '全選' : '取消全選';
            });
            batchSelectAllBtn.dataset.listening = 'true';
        }

        // 12. Bind Extract Subitems Button
        const extractBtn = document.getElementById('btn-extract-project-subitems');
        if (extractBtn && !extractBtn.dataset.listening) {
            extractBtn.addEventListener('click', app.views['project-details'].extractSubitemsFromDescriptions);
            extractBtn.dataset.listening = 'true';
        }

        app.views['project-details'].bindFilterEvents();

        // Determine target project to display
        let targetProjectId = null;
        const pendingProjectId = localStorage.getItem('pending_project_id');
        if (pendingProjectId) {
            localStorage.removeItem('pending_project_id');
            targetProjectId = pendingProjectId;
        } else if (projectSelect && projectSelect.value) {
            targetProjectId = projectSelect.value;
        } else {
            const lastViewed = localStorage.getItem('last_viewed_project_id');
            if (lastViewed && projectSelect && projectSelect.querySelector(`option[value="${lastViewed}"]`)) {
                targetProjectId = lastViewed;
            }
        }

        if (targetProjectId) {
            try {
                const project = await db.get('projects', Number(targetProjectId));
                if (project) {
                    if (project.status === 'closed' && showArchivedCb && !showArchivedCb.checked) {
                        showArchivedCb.checked = true;
                        await app.views['project-details'].loadProjectsDropdown();
                    }
                    if (projectSelect) {
                        projectSelect.value = targetProjectId;
                    }
                    await app.views['project-details'].loadProjectDetails(targetProjectId);
                } else {
                    await app.views['project-details'].loadProjectDetails('');
                }
            } catch (err) {
                console.error("Error loading target project details", err);
                await app.views['project-details'].loadProjectDetails('');
            }
        } else {
            await app.views['project-details'].loadProjectDetails('');
        }
    },

    bindFilterEvents: () => {
        const filters = ['filter-start-date', 'filter-end-date', 'filter-subitem'];
        filters.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.listening) {
                el.addEventListener('change', () => {
                    const projectId = document.getElementById('project-details-select').value;
                    if (projectId) {
                        app.views['project-details'].renderImportedEntries(projectId);
                    }
                });
                el.dataset.listening = 'true';
            }
        });
    },

    // Timer Variables
    timerInterval: null,

    initTimer: () => {
        const startTimestamp = localStorage.getItem('antigravity_timer_start');
        const projectId = localStorage.getItem('antigravity_timer_project');

        if (startTimestamp && projectId) {
            // Timer is running
            app.views['project-details'].updateTimerDisplay(); // Immediate update
            app.views['project-details'].timerInterval = setInterval(app.views['project-details'].updateTimerDisplay, 1000);

            // Update UI State
            document.getElementById('btn-timer-start').style.display = 'none';
            document.getElementById('btn-timer-stop').style.display = 'inline-block';

            // Try to auto-select the project if the dropdown is loaded
            const select = document.getElementById('project-details-select');
            if (select && select.options.length > 1) {
                select.value = projectId;
                // Trigger change to load history
                select.dispatchEvent(new Event('change'));
            }
        }
    },

    startTimer: () => {
        const select = document.getElementById('project-details-select');
        const projectId = select.value;
        const projectName = select.options[select.selectedIndex]?.text;

        if (!projectId) {
            alert('請先選擇一個專案來開始計時！');
            select.focus();
            return;
        }

        // Set Start Time
        const now = Date.now();
        localStorage.setItem('antigravity_timer_start', now);
        localStorage.setItem('antigravity_timer_project', projectId);

        // Update UI
        document.getElementById('btn-timer-start').style.display = 'none';
        document.getElementById('btn-timer-stop').style.display = 'inline-block';

        // Start Interval
        app.views['project-details'].updateTimerDisplay();
        app.views['project-details'].timerInterval = setInterval(app.views['project-details'].updateTimerDisplay, 1000);

        // Notify
        // alert(`已開始為「${projectName}」計時`);
    },

    stopTimer: async () => {
        // Clear Interval
        if (app.views['project-details'].timerInterval) {
            clearInterval(app.views['project-details'].timerInterval);
            app.views['project-details'].timerInterval = null;
        }

        // Calculate Duration
        const startTimestamp = parseInt(localStorage.getItem('antigravity_timer_start'));
        const projectId = localStorage.getItem('antigravity_timer_project');

        if (!startTimestamp || !projectId) {
            // Error state, just reset
            app.views['project-details'].resetTimerUI();
            return;
        }

        const now = Date.now();
        const diffMs = now - startTimestamp;
        const hours = (diffMs / (1000 * 60 * 60)); // Decimal hours
        const hoursRounded = Math.round(hours * 100) / 100; // Round to 2 decimals

        // Prompt for Description
        const durationStr = Utils.formatDuration(diffMs); // We'll need to add a helper or just format manually
        // Simple manual format for prompt
        const seconds = Math.floor((diffMs / 1000) % 60);
        const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
        const h = Math.floor((diffMs / (1000 * 60 * 60)));
        const timeStr = `${h}小時 ${minutes}分 ${seconds.toString().padStart(2, '0')}秒`;

        // Prompt for Description using new Modal
        const modal = document.getElementById('timer-save-modal');
        document.getElementById('timer-save-duration').innerText = timeStr;
        
        // Set hours/minutes inputs
        document.getElementById('timer-save-hours-part').value = h;
        document.getElementById('timer-save-minutes-part').value = minutes;

        // Populate projects dropdown
        const projectSelect = document.getElementById('timer-save-project-select');
        if (projectSelect) {
            try {
                const projects = await db.getAll('projects');
                projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // Only show active projects, plus the currently timed project (in case it was closed during timing)
                const filteredProjects = projects.filter(p => p.status !== 'closed' || p.id === Number(projectId));

                projectSelect.innerHTML = filteredProjects.map(p => `
                    <option value="${p.id}">${p.status === 'closed' ? `[已結案/封存] ${p.name}` : p.name}</option>
                `).join('');
                projectSelect.value = projectId;
            } catch (err) {
                console.error("Error loading projects for timer save modal", err);
            }
        }

        document.getElementById('timer-save-desc').value = '一般工時';
        const subitemInput = document.getElementById('timer-save-subitem');
        if (subitemInput) subitemInput.value = '';
        const billedCheck = document.getElementById('timer-save-is-billed');
        if (billedCheck) billedCheck.checked = false;

        modal.style.display = 'flex';

        const form = document.getElementById('timer-save-form');
        const cancelBtn = document.getElementById('timer-save-cancel-btn');

        // Cancel handler (once)
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            app.views['project-details'].timerInterval = setInterval(app.views['project-details'].updateTimerDisplay, 1000);
        };

        // Submit handler (once)
        form.onsubmit = async (e) => {
            e.preventDefault();
            modal.style.display = 'none';

            const savedProjectId = document.getElementById('timer-save-project-select').value;
            const hoursPart = parseInt(document.getElementById('timer-save-hours-part').value) || 0;
            const minutesPart = parseInt(document.getElementById('timer-save-minutes-part').value) || 0;
            if (hoursPart === 0 && minutesPart === 0) {
                alert('工時不能為 0！');
                return;
            }
            const savedHours = Math.round((hoursPart + minutesPart / 60) * 100) / 100;
            const desc = document.getElementById('timer-save-desc').value;
            const subItem = document.getElementById('timer-save-subitem') ? document.getElementById('timer-save-subitem').value : '';
            const isBilled = document.getElementById('timer-save-is-billed') ? document.getElementById('timer-save-is-billed').checked : false;

        // Save
        try {
            await db.add('entries', {
                projectId: Number(savedProjectId),
                date: new Date().toISOString().split('T')[0], // Today YYYY-MM-DD
                description: desc || '未命名工作',
                subItem: subItem,
                isBilled: isBilled,
                hours: savedHours,
                createdAt: new Date().toISOString(),
                source: 'timer'
            });

            if (typeof app.updateSubitemsDatalist === 'function') app.updateSubitemsDatalist();

            // Cleanup
            localStorage.removeItem('antigravity_timer_start');
            localStorage.removeItem('antigravity_timer_project');
            app.views['project-details'].resetTimerUI();

            alert('工時已儲存！');

            // Refresh List if we are still on that project
            const currentSelect = document.getElementById('project-details-select').value;
            if (currentSelect === savedProjectId) {
                app.views['project-details'].renderImportedEntries(savedProjectId);
            }

        } catch (e) {
            console.error("Save timer error", e);
            alert("存檔失敗：" + e.message);
        }
        };
    },

    resetTimerUI: () => {
        document.getElementById('timer-display').innerText = "00:00:00";
        document.getElementById('btn-timer-start').style.display = 'inline-block';
        document.getElementById('btn-timer-stop').style.display = 'none';
    },

    updateTimerDisplay: () => {
        const startTimestamp = localStorage.getItem('antigravity_timer_start');
        if (!startTimestamp) return;

        const now = Date.now();
        const diff = now - parseInt(startTimestamp);

        const seconds = Math.floor((diff / 1000) % 60);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const hours = Math.floor((diff / (1000 * 60 * 60)));

        const display = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const el = document.getElementById('timer-display');
        if (el) el.innerText = display;
    },

    // handleClearHistory removed

    loadProjectsDropdown: async () => {
        const select = document.getElementById('project-details-select');
        if (!select) return;

        const currentVal = select.value;
        try {
            const projects = await db.getAll('projects');
            const showArchivedCb = document.getElementById('details-show-archived');
            const showArchived = showArchivedCb ? showArchivedCb.checked : true;

            select.innerHTML = Utils.buildStandardProjectOptions(projects, {
                showClosed: showArchived,
                placeholder: '請選擇專案...'
            });

            if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
                select.value = currentVal;
            }

            if (window.CustomSelect) {
                CustomSelect.enhance(select);
            }
        } catch (e) {
            console.error("Error loading projects", e);
        }
    },

    currentProjectId: null,
    currentProject: null,
    currentProjectEntries: [],
    currentTotalHours: 0,

    loadProjectDetails: async (projectId) => {
        const container = document.getElementById('project-content-container');
        const infoDisplay = document.getElementById('project-info-display');

        if (!projectId) {
            if (container) container.style.display = 'none';
            app.views['project-details'].currentProjectId = null;
            app.views['project-details'].currentProject = null;
            app.views['project-details'].currentProjectEntries = [];
            app.views['project-details'].currentTotalHours = 0;
            return;
        }

        if (container) container.style.display = 'block';
        if (infoDisplay) infoDisplay.innerHTML = '<p style="color: var(--text-muted);">載入中...</p>';

        try {
            const project = await db.get('projects', Number(projectId));
            if (!project) {
                console.warn("Project not found for id:", projectId);
                if (infoDisplay) infoDisplay.innerHTML = `<p style="color: var(--danger);">找不到專案資料 (ID: ${projectId})</p>`;
                return;
            }

            const allEntries = await db.getAll('entries');
            const projectEntries = allEntries.filter(e => Number(e.projectId) === Number(projectId));
            const totalHours = projectEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

            app.views['project-details'].currentProjectId = Number(projectId);
            app.views['project-details'].currentProject = project;
            app.views['project-details'].currentProjectEntries = projectEntries;
            app.views['project-details'].currentTotalHours = totalHours;

            // Sync select value
            const select = document.getElementById('project-details-select');
            if (select && select.value !== String(projectId)) {
                select.value = projectId;
            }

            const isHourly = project.billingType === 'hourly';
            const allRevenues = await db.getAll('manualRevenue');
            const projectRevenues = allRevenues.filter(r => Number(r.projectId) === Number(projectId));
            const lifetimeReceived = projectRevenues.reduce((sum, r) => sum + Number(r.amount || 0), 0);
            const budget = Number(project.revenue || 0);
            const unpaid = Math.max(0, budget - lifetimeReceived);
            const hourlyRate = Number(project.hourlyRate) || Utils.DEFAULT_HOURLY_RATE;

            const displayAmount = isHourly ? Math.round(totalHours * hourlyRate) : lifetimeReceived;
            const displayAmountLabel = isHourly ? '累計產值' : '專案已收';
            const displayRateLabel = isHourly ? `$${hourlyRate}/h` : (totalHours > 0 && lifetimeReceived > 0 ? `$${Math.round(lifetimeReceived / totalHours).toLocaleString()}/h` : '-');

            const catInfo = Utils.getCategoryInfo(project.category);
            const statusInfo = Utils.getStatusInfo(project.status);
            const billingInfo = Utils.getBillingTypeInfo(project.billingType);

            infoDisplay.innerHTML = `
                <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span>${Utils.escapeHtml(project.name)}</span>
                        <span class="project-client-badge">${Icons.render('building', { size: 12 })} ${Utils.escapeHtml(project.client || '未指定客戶')}</span>
                        <span style="font-size: 0.78rem; padding: 2px 8px; border-radius: 12px; background: ${billingInfo.color}15; color: ${billingInfo.color}; border: 1px solid ${billingInfo.color}35; font-weight: 600;">
                            ${isHourly ? `計時發薪 ($${hourlyRate}/h)` : billingInfo.label}
                        </span>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <!-- Quick Category Selector -->
                        <select id="details-quick-category" style="padding: 4px 10px; font-size: 0.8rem; border-radius: 14px; background: ${catInfo.color}; color: white; border: none; font-weight: 600; cursor: pointer;" title="快速切換專案類別">
                            <option value="commercial" ${project.category === 'commercial' ? 'selected' : ''}>商業委託</option>
                            <option value="pro_bono" ${project.category === 'pro_bono' ? 'selected' : ''}>公益奉獻</option>
                            <option value="self_study" ${project.category === 'self_study' ? 'selected' : ''}>自修創作</option>
                        </select>

                        <!-- Quick Status Selector -->
                        <select id="details-quick-status" style="padding: 4px 10px; font-size: 0.8rem; border-radius: 14px; background: ${statusInfo.bg}; color: ${statusInfo.color}; border: 1px solid ${statusInfo.color}; font-weight: 700; cursor: pointer;" title="快速切換專案生命週期狀態">
                            <option value="bidding" ${project.status === 'bidding' ? 'selected' : ''}>提案/開拓中</option>
                            <option value="active" ${project.status === 'active' ? 'selected' : ''}>執行中</option>
                            <option value="pending_payment" ${project.status === 'pending_payment' ? 'selected' : ''}>待請款</option>
                            <option value="paid" ${project.status === 'paid' ? 'selected' : ''}>已收齊</option>
                            <option value="closed" ${project.status === 'closed' ? 'selected' : ''}>已結案</option>
                        </select>

                        <button type="button" class="btn btn-secondary" id="details-btn-edit-full" style="padding: 4px 10px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.35rem;" title="編輯專案完整資訊（名稱、客戶、標籤、預算等）">
                            ${Icons.render('edit', { size: 13 })} 編輯專案
                        </button>
                    </div>
                </div>

                <div class="project-metric-grid" style="margin-bottom: 1rem;">
                    <div class="project-metric-item">
                        <span class="project-metric-label">累積工時</span>
                        <span class="project-metric-val">${totalHours.toFixed(1)} h</span>
                    </div>
                    <div class="project-metric-item">
                        <span class="project-metric-label">${displayAmountLabel}</span>
                        <span class="project-metric-val" style="color: ${displayAmount > 0 ? 'var(--success)' : 'var(--text-muted)'};">$${displayAmount.toLocaleString()}</span>
                    </div>
                    <div class="project-metric-item">
                        <span class="project-metric-label">${isHourly ? '專案時薪' : '實質時薪'}</span>
                        <span class="project-metric-val" style="color: ${displayRateLabel !== '-' ? 'var(--accent-primary)' : 'var(--text-muted)'};">${displayRateLabel}</span>
                    </div>
                </div>

                <div class="grid-2" style="gap: 0.75rem; font-size: 0.85rem;">
                    <div>
                        <span style="color: var(--text-secondary);">開始日期：</span>
                        <strong>${project.startDate || '未設定'}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">標籤性質：</span>
                        <strong>${project.types && project.types.length > 0 ? project.types.join(', ') : '無'}</strong>
                    </div>
                    ${!isHourly && budget > 0 ? `
                    <div>
                        <span style="color: var(--text-secondary);">合約總額：</span>
                        <strong>$${budget.toLocaleString()}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">尚欠尾款：</span>
                        <strong style="color: ${unpaid > 0 ? '#ea580c' : 'var(--success)'};">${unpaid > 0 ? `$${unpaid.toLocaleString()}` : '已結清'}</strong>
                    </div>` : ''}
                    ${isHourly ? `
                    <div>
                        <span style="color: var(--text-secondary);">計費模式：</span>
                        <strong style="color: var(--accent-primary);">專案計時發薪（$${hourlyRate}/hr）</strong>
                    </div>
                    ${budget > 0 ? `
                    <div>
                        <span style="color: var(--text-secondary);">預算上限：</span>
                        <strong>$${budget.toLocaleString()}</strong>
                    </div>` : ''}` : ''}
                </div>
            `;

            // Render WBS Breakdown (Proposal Estimation Benchmark)
            app.views['project-details'].renderWbsBreakdown();

            // Load History
            app.views['project-details'].renderImportedEntries(projectId);

            // Update manual entry subitem pills
            const manualPillsContainer = document.getElementById('manual-subitem-pills-container');
            if (manualPillsContainer) {
                let pills = [];
                if (project.subItems && project.subItems.length > 0) {
                    pills = project.subItems.map(s => ({ label: s, value: s, isCustom: true }));
                } else {
                    const used = new Set();
                    projectEntries.forEach(e => {
                        if (e.subItem && e.subItem.trim()) used.add(e.subItem.trim());
                    });
                    if (used.size > 0) {
                        pills = Array.from(used).map(s => ({ label: s, value: s, isCustom: true }));
                    }
                }

                if (pills.length === 0) {
                    pills = [
                        { label: '研究', value: '研究' },
                        { label: '訪談', value: '訪談' },
                        { label: '寫作', value: '寫作' },
                        { label: 'PM', value: 'PM' },
                        { label: '會議', value: '會議' }
                    ];
                }

                manualPillsContainer.innerHTML = pills.map(p => `
                    <button type="button" class="btn-stage-pill btn-manual-task-pill" data-task="${Utils.escapeHtml(p.value)}" style="${p.isCustom ? 'border-color: var(--accent-primary); color: var(--accent-primary); font-weight: 600;' : ''}">${Utils.escapeHtml(p.label)}</button>
                `).join('');

                manualPillsContainer.querySelectorAll('.btn-manual-task-pill').forEach(pill => {
                    pill.onclick = () => {
                        const subitemInput = document.getElementById('manual-subitem');
                        if (subitemInput) subitemInput.value = pill.dataset.task;
                    };
                });
            }

            // Quick Status & Category Listeners
            const quickCategorySel = document.getElementById('details-quick-category');
            if (quickCategorySel) {
                quickCategorySel.onchange = async (e) => {
                    project.category = e.target.value;
                    await db.put('projects', project);
                    await app.views['project-details'].loadProjectDetails(projectId);
                    if (app.views['dashboard'].renderProjects) app.views['dashboard'].renderProjects();
                };
            }

            const quickStatusSel = document.getElementById('details-quick-status');
            if (quickStatusSel) {
                quickStatusSel.onchange = async (e) => {
                    project.status = e.target.value;
                    await db.put('projects', project);
                    await app.views['project-details'].loadProjectDetails(projectId);
                    if (app.views['dashboard'].renderProjects) app.views['dashboard'].renderProjects();
                };
            }

            const editFullBtn = document.getElementById('details-btn-edit-full');
            if (editFullBtn) {
                editFullBtn.onclick = () => {
                    app.views['dashboard'].startEdit(Number(projectId));
                };
            }

        } catch (e) {
            console.error("Load details error", e);
            if (container) container.style.display = 'none';
        }
    },

    renderWbsBreakdown: (projectArg, projectEntriesArg, totalHoursArg) => {
        const wbsContainer = document.getElementById('project-wbs-container');
        if (!wbsContainer) return;

        const project = projectArg || app.views['project-details'].currentProject;
        const projectEntries = projectEntriesArg || app.views['project-details'].currentProjectEntries || [];
        const totalHours = totalHoursArg !== undefined ? totalHoursArg : (app.views['project-details'].currentTotalHours || 0);

        const mode = app.views['project-details'].wbsMode || 'raw';
        const smartBtn = document.getElementById('btn-wbs-mode-smart');
        const rawBtn = document.getElementById('btn-wbs-mode-raw');

        if (smartBtn && rawBtn) {
            if (mode === 'smart') {
                smartBtn.style.background = 'var(--accent-primary)';
                smartBtn.style.color = '#ffffff';
                rawBtn.style.background = 'transparent';
                rawBtn.style.color = 'var(--text-secondary)';
            } else {
                rawBtn.style.background = 'var(--accent-primary)';
                rawBtn.style.color = '#ffffff';
                smartBtn.style.background = 'transparent';
                smartBtn.style.color = 'var(--text-secondary)';
            }

            if (!smartBtn.dataset.listening) {
                smartBtn.addEventListener('click', () => {
                    app.views['project-details'].wbsMode = 'smart';
                    app.views['project-details'].renderWbsBreakdown();
                });
                smartBtn.dataset.listening = 'true';
            }
            if (!rawBtn.dataset.listening) {
                rawBtn.addEventListener('click', () => {
                    app.views['project-details'].wbsMode = 'raw';
                    app.views['project-details'].renderWbsBreakdown();
                });
                rawBtn.dataset.listening = 'true';
            }
        }

        if (!project || !projectEntries || projectEntries.length === 0 || totalHours === 0) {
            wbsContainer.innerHTML = `<p style="color: var(--text-muted); padding: 1.5rem 0; text-align: center;">此專案尚無工時紀錄</p>`;
            return;
        }

        let wbsList = [];
        if (mode === 'smart') {
            wbsList = Utils.extractProjectDynamicThemes(projectEntries, project ? project.subItems : null);
        } else {
            const rawMap = {};
            if (project && project.subItems && Array.isArray(project.subItems)) {
                project.subItems.forEach(s => {
                    const clean = s.trim();
                    if (clean) {
                        rawMap[clean] = {
                            key: clean,
                            name: clean,
                            color: '#64748b',
                            hours: 0,
                            count: 0,
                            entries: [],
                            isConfigured: true
                        };
                    }
                });
            }

            projectEntries.forEach(e => {
                const task = (e.subItem || '').trim() || '未分類 / 無子項目';
                if (!rawMap[task]) {
                    rawMap[task] = {
                        key: task,
                        name: task,
                        color: '#64748b',
                        hours: 0,
                        count: 0,
                        entries: []
                    };
                }
                rawMap[task].hours += Number(e.hours || 0);
                rawMap[task].count += 1;
                rawMap[task].entries.push(e);
            });

            const fallbackColors = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ea580c', '#8b5cf6', '#64748b'];
            wbsList = Object.values(rawMap)
                .filter(item => item.hours > 0 || item.isConfigured)
                .sort((a, b) => b.hours - a.hours)
                .map((item, idx) => ({
                    ...item,
                    color: item.key === '未分類 / 無子項目' ? '#94a3b8' : fallbackColors[idx % fallbackColors.length]
                }));
        }

        // Compute top categories for strategy tip
        const top1 = wbsList[0];
        const top2 = wbsList.length > 1 ? wbsList[1] : null;
        let tipHtml = '';
        if (top1 && top1.hours > 0) {
            const p1Pct = ((top1.hours / totalHours) * 100).toFixed(0);
            if (top2 && top2.hours > 0) {
                const p2Pct = ((top2.hours / totalHours) * 100).toFixed(0);
                tipHtml = `此專案主要投入在 <strong>${top1.name}</strong> (${top1.hours.toFixed(1)}h · 佔 ${p1Pct}%) 與 <strong>${top2.name}</strong> (${top2.hours.toFixed(1)}h · 佔 ${p2Pct}%)。下次承接同類型專案時，可直接依此工時比例排定里程碑與報價！`;
            } else {
                tipHtml = `此專案主要投入在 <strong>${top1.name}</strong> (${top1.hours.toFixed(1)}h · 佔 ${p1Pct}%)。`;
            }
        }

        wbsContainer.innerHTML = `
            <!-- Multi-segment visual progress bar -->
            <div style="width: 100%; height: 12px; border-radius: 6px; overflow: hidden; display: flex; background: rgba(0,0,0,0.06); margin-bottom: 1rem;">
                ${wbsList.map(item => {
                    const pct = totalHours > 0 ? Math.max(1, (item.hours / totalHours) * 100) : 0;
                    return `<div style="width: ${pct}%; height: 100%; background: ${item.color};" title="${item.name}: ${item.hours.toFixed(1)}h (${pct.toFixed(1)}%)"></div>`;
                }).join('')}
            </div>

            <!-- Table breakdown -->
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary); text-align: left;">
                            <th style="padding: 8px 10px;">${mode === 'smart' ? '💡 工時描述動態主題' : '📋 專案工作階段 (子項目)'}</th>
                            <th style="padding: 8px 10px; text-align: right;">投入工時</th>
                            <th style="padding: 8px 10px; text-align: right;">佔比 (%)</th>
                            <th style="padding: 8px 10px; text-align: right;">執行次數 (點擊查看明細)</th>
                            <th style="padding: 8px 10px; text-align: right;">平均單次耗時</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${wbsList.map((item, idx) => {
                            const pct = totalHours > 0 ? ((item.hours / totalHours) * 100).toFixed(1) : '0.0';
                            const avg = item.count > 0 ? (item.hours / item.count).toFixed(1) : '0.0';
                            return `
                                <tr class="wbs-row-interactive" data-wbs-idx="${idx}" style="border-bottom: 1px solid rgba(0,0,0,0.04);">
                                    <td style="padding: 8px 10px; font-weight: 600;">
                                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${item.color}; margin-right: 8px;"></span>
                                        ${item.name}
                                    </td>
                                    <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: var(--text-primary);">${item.hours.toFixed(1)} h</td>
                                    <td style="padding: 8px 10px; text-align: right; color: var(--accent-primary); font-weight: 600;">${pct}%</td>
                                    <td style="padding: 8px 10px; text-align: right;">
                                        ${item.count > 0 ? `
                                            <button type="button" class="wbs-clickable-count btn-wbs-item-drilldown" data-wbs-idx="${idx}" title="點擊查看「${item.name}」共 ${item.count} 筆原始工時明細與工作描述">
                                                ${item.count} 筆 🔍
                                            </button>
                                        ` : '<span style="color: var(--text-muted); font-size: 0.8rem;">尚未記錄</span>'}
                                    </td>
                                    <td style="padding: 8px 10px; text-align: right; color: var(--text-muted);">${item.count > 0 ? `${avg} h/次` : '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            ${tipHtml ? `
            <div style="margin-top: 1rem; padding: 10px 14px; background: rgba(124, 58, 237, 0.06); border-radius: var(--radius-sm); font-size: 0.85rem; color: #6d28d9; border: 1px solid rgba(124, 58, 237, 0.15);">
                💡 <strong>專案復盤小幫手</strong>：${tipHtml}
            </div>` : ''}
        `;

        // Bind Drilldown Clicks
        wbsContainer.querySelectorAll('.btn-wbs-item-drilldown').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.wbsIdx);
                const item = wbsList[idx];
                if (item && item.entries && item.entries.length > 0) {
                    app.openWbsDrilldown({
                        title: item.name,
                        color: item.color,
                        entries: item.entries,
                        projectId: project.id,
                        projectName: project.name,
                        filterSubitemValue: mode === 'raw' && item.key !== '未分類 / 無子項目' ? item.key : undefined,
                        isRawMode: mode === 'raw',
                        rawKey: item.key,
                        natureKey: item.key
                    });
                }
            });
        });

        wbsContainer.querySelectorAll('.wbs-row-interactive').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const idx = Number(row.dataset.wbsIdx);
                const item = wbsList[idx];
                if (item && item.entries && item.entries.length > 0) {
                    app.openWbsDrilldown({
                        title: item.name,
                        color: item.color,
                        entries: item.entries,
                        projectId: project.id,
                        projectName: project.name,
                        filterSubitemValue: mode === 'raw' && item.key !== '未分類 / 無子項目' ? item.key : undefined,
                        isRawMode: mode === 'raw',
                        rawKey: item.key,
                        natureKey: item.key
                    });
                }
            });
        });
    },

    openQuickSubitemsModal: () => {
        const project = app.views['project-details'].currentProject;
        if (!project) {
            alert('請先選擇一個專案');
            return;
        }
        document.getElementById('quick-subitems-project-id').value = project.id;
        document.getElementById('project-subitems-modal-title').innerText = `🏷️ 設定專案子項目：${project.name}`;
        document.getElementById('quick-proj-subitems-input').value = (project.subItems || []).join(', ');
        const modal = document.getElementById('project-subitems-modal');
        if (modal) modal.classList.add('active');
    },

    extractSubitemsFromDescriptions: () => {
        const project = app.views['project-details'].currentProject;
        const projectEntries = app.views['project-details'].currentProjectEntries || [];
        if (!project || projectEntries.length === 0) {
            alert('此專案目前尚無工時紀錄可供分析');
            return;
        }

        const themes = Utils.extractProjectDynamicThemes(projectEntries, project.subItems);
        const extractedNames = themes.map(t => t.cleanName).filter(name => name && name !== '一般執行與日常計時');

        if (extractedNames.length === 0) {
            alert('未能從現有描述中提煉出特定主題，建議直接手動輸入');
            return;
        }

        const input = document.getElementById('quick-proj-subitems-input');
        if (input) {
            const currentList = input.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
            const combined = Array.from(new Set([...currentList, ...extractedNames]));
            input.value = combined.join(', ');
            alert(`已從本專案工時紀錄自動提煉出 ${extractedNames.length} 個工作主題並填入清單！`);
        }
    },

    openBatchReclassifyModal: () => {
        const project = app.views['project-details'].currentProject;
        const projectEntries = app.views['project-details'].currentProjectEntries || [];
        if (!project) {
            alert('請先選擇一個專案');
            return;
        }

        document.getElementById('batch-reclassify-title').innerText = `🏷️ 批次整理專案子項目：${project.name}`;
        
        // Count subItems in this project's entries
        const counts = {};
        projectEntries.forEach(e => {
            const tag = (e.subItem || '').trim() || '未分類 / 無子項目';
            const isUnclassified = !(e.subItem && e.subItem.trim());
            if (!counts[tag]) counts[tag] = { count: 0, hours: 0, isUnclassified };
            counts[tag].count += 1;
            counts[tag].hours += Number(e.hours || 0);
        });

        const listContainer = document.getElementById('batch-reclassify-tags-list');
        const sortedTags = Object.entries(counts).sort((a, b) => b[1].hours - a[1].hours);

        listContainer.innerHTML = sortedTags.map(([tag, data]) => `
            <label style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); cursor: pointer; font-size: 0.88rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" class="batch-source-tag-cb" value="${Utils.escapeHtml(tag)}" data-is-unclassified="${data.isUnclassified}" style="width: auto; margin: 0;">
                    <span style="font-weight: 600; color: ${data.isUnclassified ? 'var(--text-muted)' : 'var(--text-primary)'};">${Utils.escapeHtml(tag)}</span>
                </div>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">${data.hours.toFixed(1)} h · ${data.count} 筆</span>
            </label>
        `).join('');

        // Target suggestions
        const datalist = document.getElementById('batch-target-suggestions');
        const suggestions = new Set(project.subItems || []);
        datalist.innerHTML = Array.from(suggestions).map(s => `<option value="${Utils.escapeHtml(s)}">`).join('');

        document.getElementById('batch-target-subitem-input').value = '';
        const modal = document.getElementById('batch-reclassify-modal');
        if (modal) modal.classList.add('active');
    },

    handleBatchReclassify: async (e) => {
        e.preventDefault();
        const project = app.views['project-details'].currentProject;
        if (!project) return;

        const targetSubitem = document.getElementById('batch-target-subitem-input').value.trim();
        if (!targetSubitem) {
            alert('請輸入欲變更為的新子項目名稱！');
            return;
        }

        const checkedCbs = Array.from(document.querySelectorAll('.batch-source-tag-cb:checked'));
        if (checkedCbs.length === 0) {
            alert('請至少勾選一個要合併的原始標籤！');
            return;
        }

        const selectedTags = new Set(checkedCbs.map(cb => cb.value));
        const includeUnclassified = checkedCbs.some(cb => cb.dataset.isUnclassified === 'true');

        try {
            const allEntries = await db.getAll('entries');
            let updatedCount = 0;

            for (const entry of allEntries) {
                if (Number(entry.projectId) === Number(project.id)) {
                    const curTag = (entry.subItem || '').trim() || '未分類 / 無子項目';
                    const isUnclassified = !(entry.subItem && entry.subItem.trim());

                    if (selectedTags.has(curTag) || (isUnclassified && includeUnclassified)) {
                        entry.subItem = targetSubitem;
                        await db.put('entries', entry);
                        updatedCount++;
                    }
                }
            }

            // Also ensure targetSubitem is added to project.subItems if not already
            if (!project.subItems) project.subItems = [];
            if (!project.subItems.includes(targetSubitem)) {
                project.subItems.push(targetSubitem);
                await db.put('projects', project);
            }

            document.getElementById('batch-reclassify-modal').classList.remove('active');
            alert(`成功將 ${updatedCount} 筆工時紀錄合併為「${targetSubitem}」！`);

            // Refresh views
            await app.views['project-details'].loadProjectDetails(project.id);
            if (typeof app.updateSubitemsDatalist === 'function') app.updateSubitemsDatalist();

        } catch (err) {
            console.error('Batch reclassify error', err);
            alert('批次更新失敗：' + err.message);
        }
    },

    saveQuickSubitems: async (e) => {
        e.preventDefault();
        const pid = document.getElementById('quick-subitems-project-id').value;
        if (!pid) return;

        try {
            const project = await db.get('projects', Number(pid));
            if (!project) return;

            const inputStr = document.getElementById('quick-proj-subitems-input').value;
            const subItems = inputStr.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
            project.subItems = Array.from(new Set(subItems));

            await db.put('projects', project);

            const modal = document.getElementById('project-subitems-modal');
            if (modal) modal.classList.remove('active');

            // Refresh UI
            await app.views['project-details'].loadProjectDetails(pid);
            if (typeof app.updateSubitemsDatalist === 'function') app.updateSubitemsDatalist();
        } catch (err) {
            console.error("Error saving quick subitems", err);
            alert('儲存子項目失敗');
        }
    },

    handleManualEntry: async (e) => {
        e.preventDefault();

        const projectId = document.getElementById('project-details-select').value;
        const date = document.getElementById('manual-date').value;
        const hoursPart = parseInt(document.getElementById('manual-hours-part').value) || 0;
        const minutesPart = parseInt(document.getElementById('manual-minutes-part').value) || 0;
        if (hoursPart === 0 && minutesPart === 0) {
            alert('工時不能為 0！');
            return;
        }
        const hours = Math.round((hoursPart + minutesPart / 60) * 100) / 100;
        const desc = document.getElementById('manual-desc').value;
        const subItem = document.getElementById('manual-subitem') ? document.getElementById('manual-subitem').value : '';
        const isBilled = document.getElementById('manual-is-billed') ? document.getElementById('manual-is-billed').checked : false;

        if (!projectId) {
            alert('請先選擇專案');
            return;
        }

        // Validation: Date <= Today
        const today = new Date().toISOString().split('T')[0];
        if (date > today) {
            alert('無法登記未來的工時！');
            return;
        }

        try {
            await db.add('entries', {
                projectId: Number(projectId),
                date: date,
                hours: hours,
                description: desc || '手動補登',
                subItem: subItem,
                isBilled: isBilled,
                source: 'manual',
                createdAt: new Date().toISOString()
            });

            if (typeof app.updateSubitemsDatalist === 'function') app.updateSubitemsDatalist();

            alert('補登成功！');
            // Reset form
            document.getElementById('manual-entry-form').reset();
            // Refresh view
            app.views['project-details'].loadProjectDetails(projectId);

        } catch (err) {
            console.error(err);
            alert('儲存失敗');
        }
    },

    // Google APIs Logic Removed


    renderImportedEntries: async (projectId) => {
        const container = document.getElementById('imported-entries-list');
        container.innerHTML = '載入中...';

        try {
            const allEntries = await db.getAll('entries');
            // Filter by project
            // Sort by Date (Newest first) descending
            const allProjectEntries = allEntries
                .filter(e => e.projectId === Number(projectId))
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            
            let imports = [...allProjectEntries];

            // Update Filter Options
            const filterSubitemEl = document.getElementById('filter-subitem');
            if (filterSubitemEl) {
                const isNewProject = filterSubitemEl.dataset.projectId !== String(projectId);
                if (isNewProject) {
                    const sDateEl = document.getElementById('filter-start-date');
                    if (sDateEl) sDateEl.value = '';
                    const eDateEl = document.getElementById('filter-end-date');
                    if (eDateEl) eDateEl.value = '';
                }
                
                const uniqueItems = new Set();
                allProjectEntries.forEach(e => {
                    if (e.subItem) uniqueItems.add(e.subItem);
                    if (e.description) uniqueItems.add(e.description);
                });
                
                const currentVal = isNewProject ? '' : filterSubitemEl.value;
                
                filterSubitemEl.innerHTML = '<option value="">全部</option>' + 
                    Array.from(uniqueItems).sort().map(item => `<option value="${item}">${item}</option>`).join('');
                    
                filterSubitemEl.dataset.projectId = String(projectId);
                
                if (Array.from(uniqueItems).includes(currentVal)) {
                    filterSubitemEl.value = currentVal;
                } else {
                    filterSubitemEl.value = '';
                }
            }

            // Apply Filters
            const startDate = document.getElementById('filter-start-date')?.value;
            const endDate = document.getElementById('filter-end-date')?.value;
            const subitemFilter = filterSubitemEl?.value;

            if (startDate) imports = imports.filter(e => e.date >= startDate);
            if (endDate) imports = imports.filter(e => e.date <= endDate);
            if (subitemFilter) {
                imports = imports.filter(e => e.subItem === subitemFilter || e.description === subitemFilter);
            }

            if (imports.length === 0) {
                const isFiltered = startDate || endDate || subitemFilter;
                if (isFiltered) {
                    container.innerHTML = `<div style="padding: 0.5rem; border-bottom: 2px solid var(--border-color); margin-bottom: 0.5rem; font-weight: bold; color: var(--text-primary); position: sticky; top: 0; background: var(--bg-card); z-index: 1;">
                共 0 筆紀錄, 總計 0.00 小時
            </div><div style="padding: 1rem; text-align: center;">符合條件的資料為空</div>`;
                } else {
                    container.innerHTML = '此專案尚無資料';
                }
                return;
            }


            // Scrollable container style
            container.style.maxHeight = '400px';
            container.style.overflowY = 'auto';
            container.style.textAlign = 'left';

            const listHtml = imports.map(e => `
                <div style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between;">
                        <strong>${e.date}</strong>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="color: var(--accent-primary); font-weight: bold;">${e.hours}h</span>
                            <button class="btn-edit-entry" data-id="${e.id}" style="border: none; background: none; cursor: pointer; color: var(--text-muted); padding: 2px; display: inline-flex; align-items: center;" title="編輯">${Icons.render('edit', { size: 14 })}</button>
                            <button class="btn-delete-entry" data-id="${e.id}" style="border: none; background: none; cursor: pointer; color: var(--text-muted); padding: 2px; display: inline-flex; align-items: center;" title="刪除">${Icons.render('trash', { size: 14 })}</button>
                        </div>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem; display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                        <div>
                            ${e.subItem ? `<span style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-right: 0.5rem;">${e.subItem}</span>` : ''}
                            ${e.description}
                        </div>
                        <label style="display: flex; align-items: center; gap: 0.2rem; cursor: pointer; font-size: 0.8rem; margin: 0; color: ${e.isBilled ? 'var(--success)' : 'var(--text-muted)'}; white-space: nowrap;">
                            <input type="checkbox" class="toggle-billed-cb" data-id="${e.id}" ${e.isBilled ? 'checked' : ''} style="margin: 0; width: auto;"> 已請款
                        </label>
                    </div>
                </div>
            `).join('');

            // Add a summary header
            const totalHours = imports.reduce((sum, e) => sum + e.hours, 0);
            const isFiltered = document.getElementById('filter-start-date')?.value || document.getElementById('filter-end-date')?.value || document.getElementById('filter-subitem')?.value;
            const summaryPrefix = isFiltered ? '篩選後：' : '';
            const summary = `<div style="padding: 0.5rem; border-bottom: 2px solid var(--border-color); margin-bottom: 0.5rem; font-weight: bold; color: var(--text-primary); position: sticky; top: 0; background: var(--bg-card); z-index: 1;">
                ${summaryPrefix}共 ${imports.length} 筆紀錄, 總計 <span style="color: var(--accent-primary); font-size: 1.1rem;">${totalHours.toFixed(2)}</span> 小時
            </div>`;

            container.innerHTML = summary + listHtml;

            // Bind Edit Buttons
            container.querySelectorAll('.btn-edit-entry').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = Number(e.currentTarget.dataset.id);
                    app.views['project-details'].startEditEntry(id);
                });
            });

            // Bind Delete Buttons
            container.querySelectorAll('.btn-delete-entry').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = Number(e.currentTarget.dataset.id);
                    app.views['project-details'].deleteEntry(id);
                });
            });

            // Bind Toggle Billed Checkboxes
            container.querySelectorAll('.toggle-billed-cb').forEach(cb => {
                cb.addEventListener('change', async (e) => {
                    const id = Number(e.currentTarget.dataset.id);
                    const isBilled = e.currentTarget.checked;
                    try {
                        const entry = await db.get('entries', id);
                        if (entry) {
                            entry.isBilled = isBilled;
                            await db.put('entries', entry);
                            // Visual update for the label color
                            e.currentTarget.parentElement.style.color = isBilled ? 'var(--success)' : 'var(--text-muted)';
                            if (typeof app.refreshWbsDrilldownIfOpen === 'function') {
                                app.refreshWbsDrilldownIfOpen();
                            }
                        }
                    } catch (err) {
                        console.error('Update billed status error', err);
                        e.currentTarget.checked = !isBilled; // revert
                    }
                });
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = '載入列表失敗';
        }
    },

    startEditEntry: async (id) => {
        try {
            const entry = await db.get('entries', id);
            if (!entry) return;

            // Load projects dropdown
            const projects = await db.getAll('projects');
            projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const projectSelect = document.getElementById('edit-entry-project');
            if (projectSelect) {
                // Only show active projects, plus the current entry's project (even if closed)
                const filteredProjects = projects.filter(p => p.status !== 'closed' || p.id === entry.projectId);

                projectSelect.innerHTML = '<option value="">請選擇專案...</option>' + 
                    filteredProjects.map(p => `
                        <option value="${p.id}">${p.status === 'closed' ? `[已結案/封存] ${p.name}` : p.name}</option>
                    `).join('');
                projectSelect.value = entry.projectId;
            }

            document.getElementById('edit-entry-id').value = entry.id;
            document.getElementById('edit-entry-date').value = entry.date;
            const totalMinutes = Math.round(entry.hours * 60);
            document.getElementById('edit-entry-hours-part').value = Math.floor(totalMinutes / 60);
            document.getElementById('edit-entry-minutes-part').value = totalMinutes % 60;
            document.getElementById('edit-entry-desc').value = entry.description;
            if (document.getElementById('edit-entry-subitem')) document.getElementById('edit-entry-subitem').value = entry.subItem || '';
            if (document.getElementById('edit-entry-is-billed')) document.getElementById('edit-entry-is-billed').checked = !!entry.isBilled;

            const modal = document.getElementById('edit-entry-modal');
            modal.style.display = 'flex';

            const form = document.getElementById('edit-entry-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                await app.views['project-details'].saveEditEntry();
            };

        } catch (e) {
            console.error("Edit entry error", e);
        }
    },

    saveEditEntry: async () => {
        const id = Number(document.getElementById('edit-entry-id').value);
        const date = document.getElementById('edit-entry-date').value;
        const hoursPart = parseInt(document.getElementById('edit-entry-hours-part').value) || 0;
        const minutesPart = parseInt(document.getElementById('edit-entry-minutes-part').value) || 0;
        if (hoursPart === 0 && minutesPart === 0) {
            alert('工時不能為 0！');
            return;
        }
        const hours = Math.round((hoursPart + minutesPart / 60) * 100) / 100;
        const desc = document.getElementById('edit-entry-desc').value;
        const subItem = document.getElementById('edit-entry-subitem') ? document.getElementById('edit-entry-subitem').value : '';
        const isBilled = document.getElementById('edit-entry-is-billed') ? document.getElementById('edit-entry-is-billed').checked : false;
        const projectSelect = document.getElementById('edit-entry-project');

        try {
            const entry = await db.get('entries', id);
            if (!entry) return;

            entry.date = date;
            entry.hours = hours;
            entry.description = desc;
            entry.subItem = subItem;
            entry.isBilled = isBilled;
            
            if (projectSelect && projectSelect.value) {
                entry.projectId = Number(projectSelect.value);
            }

            await db.put('entries', entry);

            if (typeof app.updateSubitemsDatalist === 'function') app.updateSubitemsDatalist();

            document.getElementById('edit-entry-modal').style.display = 'none';
            // Use current selected project from main view so it doesn't jump
            const currentViewedProjectId = document.getElementById('project-details-select').value;
            if (currentViewedProjectId) {
                await app.views['project-details'].renderImportedEntries(currentViewedProjectId);
                await app.views['project-details'].loadProjectDetails(currentViewedProjectId);
            } else {
                await app.views['project-details'].renderImportedEntries(entry.projectId);
                await app.views['project-details'].loadProjectDetails(entry.projectId);
            }

            if (typeof app.refreshWbsDrilldownIfOpen === 'function') {
                await app.refreshWbsDrilldownIfOpen();
            }

        } catch (e) {
            alert('儲存失敗');
            console.error(e);
        }
    },

    deleteEntry: async (id) => {
        if (!confirm('確定要刪除這筆工時紀錄嗎？此動作無法復原。')) {
            return;
        }

        try {
            const entry = await db.get('entries', id);
            if (!entry) {
                alert('找不到該筆紀錄');
                return;
            }
            const projectId = entry.projectId;

            await db.delete('entries', id);

            // Refresh view
            await app.views['project-details'].renderImportedEntries(projectId);
            await app.views['project-details'].loadProjectDetails(projectId);

            if (typeof app.refreshWbsDrilldownIfOpen === 'function') {
                await app.refreshWbsDrilldownIfOpen();
            }

            alert('紀錄已刪除');

        } catch (e) {
            console.error("Delete entry error", e);
            alert("刪除失敗：" + e.message);
        }
    },

    updateStatus: (msg, isError = false) => {
        const statusEl = document.getElementById('import-status');
        if (statusEl) {
            statusEl.textContent = msg;
            statusEl.style.color = isError ? 'var(--danger)' : 'var(--text-muted)';
            if (!isError) {
                // Determine if this is a "Success" message (e.g. "Google API 載入成功")
                if (msg.includes('成功')) {
                    statusEl.style.color = 'var(--success)';
                }
            }
        }
    }
};
