/**
 * WorkTime Pro - Custom Select Component (MIT License)
 * 100% Vanilla JS, 零外部依賴
 * 提供深藍色塊客戶母階層、自訂計費標籤、即時搜尋與無障礙操作
 */

const CustomSelect = {
    instances: new Map(),

    /**
     * 將指定的原生 <select> 增強為自訂 UI 下拉選單
     * @param {HTMLSelectElement|string} target Select 元素或選擇器
     * @param {Object} options 選項設定
     */
    enhance: (target, options = {}) => {
        const select = typeof target === 'string' ? document.querySelector(target) : target;
        if (!select || select.tagName !== 'SELECT') return null;

        // 若已初始化過，直接觸發同步更新
        if (CustomSelect.instances.has(select)) {
            CustomSelect.sync(select);
            return CustomSelect.instances.get(select);
        }

        // 建立 Custom Select UI 結構
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper ' + (options.className || '');
        if (select.id) wrapper.setAttribute('data-for-select', select.id);

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const triggerContent = document.createElement('div');
        triggerContent.className = 'custom-select-trigger-content';

        const triggerLabel = document.createElement('span');
        triggerLabel.className = 'custom-select-trigger-label';
        triggerLabel.innerText = select.options[select.selectedIndex]?.text || '請選擇...';

        const arrow = document.createElement('span');
        arrow.className = 'custom-select-arrow';
        arrow.innerHTML = '▾';

        triggerContent.appendChild(triggerLabel);
        trigger.appendChild(triggerContent);
        trigger.appendChild(arrow);

        const dropdown = document.createElement('div');
        dropdown.className = 'custom-select-dropdown';

        // 搜尋框 (當選項數量超過 5 個時預設顯示)
        const searchBox = document.createElement('div');
        searchBox.className = 'custom-select-search-box';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'custom-select-search-input';
        searchInput.placeholder = '搜尋專案名稱、客戶...';
        searchInput.autocomplete = 'off';
        searchBox.appendChild(searchInput);
        dropdown.appendChild(searchBox);

        const optionsList = document.createElement('div');
        optionsList.className = 'custom-select-options-list';
        dropdown.appendChild(optionsList);

        // 插入 DOM：將 wrapper 放在 select 原本位置，隱藏原生 select
        select.style.display = 'none';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        wrapper.appendChild(trigger);
        wrapper.appendChild(dropdown);

        const instance = {
            select,
            wrapper,
            trigger,
            triggerLabel,
            dropdown,
            searchInput,
            optionsList,
            isOpen: false
        };

        CustomSelect.instances.set(select, instance);

        // 事件監聽：點擊觸發展開/收合
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (instance.isOpen) {
                CustomSelect.close(instance);
            } else {
                CustomSelect.open(instance);
            }
        });

        // 搜尋過濾
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            CustomSelect.filterOptions(instance, query);
        });

        searchInput.addEventListener('click', (e) => e.stopPropagation());

        // 監聽原生 Select 的變化
        select.addEventListener('change', () => {
            CustomSelect.updateTrigger(instance);
            CustomSelect.highlightSelectedOption(instance);
        });

        // 監聽 DOM 變更 (當 select.innerHTML 被重新賦值或 disabled 狀態改變時自動更新)
        const observer = new MutationObserver(() => {
            CustomSelect.renderOptions(instance);
            CustomSelect.updateTrigger(instance);
            CustomSelect.highlightSelectedOption(instance);
        });
        observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
        instance.observer = observer;

        // 初始渲染選項
        CustomSelect.renderOptions(instance);
        CustomSelect.updateTrigger(instance);

        return instance;
    },

    /**
     * 展開下拉選單
     */
    open: (instance) => {
        // 先關閉其他所有下拉選單
        CustomSelect.closeAll();

        instance.isOpen = true;
        instance.wrapper.classList.add('is-open');
        instance.trigger.setAttribute('aria-expanded', 'true');
        
        // 重置搜尋並聚焦
        if (instance.searchInput) {
            instance.searchInput.value = '';
            CustomSelect.filterOptions(instance, '');
            setTimeout(() => instance.searchInput.focus(), 50);
        }

        CustomSelect.highlightSelectedOption(instance);

        // 捲動到選中項目
        const selectedEl = instance.optionsList.querySelector('.custom-select-option.is-selected');
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    },

    /**
     * 收合下拉選單
     */
    close: (instance) => {
        instance.isOpen = false;
        instance.wrapper.classList.remove('is-open');
        instance.trigger.setAttribute('aria-expanded', 'false');
    },

    /**
     * 收合全站所有 CustomSelect 下拉選單
     */
    closeAll: () => {
        CustomSelect.instances.forEach((inst) => {
            if (inst.isOpen) CustomSelect.close(inst);
        });
    },

    /**
     * 同步更新下拉選單內容
     */
    sync: (select) => {
        const inst = CustomSelect.instances.get(select);
        if (inst) {
            CustomSelect.renderOptions(inst);
            CustomSelect.updateTrigger(inst);
        }
    },

    /**
     * 依據原生 select 的結構渲染自訂選項
     */
    renderOptions: (instance) => {
        const select = instance.select;
        const list = instance.optionsList;
        list.innerHTML = '';

        let totalOptionsCount = 0;

        // 逐一解析 select 的 children (optgroup 或 option)
        Array.from(select.children).forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const groupEl = document.createElement('div');
                groupEl.className = 'custom-select-group';

                const header = document.createElement('div');
                header.className = 'custom-select-group-header';

                const rawLabel = child.getAttribute('label') || '';
                
                // 解析群組名稱與數量
                let groupTitleText = rawLabel;
                let countText = '';
                
                // 嘗試提取括號中的專案數
                const countMatch = rawLabel.match(/\(([^)]+)\)/);
                if (countMatch) {
                    countText = countMatch[1];
                    // 移除符號與計數部分取得純標題
                    groupTitleText = rawLabel.replace(/\([^)]+\)/, '').replace(/^[🏢💼🌱📁\s═【】─]+/, '').replace(/[═【】─\s]+$/, '').trim();
                    const icon = typeof Icons !== 'undefined' ? Icons.render('building', { size: 14 }) + ' ' : '';
                    groupTitleText = icon + groupTitleText;
                }

                const titleEl = document.createElement('div');
                titleEl.className = 'custom-select-group-title';
                titleEl.innerHTML = groupTitleText;

                header.appendChild(titleEl);

                if (countText) {
                    const badgeEl = document.createElement('span');
                    badgeEl.className = 'custom-select-group-badge';
                    badgeEl.innerText = countText;
                    header.appendChild(badgeEl);
                }

                groupEl.appendChild(header);

                // 渲染 group 內的 options
                Array.from(child.children).forEach(opt => {
                    if (opt.tagName === 'OPTION') {
                        totalOptionsCount++;
                        const optEl = CustomSelect.createOptionElement(instance, opt, true);
                        groupEl.appendChild(optEl);
                    }
                });

                list.appendChild(groupEl);
            } else if (child.tagName === 'OPTION') {
                totalOptionsCount++;
                const optEl = CustomSelect.createOptionElement(instance, child, false);
                list.appendChild(optEl);
            }
        });

        // 若選項少於 4 個，隱藏搜尋框
        const searchBox = instance.dropdown.querySelector('.custom-select-search-box');
        if (searchBox) {
            searchBox.style.display = totalOptionsCount > 5 ? 'block' : 'none';
        }
    },

    /**
     * 建立單一 Option DOM 元素
     */
    createOptionElement: (instance, option, isInsideGroup) => {
        const item = document.createElement('div');
        item.className = 'custom-select-option' + (isInsideGroup ? ' is-child' : '');
        item.setAttribute('data-value', option.value);

        if (option.disabled) {
            item.classList.add('is-disabled');
        }

        const rawText = option.text.replace(/^[&nbsp;\s↳•·]+/, '').trim();

        // 解析計費與結案標籤
        let cleanText = rawText;
        let badgeHtml = '';

        if (cleanText.includes('💼 (固定)') || cleanText.includes('(固定)')) {
            cleanText = cleanText.replace('💼 (固定)', '').replace('(固定)', '').trim();
            badgeHtml += '<span class="custom-select-tag tag-fixed">固定</span>';
        } else if (cleanText.includes('⏱️') || cleanText.includes('/h')) {
            const matchRate = cleanText.match(/\(?\$?([^/]+)\/h\)?/);
            const rateStr = matchRate ? `$${matchRate[1]}/h` : '計時';
            cleanText = cleanText.replace(/⏱️\s*\([^)]+\)/, '').replace(/\([^)]+\/h\)/, '').trim();
            badgeHtml += `<span class="custom-select-tag tag-hourly">${rateStr}</span>`;
        }

        if (cleanText.includes('[已結案]')) {
            cleanText = cleanText.replace('[已結案]', '').trim();
            badgeHtml += '<span class="custom-select-tag tag-closed">已結案</span>';
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'custom-select-option-name';
        nameSpan.innerText = cleanText;
        item.appendChild(nameSpan);

        if (badgeHtml) {
            const badgesWrap = document.createElement('div');
            badgesWrap.className = 'custom-select-option-badges';
            badgesWrap.innerHTML = badgeHtml;
            item.appendChild(badgesWrap);
        }

        // 點擊選取
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (option.disabled) return;

            instance.select.value = option.value;
            instance.select.dispatchEvent(new Event('change', { bubbles: true }));
            instance.select.dispatchEvent(new Event('input', { bubbles: true }));
            CustomSelect.updateTrigger(instance);
            CustomSelect.close(instance);
        });

        return item;
    },

    /**
     * 更新 Trigger 顯示文字
     */
    updateTrigger: (instance) => {
        const select = instance.select;

        // 同步 disabled 狀態
        if (select.disabled) {
            instance.trigger.disabled = true;
            instance.wrapper.classList.add('is-disabled');
        } else {
            instance.trigger.disabled = false;
            instance.wrapper.classList.remove('is-disabled');
        }

        const selectedOpt = select.options[select.selectedIndex];
        if (!selectedOpt || selectedOpt.value === '') {
            instance.triggerLabel.innerText = selectedOpt?.text || '請選擇專案...';
            instance.triggerLabel.style.color = 'var(--text-muted)';
            return;
        }

        instance.triggerLabel.style.color = 'var(--text-primary)';
        const rawText = selectedOpt.text.replace(/^[&nbsp;\s↳•·]+/, '').trim();
        instance.triggerLabel.innerText = rawText;
    },

    /**
     * 標記當前選中項目的 active 樣式
     */
    highlightSelectedOption: (instance) => {
        const val = String(instance.select.value);
        const options = instance.optionsList.querySelectorAll('.custom-select-option');
        options.forEach(opt => {
            if (opt.getAttribute('data-value') === val) {
                opt.classList.add('is-selected');
            } else {
                opt.classList.remove('is-selected');
            }
        });
    },

    /**
     * 依搜尋關鍵字即時過濾選項
     */
    filterOptions: (instance, query) => {
        const groups = instance.optionsList.querySelectorAll('.custom-select-group');
        let hasAnyMatch = false;

        groups.forEach(group => {
            const groupHeader = group.querySelector('.custom-select-group-header');
            const groupText = groupHeader ? groupHeader.innerText.toLowerCase() : '';
            const options = group.querySelectorAll('.custom-select-option');
            let groupMatchedCount = 0;

            options.forEach(opt => {
                const optText = opt.innerText.toLowerCase();
                if (!query || optText.includes(query) || groupText.includes(query)) {
                    opt.style.display = 'flex';
                    groupMatchedCount++;
                    hasAnyMatch = true;
                } else {
                    opt.style.display = 'none';
                }
            });

            // 若整組沒有任何符合的項目，隱藏該群組
            if (groupMatchedCount > 0) {
                group.style.display = 'block';
            } else {
                group.style.display = 'none';
            }
        });

        // 處理非群組內的單獨 options (如請選擇專案...)
        const standaloneOptions = instance.optionsList.querySelectorAll(':scope > .custom-select-option');
        standaloneOptions.forEach(opt => {
            const text = opt.innerText.toLowerCase();
            if (!query || text.includes(query)) {
                opt.style.display = 'flex';
                hasAnyMatch = true;
            } else {
                opt.style.display = 'none';
            }
        });
    }
};

// 全域監聽：點擊選單外部自動關閉
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
        CustomSelect.closeAll();
    }
});

// 全域監聽：按下 Escape 鍵關閉
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        CustomSelect.closeAll();
    }
});

// 匯出全域物件
window.CustomSelect = CustomSelect;
