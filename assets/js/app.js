const app = {
    router: {
        routes: {
            'dashboard': 'dashboard-view',
            'project-details': 'project-details-view',
            'timer': 'timer-view',
            'annual-goals': 'annual-goals-view',
            'export': 'export-view'
        },

        init: () => {
            window.addEventListener('hashchange', app.router.handleHashChange);
            app.router.handleHashChange(); // Handle initial load
        },

        handleHashChange: () => {
            let hash = window.location.hash.slice(1) || 'dashboard'; // Default to dashboard

            // Clean hash (remove query params if any)
            if (hash.includes('?')) hash = hash.split('?')[0];

            app.router.navigate(hash);
        },

        navigate: (routeId) => {
            const viewId = app.router.routes[routeId];
            if (!viewId) return;

            // Update URL if navigate called programmatically without hash change
            if (window.location.hash.slice(1) !== routeId) {
                // Determine if we should push state or just replace
                // simplified: just setting hash triggers hashchange
                // But to avoid double loop, we check before setting
                // Actually, setting hash is the standard way
                // history.pushState(null, null, `#${routeId}`);
            }

            // UI Update
            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
            const targetView = document.getElementById(viewId);
            if (targetView) targetView.classList.add('active');

            // Nav Active State
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            const activeLink = document.querySelector(`.nav-link[data-view="${routeId}"]`);
            if (activeLink) activeLink.classList.add('active');

            // Render any data-icon tags in the DOM
            if (typeof Icons !== 'undefined' && typeof Icons.replace === 'function') {
                Icons.replace();
            }

            // Trigger View Load
            if (app.views[routeId] && typeof app.views[routeId].init === 'function') {
                app.views[routeId].init();
            }
        }
    },

    views: {}, // Will be populated by view scripts

    updateSubitemsDatalist: async () => {
        try {
            const allEntries = await db.getAll('entries');
            const subItemsMap = new Map();

            // Track the most recent use of each subItem to sort them (latest first)
            allEntries.forEach(entry => {
                if (entry.subItem && entry.subItem.trim() !== '') {
                    const currentItemDate = subItemsMap.get(entry.subItem) || 0;
                    const entryDate = new Date(entry.createdAt || entry.date).getTime();
                    if (entryDate > currentItemDate) {
                        subItemsMap.set(entry.subItem, entryDate);
                    }
                }
            });

            // Sort by recent usage descending
            const sortedSubItems = Array.from(subItemsMap.entries())
                .sort((a, b) => b[1] - a[1])
                .map(entry => entry[0]);

            const datalist = document.getElementById('subitems-datalist');
            if (datalist) {
                datalist.innerHTML = sortedSubItems.map(item => `<option value="${item}"></option>`).join('');
            }
        } catch (e) {
            console.error("Error updating subitems datalist", e);
        }
    },

    adjustFormTime: (prefix, offsetMinutes) => {
        const hoursEl = document.getElementById(`${prefix}-hours-part`);
        const minutesEl = document.getElementById(`${prefix}-minutes-part`);
        if (!hoursEl || !minutesEl) return;

        let hours = parseInt(hoursEl.value) || 0;
        let minutes = parseInt(minutesEl.value) || 0;

        let totalMinutes = hours * 60 + minutes + offsetMinutes;
        if (totalMinutes < 0) totalMinutes = 0;

        hoursEl.value = Math.floor(totalMinutes / 60);
        minutesEl.value = totalMinutes % 60;
    },

    currentDrilldownParams: null,

    openWbsDrilldown: async (params) => {
        app.currentDrilldownParams = params;
        const modal = document.getElementById('wbs-drilldown-modal');
        if (!modal) return;

        const titleEl = document.getElementById('wbs-drilldown-title');
        const statsEl = document.getElementById('wbs-drilldown-stats');
        const listContainer = document.getElementById('wbs-drilldown-list-container');
        const footerAction = document.getElementById('wbs-drilldown-footer-action');

        const { title, color, entries, projectId, projectName, filterSubitemValue, isUniversal } = params;

        let projectsMap = params.projectsMap;
        if (!projectsMap) {
            try {
                const projects = await db.getAll('projects');
                projectsMap = new Map(projects.map(p => [p.id, p]));
            } catch (e) {
                projectsMap = new Map();
            }
        }

        const totalHours = (entries || []).reduce((sum, e) => sum + Number(e.hours || 0), 0);
        const count = (entries || []).length;
        const avg = count > 0 ? (totalHours / count).toFixed(1) : '0.0';

        titleEl.innerHTML = `
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${color || 'var(--accent-primary)'};"></span>
            <span>${title}</span>
        `;

        statsEl.innerHTML = `
            <span>⏱️ 投入工時：<strong style="color: var(--text-primary); font-size: 0.95rem;">${totalHours.toFixed(1)} h</strong></span>
            <span>📝 筆數：<strong style="color: var(--text-primary);">${count} 筆</strong></span>
            <span>⚡ 平均耗時：<strong style="color: var(--text-primary);">${avg} h/次</strong></span>
            ${projectName ? `<span>🏷️ 專案：<strong style="color: var(--accent-primary);">${projectName}</strong></span>` : (isUniversal ? `<span>🌐 範圍：<strong>全站跨專案統計</strong></span>` : '')}
        `;

        if (!entries || entries.length === 0) {
            listContainer.innerHTML = `<div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">此分類目前尚無工時明細紀錄</div>`;
        } else {
            const sortedEntries = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

            listContainer.innerHTML = sortedEntries.map(e => {
                const p = projectsMap.get(Number(e.projectId));
                const pName = p ? p.name : (projectName || '');
                return `
                    <div class="wbs-drilldown-card" data-entry-id="${e.id}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">📅 ${e.date}</span>
                                <span style="background: rgba(0, 102, 204, 0.08); color: var(--accent-primary); font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">⏱️ ${e.hours} h</span>
                                ${isUniversal && pName ? `<span style="background: var(--bg-tertiary); color: var(--text-secondary); font-size: 0.78rem; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">💼 ${pName}</span>` : ''}
                                ${e.subItem ? `<span style="background: rgba(124, 58, 237, 0.08); color: #7c3aed; font-size: 0.78rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🏷️ ${e.subItem}</span>` : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.6rem;">
                                <label style="display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer; font-size: 0.8rem; margin: 0; color: ${e.isBilled ? 'var(--success)' : 'var(--text-muted)'};">
                                    <input type="checkbox" class="drilldown-toggle-billed" data-id="${e.id}" ${e.isBilled ? 'checked' : ''} style="margin: 0; width: auto;"> 已請款
                                </label>
                                <button type="button" class="btn btn-secondary btn-drilldown-edit-entry" data-id="${e.id}" style="padding: 2px 8px; font-size: 0.8rem;" title="編輯此筆紀錄">✏️ 編輯</button>
                                <button type="button" class="btn btn-secondary btn-drilldown-delete-entry" data-id="${e.id}" style="padding: 2px 6px; font-size: 0.8rem; border-color: rgba(239, 68, 68, 0.3); color: var(--danger);" title="刪除此筆紀錄">🗑️</button>
                            </div>
                        </div>
                        <div style="font-size: 0.92rem; color: var(--text-primary); line-height: 1.5; padding-left: 2px; word-break: break-word;">
                            💬 ${e.description ? Utils.escapeHtml(e.description) : '<span style="color: var(--text-muted);">無描述</span>'}
                        </div>
                    </div>
                `;
            }).join('');

            // Bind Actions
            listContainer.querySelectorAll('.drilldown-toggle-billed').forEach(cb => {
                cb.addEventListener('change', async (ev) => {
                    const id = Number(ev.currentTarget.dataset.id);
                    const isBilled = ev.currentTarget.checked;
                    try {
                        const entry = await db.get('entries', id);
                        if (entry) {
                            entry.isBilled = isBilled;
                            await db.put('entries', entry);
                            ev.currentTarget.parentElement.style.color = isBilled ? 'var(--success)' : 'var(--text-muted)';
                            if (app.views['project-details'] && app.views['project-details'].currentProjectId) {
                                app.views['project-details'].loadProjectDetails(app.views['project-details'].currentProjectId);
                            }
                        }
                    } catch (err) {
                        console.error('Update billed status in drilldown error', err);
                        ev.currentTarget.checked = !isBilled;
                    }
                });
            });

            listContainer.querySelectorAll('.btn-drilldown-edit-entry').forEach(btn => {
                btn.addEventListener('click', (ev) => {
                    const id = Number(ev.currentTarget.dataset.id);
                    if (app.views['project-details'] && app.views['project-details'].startEditEntry) {
                        app.views['project-details'].startEditEntry(id);
                    } else if (app.views['timer'] && app.views['timer'].startEditEntry) {
                        app.views['timer'].startEditEntry(id);
                    }
                });
            });

            listContainer.querySelectorAll('.btn-drilldown-delete-entry').forEach(btn => {
                btn.addEventListener('click', async (ev) => {
                    const id = Number(ev.currentTarget.dataset.id);
                    if (!confirm('確定要刪除這筆工時紀錄嗎？此動作無法復原。')) return;
                    try {
                        await db.delete('entries', id);
                        await app.refreshWbsDrilldownIfOpen();
                        if (app.views['project-details'] && app.views['project-details'].currentProjectId) {
                            await app.views['project-details'].loadProjectDetails(app.views['project-details'].currentProjectId);
                        }
                        if (app.views['dashboard'] && app.views['dashboard'].renderUniversalBenchmark) {
                            app.views['dashboard'].renderUniversalBenchmark();
                        }
                    } catch (err) {
                        console.error('Delete entry in drilldown error', err);
                        alert('刪除失敗：' + err.message);
                    }
                });
            });
        }

        // Footer Action
        if (projectId && (filterSubitemValue !== undefined)) {
            footerAction.innerHTML = `
                <button type="button" class="btn btn-secondary" id="btn-drilldown-filter-page" style="font-size: 0.82rem; color: var(--accent-primary); border-color: var(--accent-primary);">
                    🔍 在下方工時紀錄中篩選此項目
                </button>
            `;
            const filterPageBtn = document.getElementById('btn-drilldown-filter-page');
            if (filterPageBtn) {
                filterPageBtn.onclick = () => {
                    modal.classList.remove('active');
                    const subitemFilterEl = document.getElementById('filter-subitem');
                    if (subitemFilterEl && filterSubitemValue) {
                        if (subitemFilterEl.querySelector(`option[value="${filterSubitemValue}"]`)) {
                            subitemFilterEl.value = filterSubitemValue;
                        }
                    }
                    if (app.views['project-details'] && app.views['project-details'].renderImportedEntries) {
                        app.views['project-details'].renderImportedEntries(projectId);
                    }
                    const targetEl = document.getElementById('project-imported-entries');
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth' });
                    }
                };
            }
        } else {
            footerAction.innerHTML = '';
        }

        modal.classList.add('active');
    },

    refreshWbsDrilldownIfOpen: async () => {
        const modal = document.getElementById('wbs-drilldown-modal');
        if (!modal || !modal.classList.contains('active') || !app.currentDrilldownParams) return;

        const { natureKey, isRawMode, rawKey, projectId, isUniversal } = app.currentDrilldownParams;
        try {
            const allEntries = await db.getAll('entries');
            let updatedEntries = [];
            if (isUniversal) {
                updatedEntries = allEntries.filter(e => {
                    const nat = Utils.classifyWorkNature(e.subItem, e.description);
                    return nat.key === natureKey;
                });
            } else if (projectId) {
                const project = await db.get('projects', Number(projectId));
                const projectEntries = allEntries.filter(e => e.projectId === Number(projectId));
                if (isRawMode) {
                    updatedEntries = projectEntries.filter(e => {
                        const task = (e.subItem || '一般執行 / 未指定').trim();
                        return task === rawKey;
                    });
                } else {
                    updatedEntries = projectEntries.filter(e => {
                        const nat = Utils.classifyWorkNature(e.subItem, e.description, project ? project.subItems : null);
                        return nat.key === natureKey;
                    });
                }
            }
            app.currentDrilldownParams.entries = updatedEntries;
            await app.openWbsDrilldown(app.currentDrilldownParams);
        } catch (e) {
            console.error('Error refreshing drilldown modal', e);
        }
    },

    init: async () => {
        console.log('App initializing...');
        try {
            // Race db.init with a timeout to prevent hanging on blocked DB
            const dbInitPromise = db.init();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Database initialization timed out. Please close other tabs and reload.")), 3000)
            );

            await Promise.race([dbInitPromise, timeoutPromise]);

            app.router.init();
            if (app.views['dashboard'] && typeof app.views['dashboard'].bindModalEvents === 'function') {
                app.views['dashboard'].bindModalEvents();
            }
            if (typeof Icons !== 'undefined' && typeof Icons.replace === 'function') {
                Icons.replace();
            }
            console.log('App initialized successfully');
        } catch (e) {
            console.error("Initialization failed", e);
            alert("App failed to initialize: " + e.message);
        }
    }
};

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    const errText = (event.message || '') + '\n' + (event.error ? event.error.stack : '');
    db.add('settings', { key: 'error_' + Date.now(), value: errText }).catch(() => {});
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    const errText = String(event.reason) + '\n' + (event.reason ? event.reason.stack : '');
    db.add('settings', { key: 'rejection_' + Date.now(), value: errText }).catch(() => {});
});

document.addEventListener('DOMContentLoaded', app.init);
