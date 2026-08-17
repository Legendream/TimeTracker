app.views['timer'] = {
    timerInterval: null,

    init: async () => {
        console.log('Timer View Init Start');
        // alert('Timer Init'); // Debug

        // 1. Load Projects
        await app.views['timer'].loadProjectsDropdown();

        // 2. Bind Events
        const startBtn = document.getElementById('timer-start-btn');
        const pauseBtn = document.getElementById('timer-pause-btn');
        const resumeBtn = document.getElementById('timer-resume-btn');
        const stopBtn = document.getElementById('timer-stop-btn');
        console.log('Timer Buttons:', { startBtn, pauseBtn, resumeBtn, stopBtn });

        if (startBtn && !startBtn.dataset.listening) {
            startBtn.addEventListener('click', app.views['timer'].startTimer);
            startBtn.dataset.listening = 'true';
        }

        if (pauseBtn && !pauseBtn.dataset.listening) {
            pauseBtn.addEventListener('click', app.views['timer'].pauseTimer);
            pauseBtn.dataset.listening = 'true';
        }

        if (resumeBtn && !resumeBtn.dataset.listening) {
            resumeBtn.addEventListener('click', app.views['timer'].resumeTimer);
            resumeBtn.dataset.listening = 'true';
        }

        if (stopBtn && !stopBtn.dataset.listening) {
            stopBtn.addEventListener('click', app.views['timer'].stopTimer);
            stopBtn.dataset.listening = 'true';
        }

        const cancelLinkBtn = document.getElementById('timer-resume-cancel-link-btn');
        if (cancelLinkBtn && !cancelLinkBtn.dataset.listening) {
            cancelLinkBtn.addEventListener('click', app.views['timer'].disconnectResumeEntry);
            cancelLinkBtn.dataset.listening = 'true';
        }

        // 3. Check for Active Timer
        app.views['timer'].checkActiveTimer();

        // 4. Load Today's Entries
        app.views['timer'].renderTodayEntries();
    },

    loadProjectsDropdown: async () => {
        const select = document.getElementById('timer-project-select');
        if (!select) return;

        try {
            const projects = await db.getAll('projects');
            select.innerHTML = Utils.buildStandardProjectOptions(projects, {
                showClosed: true,
                placeholder: '選擇專案...'
            });
            if (window.CustomSelect) {
                CustomSelect.enhance(select);
            }
        } catch (e) {
            console.error("Error loading projects", e);
        }
    },

    checkActiveTimer: () => {
        const startTimestamp = localStorage.getItem('standalone_timer_start');
        const projectId = localStorage.getItem('standalone_timer_project');
        const isPaused = localStorage.getItem('standalone_timer_paused') === 'true';

        if (startTimestamp || isPaused) {
            // Restore UI state
            const select = document.getElementById('timer-project-select');

            if (projectId && select) select.value = projectId;

            // Lock inputs while timing
            if (select) select.disabled = true;

            document.getElementById('timer-start-btn').style.display = 'none';
            document.getElementById('timer-stop-btn').style.display = 'inline-block';

            if (isPaused) {
                document.getElementById('timer-pause-btn').style.display = 'none';
                document.getElementById('timer-resume-btn').style.display = 'inline-block';
                app.views['timer'].updateDisplay(); // Show paused time
            } else {
                document.getElementById('timer-pause-btn').style.display = 'inline-block';
                document.getElementById('timer-resume-btn').style.display = 'none';

                // Clean up any existing interval first to avoid duplicates
                if (app.views['timer'].timerInterval) clearInterval(app.views['timer'].timerInterval);

                // Start Ticking
                app.views['timer'].updateDisplay();
                app.views['timer'].timerInterval = setInterval(app.views['timer'].updateDisplay, 1000);
            }

            // Restore resume indicator
            const resumeEntryId = localStorage.getItem('standalone_timer_resume_entry_id');
            if (resumeEntryId) {
                db.get('entries', Number(resumeEntryId)).then(entry => {
                    if (entry) {
                        db.get('projects', entry.projectId).then(proj => {
                            const projName = proj ? proj.name : '未知專案';
                            const detailsEl = document.getElementById('timer-resume-entry-details');
                            if (detailsEl) {
                                detailsEl.innerHTML = app.views['timer'].formatResumeIndicatorHtml(projName, entry);
                            }
                            const ind = document.getElementById('timer-resume-indicator');
                            if (ind) {
                                ind.style.display = 'inline-flex';
                                if (typeof Icons !== 'undefined') Icons.replace(ind);
                            }
                        });
                    }
                }).catch(err => console.error("Error restoring resume indicator", err));
            } else {
                const ind = document.getElementById('timer-resume-indicator');
                if (ind) ind.style.display = 'none';
            }
        } else {
            const ind = document.getElementById('timer-resume-indicator');
            if (ind) ind.style.display = 'none';
        }
    },

    startTimer: (e) => {
        if (e) e.preventDefault();
        console.log('startTimer clicked');
        const select = document.getElementById('timer-project-select');
        const projectId = select.value;

        if (!projectId) {
            alert('請先選擇一個專案！');
            select.focus();
            return;
        }

        // Save State
        const now = Date.now();
        localStorage.setItem('standalone_timer_start', now);
        localStorage.setItem('standalone_timer_project', projectId);
        localStorage.setItem('standalone_timer_accumulated', '0');
        localStorage.removeItem('standalone_timer_paused'); // Ensure not paused

        // Update UI
        select.disabled = true;
        document.getElementById('timer-start-btn').style.display = 'none';
        document.getElementById('timer-pause-btn').style.display = 'inline-block';
        document.getElementById('timer-resume-btn').style.display = 'none';
        document.getElementById('timer-stop-btn').style.display = 'inline-block';

        // Start Ticking
        if (app.views['timer'].timerInterval) clearInterval(app.views['timer'].timerInterval);
        app.views['timer'].updateDisplay();
        app.views['timer'].timerInterval = setInterval(app.views['timer'].updateDisplay, 1000);
    },

    pauseTimer: (e) => {
        if (e) e.preventDefault();
        const startTimestamp = localStorage.getItem('standalone_timer_start');
        if (!startTimestamp) return;

        // Stop Ticking
        if (app.views['timer'].timerInterval) {
            clearInterval(app.views['timer'].timerInterval);
            app.views['timer'].timerInterval = null;
        }

        const now = Date.now();
        const currentChunkStr = (now - parseInt(startTimestamp)).toString();
        const accumulatedStr = localStorage.getItem('standalone_timer_accumulated') || '0';

        // Add current chunk to accumulated
        const totalAccumulated = parseInt(accumulatedStr) + parseInt(currentChunkStr);
        localStorage.setItem('standalone_timer_accumulated', totalAccumulated.toString());
        localStorage.removeItem('standalone_timer_start');
        localStorage.setItem('standalone_timer_paused', 'true');

        // Update UI
        document.getElementById('timer-pause-btn').style.display = 'none';
        document.getElementById('timer-resume-btn').style.display = 'inline-block';
        app.views['timer'].updateDisplay(); // Final update
    },

    resumeTimer: (e) => {
        if (e) e.preventDefault();

        localStorage.setItem('standalone_timer_start', Date.now().toString());
        localStorage.removeItem('standalone_timer_paused');

        // Update UI
        document.getElementById('timer-pause-btn').style.display = 'inline-block';
        document.getElementById('timer-resume-btn').style.display = 'none';

        // Start Ticking
        if (app.views['timer'].timerInterval) clearInterval(app.views['timer'].timerInterval);
        app.views['timer'].updateDisplay();
        app.views['timer'].timerInterval = setInterval(app.views['timer'].updateDisplay, 1000);
    },

    stopTimer: async (e) => {
        if (e) e.preventDefault();
        const startTimestamp = localStorage.getItem('standalone_timer_start');
        const projectId = localStorage.getItem('standalone_timer_project');
        const isPaused = localStorage.getItem('standalone_timer_paused') === 'true';
        const accumulatedStr = localStorage.getItem('standalone_timer_accumulated') || '0';

        // Stop Ticking
        if (app.views['timer'].timerInterval) {
            clearInterval(app.views['timer'].timerInterval);
            app.views['timer'].timerInterval = null;
        }

        if (!projectId) {
            app.views['timer'].resetUI();
            return;
        }

        let totalMs = parseInt(accumulatedStr);
        if (!isPaused && startTimestamp) {
            totalMs += (Date.now() - parseInt(startTimestamp));
        }

        const hours = totalMs / (1000 * 60 * 60);
        const hoursRounded = Math.round(hours * 100) / 100;

        const seconds = Math.floor((totalMs / 1000) % 60);
        const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
        const h = Math.floor((totalMs / (1000 * 60 * 60)));
        const timeStr = `${h}小時 ${minutes}分 ${seconds.toString().padStart(2, '0')}秒`;

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

        let prefillDesc = '一般工時';
        let prefillSubitem = '';
        let prefillBilled = false;

        const resumeEntryId = localStorage.getItem('standalone_timer_resume_entry_id');
        if (resumeEntryId) {
            try {
                const entry = await db.get('entries', Number(resumeEntryId));
                if (entry) {
                    prefillDesc = entry.description || '一般工時';
                    prefillSubitem = entry.subItem || '';
                    prefillBilled = !!entry.isBilled;
                }
            } catch (err) {
                console.error("Error prefilling timer save modal from resumed entry", err);
            }
        }

        document.getElementById('timer-save-desc').value = prefillDesc;
        if (document.getElementById('timer-save-subitem')) document.getElementById('timer-save-subitem').value = prefillSubitem;
        if (document.getElementById('timer-save-is-billed')) document.getElementById('timer-save-is-billed').checked = prefillBilled;

        modal.style.display = 'flex';

        // Update task pills based on selected project
        await app.views['timer'].updateModalSubitemPills(projectId);

        if (projectSelect && !projectSelect.dataset.listeningModal) {
            projectSelect.addEventListener('change', (e) => {
                app.views['timer'].updateModalSubitemPills(e.target.value);
            });
            projectSelect.dataset.listeningModal = 'true';
        }

        const form = document.getElementById('timer-save-form');
        const cancelBtn = document.getElementById('timer-save-cancel-btn');
        const discardBtn = document.getElementById('timer-save-discard-btn');

        cancelBtn.onclick = () => {
             modal.style.display = 'none';
             if (app.views['timer'].timerInterval) clearInterval(app.views['timer'].timerInterval);
             app.views['timer'].updateDisplay();
             app.views['timer'].timerInterval = setInterval(app.views['timer'].updateDisplay, 1000);
        };

        if (discardBtn) {
            discardBtn.onclick = () => {
                if (confirm('確定要捨棄本次計時？此操作將清除目前計時且無法還原。')) {
                    modal.style.display = 'none';

                    // Cleanup states
                    localStorage.removeItem('standalone_timer_start');
                    localStorage.removeItem('standalone_timer_project');
                    localStorage.removeItem('standalone_timer_accumulated');
                    localStorage.removeItem('standalone_timer_paused');
                    localStorage.removeItem('standalone_timer_resume_entry_id');

                    // Reset UI
                    app.views['timer'].resetUI();
                    app.views['timer'].renderTodayEntries();
                }
            };
        }

        form.onsubmit = async (ev) => {
            ev.preventDefault();
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

            try {
                const currentResumeId = localStorage.getItem('standalone_timer_resume_entry_id');
                if (currentResumeId) {
                    const entry = await db.get('entries', Number(currentResumeId));
                    if (entry) {
                        entry.projectId = Number(savedProjectId);
                        entry.hours = savedHours;
                        entry.description = desc || '一般工時';
                        entry.subItem = subItem;
                        entry.isBilled = isBilled;
                        await db.put('entries', entry);
                    } else {
                        throw new Error("Resumed entry not found in database.");
                    }
                } else {
                    const entry = {
                        projectId: Number(savedProjectId),
                        date: new Date().toISOString().split('T')[0],
                        description: desc || '一般工時',
                        subItem: subItem,
                        isBilled: isBilled,
                        hours: savedHours,
                        createdAt: new Date().toISOString(),
                        source: 'timer-standalone'
                    };
                    await db.add('entries', entry);
                }
                
                if (typeof app.updateSubitemsDatalist === 'function') app.updateSubitemsDatalist();

                // Cleanup & Reset
                localStorage.removeItem('standalone_timer_start');
                localStorage.removeItem('standalone_timer_project');
                localStorage.removeItem('standalone_timer_accumulated');
                localStorage.removeItem('standalone_timer_paused');
                localStorage.removeItem('standalone_timer_resume_entry_id');

                app.views['timer'].resetUI();
                app.views['timer'].renderTodayEntries();

            } catch (e) {
                console.error("Save error", e);
                alert("存檔失敗");
            }
        };
    },

    updateDisplay: () => {
        const startTimestamp = localStorage.getItem('standalone_timer_start');
        const accumulatedStr = localStorage.getItem('standalone_timer_accumulated') || '0';
        const isPaused = localStorage.getItem('standalone_timer_paused') === 'true';

        let totalMs = parseInt(accumulatedStr);
        if (!isPaused && startTimestamp) {
            totalMs += (Date.now() - parseInt(startTimestamp));
        }

        const seconds = Math.floor((totalMs / 1000) % 60);
        const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
        const hours = Math.floor((totalMs / (1000 * 60 * 60)));

        const display = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const el = document.getElementById('timer-display');
        if (el) el.innerText = display;
    },

    resetUI: () => {
        document.getElementById('timer-display').innerText = "00:00:00";
        document.getElementById('timer-project-select').disabled = false;
        document.getElementById('timer-project-select').value = "";

        document.getElementById('timer-start-btn').style.display = 'inline-block';
        document.getElementById('timer-pause-btn').style.display = 'none';
        document.getElementById('timer-resume-btn').style.display = 'none';
        document.getElementById('timer-stop-btn').style.display = 'none';

        const ind = document.getElementById('timer-resume-indicator');
        if (ind) ind.style.display = 'none';
    },

    updateModalSubitemPills: async (projectId) => {
        const pillsContainer = document.getElementById('timer-save-task-pills-container');
        if (!pillsContainer) return;

        let pills = [];
        if (projectId) {
            try {
                const project = await db.get('projects', Number(projectId));
                if (project && project.subItems && project.subItems.length > 0) {
                    pills = project.subItems.map(s => ({ label: `🏷️ ${s}`, value: s, isCustom: true }));
                } else if (project) {
                    // Fallback to past subItems used in this project
                    const entries = await db.getAll('entries');
                    const used = new Set();
                    entries.filter(e => e.projectId === Number(projectId)).forEach(e => {
                        if (e.subItem && e.subItem.trim()) used.add(e.subItem.trim());
                    });
                    if (used.size > 0) {
                        pills = Array.from(used).map(s => ({ label: `🏷️ ${s}`, value: s, isCustom: true }));
                    }
                }
            } catch (e) {
                console.error("Error loading project subitems", e);
            }
        }

        if (pills.length === 0) {
            pills = [
                { label: '🔍 研究', value: '研究' },
                { label: '🎤 訪談', value: '訪談' },
                { label: '✍️ 寫作/整理', value: '寫作' },
                { label: '💼 PM/協調', value: 'PM' },
                { label: '👥 會議', value: '會議' },
                { label: '🎯 工作坊', value: '工作坊' },
                { label: '📊 企劃/提案', value: '企劃' }
            ];
        }

        pillsContainer.innerHTML = pills.map(p => `
            <button type="button" class="btn-stage-pill btn-modal-task-pill" data-task="${p.value}" style="${p.isCustom ? 'border-color: var(--accent-primary); color: var(--accent-primary); font-weight: 600;' : ''}">${p.label}</button>
        `).join('');

        pillsContainer.querySelectorAll('.btn-modal-task-pill').forEach(pill => {
            pill.onclick = () => {
                const task = pill.dataset.task;
                const subitemInput = document.getElementById('timer-save-subitem');
                if (subitemInput) {
                    subitemInput.value = task;
                }
            };
        });
    },

    renderTodayEntries: async () => {
        const container = document.getElementById('today-entries-list');
        if (!container) return;

        container.innerHTML = '載入中...';

        try {
            const today = new Date().toISOString().split('T')[0];
            const allEntries = await db.getAll('entries');
            const projects = await db.getAll('projects');

            // Map project names
            const projectMap = {};
            projects.forEach(p => projectMap[p.id] = p.name);

            // Filter Today
            const todayEntries = allEntries
                .filter(e => e.date === today)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            const capsule = document.getElementById('today-productivity-capsule');
            if (todayEntries.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">今日尚無紀錄，點擊上方「開始計時」以記錄第一筆工作。</p>';
                if (capsule) {
                    capsule.innerHTML = `
                        <span class="stat-capsule-icon">${Icons.render('calendar', { size: 16 })}</span>
                        <span class="stat-capsule-label">今日已累積：</span>
                        <strong class="stat-capsule-val" style="color: var(--text-muted); font-size: 1.05rem;">0.0 h</strong>
                    `;
                }
                return;
            }

            // Calculate total hours and distinct projects
            const dailyTotal = todayEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
            const distinctProjects = new Set(todayEntries.map(e => e.projectId));

            if (capsule) {
                capsule.innerHTML = `
                    <span class="stat-capsule-icon">${Icons.render('calendar', { size: 16 })}</span>
                    <span class="stat-capsule-label">今日已累積：</span>
                    <strong class="stat-capsule-val" style="color: var(--accent-primary); font-size: 1.05rem;">${dailyTotal.toFixed(1)} h</strong>
                    <span style="color: var(--text-muted); font-size: 0.82rem; margin-left: 0.25rem;">(${todayEntries.length} 筆任務 · ${distinctProjects.size} 個專案)</span>
                `;
            }

            container.innerHTML = todayEntries.map(e => `
                <div class="card" style="padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: bold; margin-bottom: 0.2rem;">${projectMap[e.projectId] || '未知專案'}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem; display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                            <div>
                                ${e.subItem ? `<span style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-right: 0.5rem;">${e.subItem}</span>` : ''}
                                ${e.description}
                            </div>
                            <label style="display: flex; align-items: center; gap: 0.2rem; cursor: pointer; font-size: 0.8rem; margin: 0; color: ${e.isBilled ? 'var(--success)' : 'var(--text-muted)'}; white-space: nowrap; margin-left: 0.5rem;">
                                <input type="checkbox" class="toggle-billed-cb-timer" data-id="${e.id}" ${e.isBilled ? 'checked' : ''} style="margin: 0; width: auto;"> 已請款
                            </label>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="font-weight: bold; color: var(--accent-primary); font-size: 1.1rem; margin-right: 0.2rem;">
                            ${e.hours}h
                        </div>
                        <button class="btn-resume-entry-timer" data-id="${e.id}" style="border: none; background: none; cursor: pointer; padding: 5px; color: var(--success); display: inline-flex; align-items: center;" title="接續累計此項目">${Icons.render('play', { size: 15 })}</button>
                        <button class="btn-edit-entry-timer" data-id="${e.id}" style="border: none; background: none; cursor: pointer; color: var(--text-muted); padding: 5px; display: inline-flex; align-items: center;" title="編輯">${Icons.render('edit', { size: 15 })}</button>
                        <button class="btn-delete-entry" data-id="${e.id}" style="border: none; background: none; cursor: pointer; color: var(--text-muted); padding: 5px; display: inline-flex; align-items: center;" title="刪除">${Icons.render('trash', { size: 15 })}</button>
                    </div>
                </div>
            `).join('');

            // Bind Resume Buttons
            container.querySelectorAll('.btn-resume-entry-timer').forEach(btn => {
                btn.addEventListener('click', (ev) => {
                    const id = Number(ev.currentTarget.dataset.id);
                    app.views['timer'].resumeExistingEntry(id);
                });
            });

            // Bind Edit Buttons
            container.querySelectorAll('.btn-edit-entry-timer').forEach(btn => {
                btn.addEventListener('click', (ev) => {
                    const id = Number(ev.currentTarget.dataset.id);
                    app.views['timer'].startEditEntry(id);
                });
            });

            // Bind Delete Buttons
            container.querySelectorAll('.btn-delete-entry').forEach(btn => {
                btn.addEventListener('click', (ev) => {
                    const id = Number(ev.currentTarget.dataset.id);
                    app.views['timer'].deleteEntry(id);
                });
            });

            // Bind Toggle Billed Checkboxes
            container.querySelectorAll('.toggle-billed-cb-timer').forEach(cb => {
                cb.addEventListener('change', async (ev) => {
                    const id = Number(ev.currentTarget.dataset.id);
                    const isBilled = ev.currentTarget.checked;
                    try {
                        const entry = await db.get('entries', id);
                        if (entry) {
                            entry.isBilled = isBilled;
                            await db.put('entries', entry);
                            // Visual update for the label color
                            ev.currentTarget.parentElement.style.color = isBilled ? 'var(--success)' : 'var(--text-muted)';
                        }
                    } catch (err) {
                        console.error('Update billed status error', err);
                        ev.currentTarget.checked = !isBilled; // revert
                    }
                });
            });

        } catch (e) {
            console.error("Render today error", e);
            container.innerHTML = '載入失敗';
        }
    },

    deleteEntry: async (id) => {
        if (!confirm('確定要刪除這筆工時紀錄嗎？')) return;
        try {
            await db.delete('entries', id);
            app.views['timer'].renderTodayEntries();
        } catch (e) {
            console.error(e);
            alert('刪除失敗');
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
                await app.views['timer'].saveEditEntry();
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
            app.views['timer'].renderTodayEntries();

        } catch (e) {
            alert('儲存失敗');
            console.error(e);
        }
    },

    resumeExistingEntry: async (id) => {
        const activeStart = localStorage.getItem('standalone_timer_start');
        const activePaused = localStorage.getItem('standalone_timer_paused') === 'true';
        if (activeStart || activePaused) {
            if (!confirm('目前已有計時器正在運行，是否要終止當前計時，並開始累計選取項目？')) {
                return;
            }
        }

        try {
            const entry = await db.get('entries', id);
            if (!entry) {
                alert('找不到該筆工時紀錄');
                return;
            }

            const project = await db.get('projects', entry.projectId);
            const projectName = project ? project.name : '未知專案';

            // Clear any active timer intervals
            if (app.views['timer'].timerInterval) {
                clearInterval(app.views['timer'].timerInterval);
                app.views['timer'].timerInterval = null;
            }

            // Set states
            const originalMs = Math.round(parseFloat(entry.hours || 0) * 3600000);
            localStorage.setItem('standalone_timer_resume_entry_id', entry.id.toString());
            localStorage.setItem('standalone_timer_project', entry.projectId.toString());
            localStorage.setItem('standalone_timer_accumulated', originalMs.toString());
            localStorage.setItem('standalone_timer_start', Date.now().toString());
            localStorage.removeItem('standalone_timer_paused');

            // Setup UI
            const select = document.getElementById('timer-project-select');
            if (select) {
                select.value = entry.projectId;
                select.disabled = true;
            }

            document.getElementById('timer-start-btn').style.display = 'none';
            document.getElementById('timer-pause-btn').style.display = 'inline-block';
            document.getElementById('timer-resume-btn').style.display = 'none';
            document.getElementById('timer-stop-btn').style.display = 'inline-block';

            // Display details in indicator
            const detailsEl = document.getElementById('timer-resume-entry-details');
            if (detailsEl) {
                detailsEl.innerHTML = app.views['timer'].formatResumeIndicatorHtml(projectName, entry);
            }
            const ind = document.getElementById('timer-resume-indicator');
            if (ind) {
                ind.style.display = 'inline-flex';
                if (typeof Icons !== 'undefined') Icons.replace(ind);
            }

            // Start Ticking
            app.views['timer'].updateDisplay();
            app.views['timer'].timerInterval = setInterval(app.views['timer'].updateDisplay, 1000);

            // Scroll up to timer if user is scrolled down
            const timerView = document.getElementById('timer-view');
            if (timerView) {
                timerView.scrollIntoView({ behavior: 'smooth' });
            }

        } catch (err) {
            console.error("Error resuming entry", err);
            alert("載入紀錄失敗");
        }
    },

    formatResumeIndicatorHtml: (projectName, entry) => {
        const pName = Utils.escapeHtml(projectName || '未知專案');
        const hours = Number(entry.hours || 0).toFixed(1);
        const sub = entry.subItem ? Utils.escapeHtml(entry.subItem) : '';
        const desc = entry.description ? Utils.escapeHtml(entry.description) : '';
        const extra = [sub, desc].filter(Boolean).join(' · ');

        return `
            <strong style="color: var(--text-primary); font-weight: 700;">${pName}</strong>
            <span style="background: var(--bg-tertiary); color: var(--text-secondary); padding: 1px 6px; border-radius: 4px; font-size: 0.78rem; font-weight: 600;">已累計 ${hours}h</span>
            ${extra ? `<span style="color: var(--text-muted); font-size: 0.8rem;">(${extra})</span>` : ''}
        `;
    },

    disconnectResumeEntry: async () => {
        const resumeEntryId = localStorage.getItem('standalone_timer_resume_entry_id');
        if (!resumeEntryId) return;

        try {
            const entry = await db.get('entries', Number(resumeEntryId));
            if (entry) {
                const originalMs = Math.round(parseFloat(entry.hours || 0) * 3600000);
                
                // Subtract original hours from accumulated
                let accumulated = parseInt(localStorage.getItem('standalone_timer_accumulated') || '0');
                accumulated = Math.max(0, accumulated - originalMs);
                localStorage.setItem('standalone_timer_accumulated', accumulated.toString());

                // Remove link to old entry
                localStorage.removeItem('standalone_timer_resume_entry_id');

                // Hide indicator
                const ind = document.getElementById('timer-resume-indicator');
                if (ind) ind.style.display = 'none';

                // Update display immediately
                app.views['timer'].updateDisplay();
            }
        } catch (err) {
            console.error("Error disconnecting resume entry", err);
        }
    }
};
