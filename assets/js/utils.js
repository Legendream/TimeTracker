const Utils = {
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);
    },

    formatDuration: (ms) => {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)));

        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    },

    formatDate: (dateInput) => {
        const date = new Date(dateInput);
        return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
    },

    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    escapeHtml: (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    CATEGORIES: {
        commercial: { key: 'commercial', label: '商業委託', icon: '💼', color: '#2563eb' },
        pro_bono: { key: 'pro_bono', label: '公益奉獻', icon: '🌱', color: '#16a34a' },
        self_study: { key: 'self_study', label: '自修創作', icon: '💡', color: '#7c3aed' }
    },

    STATUSES: {
        bidding: { key: 'bidding', label: '提案/開拓中', icon: '💡', color: '#854d0e', bg: 'rgba(245, 158, 11, 0.12)' },
        active: { key: 'active', label: '執行中', icon: '🟢', color: '#15803d', bg: 'rgba(16, 185, 129, 0.12)' },
        pending_payment: { key: 'pending_payment', label: '待請款', icon: '⏳', color: '#c2410c', bg: 'rgba(234, 88, 12, 0.12)' },
        paid: { key: 'paid', label: '已收齊', icon: '✅', color: '#047857', bg: 'rgba(5, 150, 105, 0.12)' },
        closed: { key: 'closed', label: '已結案', icon: '📁', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' }
    },

    DEFAULT_WORK_NATURES: {
        'ai': { key: 'ai', label: 'AI Skill、Agent 與提示詞工程', icon: '🤖', color: '#06b6d4', keywords: 'ai, agent, skill, prompt, claude, gemini, vibe coding, sop, gpt, llm, ai 協作, 跟 ai, 讓 ai, 叫 ai, ai 改' },
        'research': { key: 'research', label: '桌面研究與資料研讀', icon: '🔍', color: '#0284c7', keywords: '研究, 閱讀, 查找, survey, 研讀, 收集, 找資料, 參考, 打聽, 探索, 了解, 瞭解, 桌面, paper, 文獻' },
        'interview': { key: 'interview', label: '專家訪談與訪綱設計', icon: '🎤', color: '#d97706', keywords: '訪談, 訪綱, 訪談筆記, 游擊訪談, 受訪, 詢問, 聊聊, 電訪' },
        'writing': { key: 'writing', label: '撰寫、文稿與內容產出', icon: '✍️', color: '#7c3aed', keywords: '寫, 撰寫, 改稿, 文案, 修稿, 短文, 產出, 文章, 編輯, 修改, 潤飾, 手冊, 指引, 翻譯, 草稿, 章節, 筆記' },
        'analysis': { key: 'analysis', label: '問卷設計與資料分析', icon: '📊', color: '#2563eb', keywords: '問卷, 分析, raw data, 統計, 整理問卷, 數據, 圖表, insight, 量化, 質化' },
        'workshop': { key: 'workshop', label: '工作坊與培訓活動', icon: '🎯', color: '#ea580c', keywords: '工作坊, 共識營, 黑客松, 國會松, 講座, 演講, 培訓, 課程, 帶領, 活動主持, 議程, workshop' },
        'meeting': { key: 'meeting', label: '會議、對齊與溝通', icon: '👥', color: '#059669', keywords: '會議, 討論, sync, meeting, kick-off, 對齊, 溝通, 開會, 線上會, slack, 通話, review' },
        'pm': { key: 'pm', label: '專案管理、報價與行政', icon: '💼', color: '#4f46e5', keywords: 'pm, 報價, 排程, 規劃, 進度, 驗收, 請款, 合約, 交接, 行政, 時程, 發包, 議價, 提案, sbir, 招標, 投標' },
        'dev': { key: 'dev', label: '架構規劃與設計實作', icon: '🛠️', color: '#db2777', keywords: 'sitemap, 架構, wireframe, 設計, 開發, 程式, 網站, tool, kiosk, 工具, 選題' },
        'other': { key: 'other', label: '一般執行與其他', icon: '📌', color: '#64748b', keywords: '' }
    },

    WORK_NATURES: {},

    initTaxonomy: async () => {
        let stored = null;
        try {
            if (typeof db !== 'undefined' && db.get) {
                const setting = await db.get('settings', 'customWorkNatures');
                if (setting && setting.value) {
                    stored = setting.value;
                }
            }
        } catch (e) {
            console.error("Error loading custom taxonomy settings", e);
        }

        const source = stored || Utils.DEFAULT_WORK_NATURES;
        Utils.WORK_NATURES = {};
        for (const [key, item] of Object.entries(source)) {
            const kwList = (item.keywords || '').split(/[,，]/).map(k => k.trim()).filter(Boolean);
            const patterns = kwList.map(k => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
            Utils.WORK_NATURES[key] = {
                key: item.key || key,
                label: item.label,
                icon: item.icon || '🏷️',
                color: item.color || '#64748b',
                keywords: item.keywords || '',
                patterns
            };
        }
        if (!Utils.WORK_NATURES['other']) {
            Utils.WORK_NATURES['other'] = { key: 'other', label: '一般執行與其他', icon: '📌', color: '#64748b', keywords: '', patterns: [] };
        }
    },

    classifyWorkNature: (subItem, description, projectSubItems) => {
        const text = `${subItem || ''} ${description || ''}`;

        // 1. Check if matches any custom subItems defined on the project
        if (projectSubItems && Array.isArray(projectSubItems) && projectSubItems.length > 0) {
            const s = (subItem || '').trim().toLowerCase();
            for (const customItem of projectSubItems) {
                if (s && s === customItem.trim().toLowerCase()) {
                    return {
                        key: `custom_${customItem}`,
                        label: customItem,
                        icon: '🏷️',
                        color: 'var(--accent-primary)',
                        isCustom: true
                    };
                }
            }
        }

        // 2. Check standard / custom global natures
        for (const [key, nature] of Object.entries(Utils.WORK_NATURES)) {
            if (key === 'other') continue;
            for (const pat of (nature.patterns || [])) {
                if (pat.test(text)) {
                    return nature;
                }
            }
        }
        return Utils.WORK_NATURES.other || Utils.DEFAULT_WORK_NATURES.other;
    },

    BILLING_TYPES: {
        fixed: { key: 'fixed', label: '專案固定金額 / 分潤', icon: '💼', color: '#2563eb', desc: '不計時數，由合約總額固定結算' },
        hourly: { key: 'hourly', label: '計時發薪 / 月結回報', icon: '⏱️', color: '#10b981', desc: '依實際投入工時回報計費' }
    },

    getCategoryInfo: (catKey) => {
        if (!catKey) return Utils.CATEGORIES.commercial;
        if (catKey === 'paid') return Utils.CATEGORIES.commercial;
        return Utils.CATEGORIES[catKey] || Utils.CATEGORIES.commercial;
    },

    getStatusInfo: (statusKey) => {
        if (!statusKey) return Utils.STATUSES.active;
        return Utils.STATUSES[statusKey] || Utils.STATUSES.active;
    },

    getBillingTypeInfo: (typeKey) => {
        if (!typeKey) return Utils.BILLING_TYPES.hourly;
        return Utils.BILLING_TYPES[typeKey] || Utils.BILLING_TYPES.hourly;
    },

    /**
     * 專案專屬動態分析：從本專案的工時紀錄與描述中，動態提煉最貼切的主題聚類
     */
    extractProjectDynamicThemes: (entries, projectSubItems) => {
        if (!entries || entries.length === 0) return [];

        const themeMap = {};
        const palette = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2', '#ea580c', '#4f46e5', '#64748b'];
        let colorIdx = 0;

        const getThemeBucket = (key, name, icon) => {
            if (!themeMap[key]) {
                const color = palette[colorIdx % palette.length];
                colorIdx++;
                themeMap[key] = {
                    key: key,
                    name: `${icon || '🏷️'} ${name}`,
                    cleanName: name,
                    color: color,
                    hours: 0,
                    count: 0,
                    entries: []
                };
            }
            return themeMap[key];
        };

        // Standard task pattern detectors for dynamic grouping
        const detectors = [
            { key: 'sitemap', name: 'Sitemap 與流程規劃', icon: '🗺️', test: /sitemap|user flow|流程|介面/i },
            { key: 'interview', name: '訪談、調研與營站探訪', icon: '🎤', test: /訪談|營站|受訪|訪綱|電訪|交流/i },
            { key: 'usecase_deck', name: 'Use Case、簡報與產出', icon: '📊', test: /use case|簡報|deck|ppt|痛點/i },
            { key: 'usability_test', name: '易用性測試與分析報告', icon: '🧪', test: /易用性|測試|驗證|user test/i },
            { key: 'survey', name: '問卷設計與數據分析', icon: '📋', test: /問卷|統計|分析|raw data/i },
            { key: 'wireframe', name: 'Wireframe 與設計審查', icon: '📐', test: /wireframe|設計|原型|prototype/i },
            { key: 'ai_tool', name: 'AI 協作、Prompt 與工具開發', icon: '🤖', test: /prompt|claude|gemini|gpt|ai/i },
            { key: 'writing', name: '文案撰寫、手冊與指引', icon: '✍️', test: /撰寫|文稿|手冊|指引|改稿|修稿|翻譯|筆記/i },
            { key: 'workshop', name: '工作坊籌備與現場引導', icon: '🎯', test: /工作坊|共識營|便利貼|細流|場佈/i },
            { key: 'meeting_sync', name: '會議溝通、Kick-off 與對齊', icon: '👥', test: /會議|開會|sync|kick[- ]off|討論|對齊|月會|review/i },
            { key: 'pm_dispatch', name: '派工、行政管理與進度安排', icon: '💼', test: /派工|行政|進度|合約|報價|排程|工時整理|實習生/i }
        ];

        entries.forEach(e => {
            const s = (e.subItem || '').trim();
            const d = (e.description || '').trim();
            const fullText = `${s} ${d}`;
            const hours = Number(e.hours || 0);

            let matched = false;

            // 1. Check if description has explicit brackets e.g. [SYNC], [大副業], [品汝]
            const bracketMatch = d.match(/^\[([^\]]+)\]/);
            if (bracketMatch && bracketMatch[1] && bracketMatch[1].length <= 12) {
                const tag = bracketMatch[1].trim();
                const bucket = getThemeBucket(`tag_${tag}`, tag, '🏷️');
                bucket.hours += hours;
                bucket.count += 1;
                bucket.entries.push(e);
                matched = true;
                return;
            }

            // 2. Check if subItem is explicitly set and meaningful
            if (s && s !== '未指定' && s !== '一般執行' && s !== '一般工時' && s !== '工作計時') {
                const bucket = getThemeBucket(`sub_${s}`, s, '🏷️');
                bucket.hours += hours;
                bucket.count += 1;
                bucket.entries.push(e);
                matched = true;
                return;
            }

            // 3. Match against dynamic detectors
            for (const detector of detectors) {
                if (detector.test.test(fullText)) {
                    const bucket = getThemeBucket(detector.key, detector.name, detector.icon);
                    bucket.hours += hours;
                    bucket.count += 1;
                    bucket.entries.push(e);
                    matched = true;
                    break;
                }
            }

            // 4. Fallback for unclassified entries
            if (!matched) {
                const bucket = getThemeBucket('unclassified', '一般執行與日常計時', '📌');
                bucket.hours += hours;
                bucket.count += 1;
                bucket.entries.push(e);
            }
        });

        return Object.values(themeMap).sort((a, b) => b.hours - a.hours);
    },

    DEFAULT_HOURLY_RATE: 750,

    /**
     * 從專案與收入資料庫中動態提取所有不重複的客戶/發款組織名稱
     * @param {Array} projects 
     * @param {Array} revenues 
     * @returns {Array<string>} 排序後的客戶名稱清單
     */
    extractUniqueClients: (projects = [], revenues = []) => {
        const clientSet = new Set();
        (projects || []).forEach(p => {
            const c = (p.client || '').trim();
            if (c) clientSet.add(c);
        });
        (revenues || []).forEach(r => {
            const org = (r.organization || '').trim();
            if (org) clientSet.add(org);
        });
        return Array.from(clientSet).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    },

    /**
     * 全站統一專案選單生成器 (Single Source of Truth)
     * 動態根據使用者建立的客戶、類別與狀態進行專業分組
     * @param {Array} projects 專案列表
     * @param {Object} options { showClosed: boolean, placeholder: string, selectedId: number|string }
     */
    buildStandardProjectOptions: (projects, options = {}) => {
        if (!projects || projects.length === 0) {
            return `<option value="">${options.placeholder || '暫無專案'}</option>`;
        }

        const showClosed = options.showClosed !== undefined ? options.showClosed : true;
        const placeholder = options.placeholder !== undefined ? options.placeholder : '請選擇專案...';

        // 1. Group active projects by Client and Category
        const clientGroups = {}; // clientName -> array of projects
        const unassignedCommercial = [];
        const nonProfitAndSelf = [];
        const closedProjects = [];

        projects.forEach(p => {
            const isClosed = p.status === 'closed';
            if (isClosed) {
                if (showClosed) closedProjects.push(p);
                return;
            }

            const client = (p.client || '').trim();
            const isCommercial = p.category === 'commercial' || p.category === 'paid' || (!p.category && client);

            if (client) {
                if (!clientGroups[client]) clientGroups[client] = [];
                clientGroups[client].push(p);
            } else if (isCommercial) {
                unassignedCommercial.push(p);
            } else {
                nonProfitAndSelf.push(p);
            }
        });

        // Sorters
        const sortByName = (a, b) => a.name.localeCompare(b.name, 'zh-Hant');
        Object.keys(clientGroups).forEach(k => clientGroups[k].sort(sortByName));
        unassignedCommercial.sort(sortByName);
        nonProfitAndSelf.sort(sortByName);
        closedProjects.sort(sortByName);

        const makeOption = (p) => {
            const clientStr = p.client ? `[${p.client}] ` : '';
            const billingBadge = p.billingType === 'fixed' ? ' 💼 (固定)' : ` ⏱️ ($${Utils.DEFAULT_HOURLY_RATE}/h)`;
            const closedSuffix = p.status === 'closed' ? ' [已結案]' : '';
            return `<option value="${p.id}">${Utils.escapeHtml(clientStr + p.name + billingBadge + closedSuffix)}</option>`;
        };

        let html = '';
        if (placeholder !== null) {
            html += `<option value="">${placeholder}</option>`;
        }

        // Sort client groups by count of projects descending, then alphabetically
        const sortedClientNames = Object.keys(clientGroups).sort((a, b) => {
            if (clientGroups[b].length !== clientGroups[a].length) {
                return clientGroups[b].length - clientGroups[a].length;
            }
            return a.localeCompare(b, 'zh-Hant');
        });

        sortedClientNames.forEach(clientName => {
            const list = clientGroups[clientName];
            html += `<optgroup label="🏢 ${Utils.escapeHtml(clientName)} (${list.length} 個專案)">${list.map(makeOption).join('')}</optgroup>`;
        });

        if (unassignedCommercial.length > 0) {
            html += `<optgroup label="💼 商業委託專案">${unassignedCommercial.map(makeOption).join('')}</optgroup>`;
        }
        if (nonProfitAndSelf.length > 0) {
            html += `<optgroup label="🌱 公益奉獻 / 探索 / 自修創作">${nonProfitAndSelf.map(makeOption).join('')}</optgroup>`;
        }
        if (closedProjects.length > 0) {
            html += `<optgroup label="📁 已結案歷史專案">${closedProjects.map(makeOption).join('')}</optgroup>`;
        }

        return html;
    },

    /**
     * 計算單一專案的標準統計數據 (工時、產值、已收、尾款、實質時薪)
     */
    calcProjectStats: (project, entries = [], revenues = [], defaultRate = Utils.DEFAULT_HOURLY_RATE) => {
        const pid = Number(project.id);
        const pEntries = entries.filter(e => Number(e.projectId) === pid);
        const pRevenues = revenues.filter(r => Number(r.projectId) === pid);

        const hours = pEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
        const totalReceived = pRevenues.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const budget = Number(project.revenue || 0);

        const isHourly = project.billingType === 'hourly';
        const isFixed = project.billingType === 'fixed';

        const estimatedValue = isHourly ? Math.round(hours * defaultRate) : totalReceived;
        const unpaid = isFixed ? Math.max(0, budget - totalReceived) : 0;
        const effectiveRate = hours > 0 && totalReceived > 0 ? Math.round(totalReceived / hours) : (isHourly ? defaultRate : 0);
        const progress = budget > 0 ? Math.min(100, Math.round((totalReceived / budget) * 100)) : (totalReceived > 0 ? 100 : 0);

        return {
            hours,
            budget,
            totalReceived,
            unpaid,
            estimatedValue,
            effectiveRate,
            isHourly,
            isFixed,
            progress,
            entryCount: pEntries.length,
            revenueCount: pRevenues.length
        };
    },

    /**
     * 歷史專案工時與報價估算引擎（為未來「報價單與估價模組」預留標準介面）
     * @param {Object} query { category, natureKey, keywords }
     * @param {Array} projects 
     * @param {Array} entries 
     */
    estimateHistoricalPricing: (query = {}, projects = [], entries = []) => {
        const { category, natureKey, keywords } = query;
        let matchedEntries = entries;

        if (natureKey) {
            matchedEntries = matchedEntries.filter(e => {
                const nature = Utils.classifyWorkNature(e.subItem, e.description);
                return nature.key === natureKey;
            });
        }

        if (keywords) {
            const kw = keywords.toLowerCase();
            matchedEntries = matchedEntries.filter(e => 
                (e.description || '').toLowerCase().includes(kw) || 
                (e.subItem || '').toLowerCase().includes(kw)
            );
        }

        const totalHours = matchedEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
        const avgHoursPerTask = matchedEntries.length > 0 ? (totalHours / matchedEntries.length).toFixed(1) : 0;
        const suggestedRate = Utils.DEFAULT_HOURLY_RATE;

        return {
            sampleCount: matchedEntries.length,
            totalHistoricalHours: totalHours,
            avgHoursPerTask: Number(avgHoursPerTask),
            suggestedHourlyRate: suggestedRate,
            estimatedBudget: Math.round(totalHours * suggestedRate)
        };
    }
};

// Immediate initialize defaults
Utils.initTaxonomy();

