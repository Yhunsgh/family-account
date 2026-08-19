/**
 * ================================================================
 *  家庭账本应用 - 主脚本（v0.56 优化版 - 移除缓存、修复清除逻辑）
 *  优化：移除列表/统计缓存、修复清空日期、移除多余渲染调用
 * ================================================================
 */

// ================================================================
//  1.  Firebase 全局变量（由 firebase.js 注入）
// ================================================================

// ================================================================
//  2.  应用状态
// ================================================================
const state = {
    currentPerson: null,
    members: [],
    records: { income: [], family: [], debt: [] },
    dates: { income: null, family: null, debt: null },
    selectedDebtId: null,
    repaymentSearchKeyword: '',

    displayLimit: { income: 20, family: 20, debt: 20 },
    _renderScheduled: false,
    _submitting: false,  // 提交锁，防止连点
};

// ================================================================
//  3.  DOM 引用
// ================================================================
const $ = (sel) => document.querySelector(sel);

const personSelector = $('#personSelector');
const manageMemberBtn = $('#manageMemberBtn');
const memberModal = $('#memberModal');
const memberModalClose = $('#memberModalClose');
const memberList = $('#memberList');
const newMemberInput = $('#newMemberInput');
const addMemberBtn = $('#addMemberBtn');

const domMap = {
    income: {
        amt: $('#incomeAmt'),
        goods: $('#goodsAmt'),
        note: $('#noteInput'),
        submit: $('#submitBtn'),
        statsContainer: $('#incomeStatsContainer'),
        recordList: $('#incomeRecordList'),
        dateInput: $('#incomeDate'),
        clearBtn: $('#clearIncomeBtn'),
        globalStats: $('#incomeGlobalStats'),
    },
    family: {
        amt: $('#personalExpense'),
        goods: null,
        note: $('#familyNote'),
        submit: $('#familySubmitBtn'),
        statsContainer: $('#familyStatsContainer'),
        recordList: $('#familyRecordList'),
        dateInput: $('#familyDate'),
        clearBtn: $('#clearFamilyBtn'),
        globalStats: $('#familyGlobalStats'),
    },
    debt: {
        amt: $('#debtAmount'),
        goods: $('#debtGoodsAmount'),
        note: $('#debtNote'),
        submit: $('#debtSubmitBtn'),
        statsContainer: $('#debtStatsContainer'),
        recordList: $('#debtRecordList'),
        dateInput: $('#debtDate'),
        clearBtn: $('#clearDebtBtn'),
        globalStats: $('#debtGlobalStats'),
    }
};

const repaymentAmount = $('#repaymentAmount');
const repaymentType = $('#repaymentType');
const repaymentSearch = $('#repaymentSearch');
const repaymentResults = $('#repaymentResults');
const repaymentSubmitBtn = $('#repaymentSubmitBtn');
const refreshBtn = $('#refreshBtn');

// ================================================================
//  4.  常量 & 工具函数
// ================================================================
const MODULE_KEYS = ['income', 'family', 'debt'];
const MODULE_LABELS = { income: '账本', family: '支出', debt: '债务' };

/**
 * 模块元数据配置（统一维护）
 * 包含：数据库路径、字段定义、DOM 键名、成功回调等
 */
const MODULE_META = {
    income: {
        path: 'familyRecords',
        label: '账本',
        fields: [
            { key: 'income', label: '收入', class: 'income', domKey: 'amt' },
            { key: 'goods', label: '货款', class: 'goods', domKey: 'goods' }
        ],
        noteDomKey: 'note',
        submitDomKey: 'submit',
        onSuccess: (dom) => {
            dom.amt.value = '';
            dom.goods.value = '';
            dom.note.value = '';
            dom.amt.focus();
        },
        statsContainerKey: 'statsContainer',
        recordListKey: 'recordList',
        dateInputKey: 'dateInput',
        clearBtnKey: 'clearBtn',
        globalStatsKey: 'globalStats',
        showDetails: true,
    },
    family: {
        path: 'familyExpenses',
        label: '支出',
        fields: [
            { key: 'personalExpense', label: '支出', class: 'cost', domKey: 'amt' }
        ],
        noteDomKey: 'note',
        submitDomKey: 'submit',
        onSuccess: (dom) => {
            dom.amt.value = '';
            dom.note.value = '';
            dom.amt.focus();
        },
        statsContainerKey: 'statsContainer',
        recordListKey: 'recordList',
        dateInputKey: 'dateInput',
        clearBtnKey: 'clearBtn',
        globalStatsKey: 'globalStats',
        showDetails: true,
    },
    debt: {
        path: 'debtRecords',
        label: '债务',
        fields: [
            { key: 'amount', label: '欠款', class: 'cost', domKey: 'amt' },
            { key: 'goodsAmount', label: '货款欠款', class: 'goods', domKey: 'goods' }
        ],
        noteDomKey: 'note',
        submitDomKey: 'submit',
        onSuccess: (dom) => {
            dom.amt.value = '';
            dom.goods.value = '';
            dom.note.value = '';
            dom.amt.focus();
        },
        statsContainerKey: 'statsContainer',
        recordListKey: 'recordList',
        dateInputKey: 'dateInput',
        clearBtnKey: 'clearBtn',
        globalStatsKey: 'globalStats',
        showDetails: false,  // 债务模块明细中不显示详细条目
    }
};

/** 获取记录的日期（优先使用 date 字段，否则从 createdAt 提取本地日期） */
function getRecordDate(record) {
    if (record.date) return record.date;
    const ts = record.createdAt || 0;
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** 通用排序：按日期倒序，日期相同按创建时间倒序 */
function sortRecordsByDate(records) {
    return [...records].sort((a, b) => {
        const dateA = getRecordDate(a);
        const dateB = getRecordDate(b);
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth()+1}月${d.getDate()}日`;
}

function formatTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function toFixed(v) { return Number(v).toFixed(2); }

function showToast(msg, duration = 2000) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

function getTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getMonthKey(dateStr) {
    const d = new Date(dateStr);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getCurrentMonthKey() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

// ================================================================
//  5.  人员管理
// ================================================================
function watchMembers() {
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    db.ref('members').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            db.ref('members').push('刘力伟');
            db.ref('members').push('郑少容');
            return;
        }
        const members = Object.values(data).filter(v => typeof v === 'string' && v.trim() !== '');
        state.members = members;
        if (!state.currentPerson || !members.includes(state.currentPerson)) {
            if (members.includes('郑少容')) {
                state.currentPerson = '郑少容';
            } else {
                state.currentPerson = members.length > 0 ? members[0] : null;
            }
        }
        renderPersonButtons();
        renderAll(); // 包含 renderRepaymentResults
    }, (err) => {
        console.error('读取 members 失败:', err);
        showToast('读取成员列表失败');
    });
}

function renderPersonButtons() {
    const members = state.members;
    if (!members || members.length === 0) {
        personSelector.innerHTML = '<div class="empty-state">暂无成员，请添加</div>';
        return;
    }
    let html = '';
    members.forEach(name => {
        const active = (name === state.currentPerson) ? 'active' : '';
        html += `<button class="person-btn ${active}" data-person="${name}">${name}</button>`;
    });
    personSelector.innerHTML = html;
    personSelector.querySelectorAll('.person-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            personSelector.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.currentPerson = this.dataset.person;
            renderAll();
        });
    });
}

manageMemberBtn.addEventListener('click', function() {
    renderMemberList();
    memberModal.classList.add('active');
});
memberModalClose.addEventListener('click', function() {
    memberModal.classList.remove('active');
});
memberModal.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('active');
});

function renderMemberList() {
    const members = state.members;
    if (!members || members.length === 0) {
        memberList.innerHTML = '<div class="empty-state">暂无成员</div>';
        return;
    }
    let html = '';
    members.forEach(name => {
        html += `
            <div class="member-item">
                <span class="name">${name}</span>
                <button class="del-member-btn" data-name="${name}">✕</button>
            </div>
        `;
    });
    memberList.innerHTML = html;
    memberList.querySelectorAll('.del-member-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const name = this.dataset.name;
            if (!confirm(`确定删除成员“${name}”吗？\n该成员的所有记录将被永久删除！`)) return;

            // 删除 members 节点中的该成员
            db.ref('members').orderByValue().equalTo(name).once('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const key = Object.keys(data)[0];
                    db.ref('members/' + key).remove()
                        .then(() => {
                            showToast(`已删除成员 ${name}`);
                            if (state.currentPerson === name) {
                                state.currentPerson = state.members.length > 0 ? state.members[0] : null;
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            showToast('删除成员失败');
                        });
                }
            });

            // 级联清理：所有数据表 + 还款历史
            const paths = ['familyRecords', 'familyExpenses', 'debtRecords', 'repaymentHistory'];
            paths.forEach(path => {
                db.ref(path).orderByChild('person').equalTo(name).once('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        Object.keys(data).forEach(key => {
                            db.ref(`${path}/${key}`).remove().catch(err => {
                                console.error(`删除 ${path}/${key} 失败:`, err);
                            });
                        });
                    }
                });
            });
        });
    });
}

addMemberBtn.addEventListener('click', function() {
    const name = newMemberInput.value.trim();
    if (!name) { showToast('请输入姓名'); return; }
    if (state.members.includes(name)) { showToast('成员已存在'); return; }
    db.ref('members').push(name)
        .then(() => {
            showToast(`已添加成员 ${name}`);
            newMemberInput.value = '';
        })
        .catch(err => {
            console.error(err);
            showToast('添加失败');
        });
});
newMemberInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addMemberBtn.click();
});

// ================================================================
//  6.  渲染函数（移除缓存，直接渲染）
// ================================================================
function renderGlobalStats(moduleKey) {
    const records = state.records[moduleKey] || [];
    const container = domMap[moduleKey].globalStats;
    if (!container) return;

    if (!records || records.length === 0) {
        container.innerHTML = '';
        return;
    }

    const currentMonthKey = getCurrentMonthKey();
    let monthRecords = [];
    records.forEach(r => {
        const dateStr = getRecordDate(r);
        if (getMonthKey(dateStr) === currentMonthKey) {
            monthRecords.push(r);
        }
    });

    let monthTotal = 0;
    let totalAll = 0;
    let label = '';
    let className = '';

    if (moduleKey === 'income') {
        monthTotal = monthRecords.reduce((s, r) => s + (r.income || 0) - (r.goods || 0), 0);
        totalAll = records.reduce((s, r) => s + (r.income || 0) - (r.goods || 0), 0);
        label = '盈利';
        className = 'income';
    } else if (moduleKey === 'family') {
        monthTotal = monthRecords.reduce((s, r) => s + (r.personalExpense || 0), 0);
        totalAll = records.reduce((s, r) => s + (r.personalExpense || 0), 0);
        label = '总支出';
        className = 'cost';
    } else if (moduleKey === 'debt') {
        monthTotal = monthRecords.reduce((s, r) => s + Math.max(0, r.amount || 0) + Math.max(0, r.goodsAmount || 0), 0);
        totalAll = records.reduce((s, r) => s + Math.max(0, r.amount || 0) + Math.max(0, r.goodsAmount || 0), 0);
        label = '总欠款';
        className = 'goods';
    }

    const html = `<div class="global-stats">
        <div class="stat-row"><span class="label">本月</span><span class="${className}">${label} ¥${toFixed(monthTotal)}</span></div>
        <div class="stat-row"><span class="label">总计</span><span class="${className}">${label} ¥${toFixed(totalAll)}</span></div>
    </div>`;

    container.innerHTML = html;
}

function renderStatsGeneric(moduleKey) {
    // 无成员时显示引导
    if (!state.members || state.members.length === 0) {
        domMap[moduleKey].statsContainer.innerHTML = `
            <div class="empty-state">暂无成员，请点击「管理成员」添加</div>
        `;
        return;
    }

    const records = state.records[moduleKey] || [];
    const selectedDate = state.dates[moduleKey];
    const meta = MODULE_META[moduleKey];
    const {
        fields,
        showDetails,
        dateKey = 'date',
        personKey = 'person',
        noteKey = 'note',
        createdAtKey = 'createdAt',
    } = meta;
    const container = domMap[moduleKey].statsContainer;

    let dayRecords = records;
    if (selectedDate && dateKey) {
        dayRecords = records.filter(r => r[dateKey] === selectedDate);
    }

    let memberHtml = '';
    const members = state.members || [];
    members.forEach(name => {
        const pRecords = dayRecords.filter(r => r[personKey] === name);
        const totals = {};
        fields.forEach(f => {
            totals[f.key] = pRecords.reduce((s, r) => s + (r[f.key] || 0), 0);
        });

        memberHtml += `<div class="member-stat-card">
            <div class="member-stat-header">
                <span class="name">${name}</span>
                <span class="totals">
                    ${fields.map(f => `<span class="${f.class}">${f.label} ¥${toFixed(totals[f.key])}</span>`).join('')}
                </span>
            </div>`;

        if (showDetails && pRecords.length > 0) {
            memberHtml += `<div class="member-detail-list">`;
            pRecords.forEach(r => {
                let amtHtml = '';
                fields.forEach(f => {
                    const val = r[f.key] || 0;
                    if (val > 0) amtHtml += `<span class="${f.class}">${f.label} ¥${toFixed(val)}</span>`;
                });
                if (!amtHtml) amtHtml = `<span>—</span>`;
                const dateDisplay = r[dateKey] ? formatDate(r[dateKey]) : formatTime(r[createdAtKey]);
                const note = r[noteKey] || '';
                memberHtml += `<div class="detail-item">
                    <div class="left">
                        <span class="date">${dateDisplay}</span>
                        ${note ? `<span class="note" title="${note}">${note}</span>` : ''}
                    </div>
                    <div class="right">${amtHtml}</div>
                </div>`;
            });
            memberHtml += `</div>`;
        } else if (showDetails && pRecords.length === 0) {
            memberHtml += `<div class="member-detail-list"><div class="detail-empty">当天无记录</div></div>`;
        }
        memberHtml += `</div>`;
    });

    if (!memberHtml) {
        memberHtml = `<div class="empty-state">所选日期无记录</div>`;
    }

    container.innerHTML = memberHtml;
}

function renderListGeneric(moduleKey) {
    const records = state.records[moduleKey] || [];
    const container = domMap[moduleKey].recordList;
    const meta = MODULE_META[moduleKey];
    const {
        fields,
        path,
        dateKey = 'date',
        timeKey = 'createdAt',
        personKey = 'person',
        noteKey = 'note',
    } = meta;

    if (!records || records.length === 0) {
        container.innerHTML = `<div class="empty-state">还没有记录</div>`;
        return;
    }

    // 直接渲染，不使用缓存
    const limit = state.displayLimit[moduleKey] || 20;
    const showCount = Math.min(limit, records.length);
    const show = records.slice(0, showCount);

    let html = '';
    show.forEach((r, idx) => {
        const name = r[personKey];
        const note = r[noteKey] || '';
        const dateDisplay = (dateKey && r[dateKey]) ? formatDate(r[dateKey]) : formatTime(r[timeKey]);
        let rightHtml = '';
        fields.forEach(f => {
            const val = r[f.key] || 0;
            if (val > 0) rightHtml += `<span class="${f.class}">${f.label} ¥${toFixed(val)}</span>`;
        });
        if (!rightHtml) rightHtml = `<span class="empty">—</span>`;

        html += `
            <div class="record-item" data-id="${r.id}" style="animation-delay:${idx * 20}ms">
                <div class="left">
                    <div class="top">
                        <span class="pname">${name}</span>
                        <span class="pdate">${dateDisplay}</span>
                    </div>
                    ${note ? `<div class="note">${note}</div>` : ''}
                </div>
                <div class="right">
                    ${rightHtml}
                    <button class="del-btn" data-id="${r.id}" data-path="${path}" title="删除">✕</button>
                </div>
            </div>
        `;
    });

    if (showCount < records.length) {
        html += `
            <div class="load-more-container">
                <button class="load-more-btn" data-module="${moduleKey}" data-total="${records.length}">
                    加载更多（${showCount}/${records.length}）
                </button>
            </div>
        `;
    } else if (records.length > limit) {
        html += `
            <div class="load-more-container">
                <span class="load-all-info">已显示全部 ${records.length} 条</span>
            </div>
        `;
    }

    container.innerHTML = html;

    container.querySelectorAll('.load-more-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const module = this.dataset.module;
            const total = parseInt(this.dataset.total);
            const currentLimit = state.displayLimit[module] || 20;
            const newLimit = Math.min(currentLimit + 20, total);
            state.displayLimit[module] = newLimit;
            renderAll();
        });
    });
}

function renderStats(moduleKey) {
    renderStatsGeneric(moduleKey);
    renderGlobalStats(moduleKey);
}

function renderList(moduleKey) {
    renderListGeneric(moduleKey);
}

function renderAll() {
    MODULE_KEYS.forEach(key => {
        renderStats(key);
        renderList(key);
    });
    renderRepaymentResults();
}

function scheduleRender() {
    if (state._renderScheduled) return;
    state._renderScheduled = true;
    requestAnimationFrame(() => {
        state._renderScheduled = false;
        renderAll();
    });
}

// ================================================================
//  7.  提交逻辑（使用 MODULE_META）
// ================================================================
function submitRecord(moduleKey) {
    if (state._submitting) return;
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    const person = state.currentPerson;
    if (!person) { showToast('请先添加成员'); return; }

    const meta = MODULE_META[moduleKey];
    const dom = domMap[moduleKey];
    const { path, fields, noteDomKey, onSuccess } = meta;

    const record = {
        person,
        note: dom[noteDomKey].value.trim() || '',
        createdAt: Date.now()
    };
    if (state.dates[moduleKey]) {
        record.date = state.dates[moduleKey];
    }

    let hasValue = false;
    fields.forEach(f => {
        const input = dom[f.domKey];
        const val = parseFloat(input.value) || 0;
        record[f.key] = val;
        if (val > 0) hasValue = true;
    });

    if (!hasValue) {
        showToast('至少填写一个金额');
        return;
    }

    state._submitting = true;
    const btn = dom[meta.submitDomKey];
    btn.disabled = true;
    btn.textContent = '提交中...';
    const newRef = db.ref(path).push();
    newRef.set(record)
        .then(() => {
            showToast('记录成功');
            if (onSuccess) onSuccess(dom);
        })
        .catch((err) => { console.error(err); showToast('提交失败'); })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '记录';
            state._submitting = false;
        });
}

// ================================================================
//  8.  清除逻辑（清空所选日期）- 使用 getRecordDate 统一日期
// ================================================================
function clearRecords(moduleKey) {
    const selectedDate = state.dates[moduleKey];
    if (!selectedDate) {
        showToast('请先选择日期');
        return;
    }

    const records = state.records[moduleKey] || [];
    const toDelete = records.filter(r => getRecordDate(r) === selectedDate);
    if (toDelete.length === 0) {
        showToast(`${MODULE_LABELS[moduleKey]}在 ${formatDate(selectedDate)} 没有记录`);
        return;
    }

    const confirmMsg = `确定清空 ${formatDate(selectedDate)} 的所有${MODULE_LABELS[moduleKey]}记录吗？`;
    if (!confirm(confirmMsg)) return;

    const dbPath = MODULE_META[moduleKey].path;
    const promises = toDelete.map(r => db.ref(`${dbPath}/${r.id}`).remove());
    Promise.all(promises)
        .then(() => showToast(`已清空 ${formatDate(selectedDate)} 的记录`))
        .catch(() => showToast('清空失败，请重试'));
}

// ================================================================
//  9.  数据监听（增量）
// ================================================================
function updateLocalRecords(recordsArray, newRecord, type) {
    const idx = recordsArray.findIndex(r => r.id === newRecord.id);
    if (type === 'removed') {
        if (idx !== -1) recordsArray.splice(idx, 1);
        return;
    }
    // added 或 changed
    if (idx !== -1) {
        recordsArray[idx] = newRecord;
    } else {
        recordsArray.push(newRecord);
    }
    // 重新排序并保持有序
    const sorted = sortRecordsByDate(recordsArray);
    recordsArray.length = 0;
    recordsArray.push(...sorted);
}

function listenModule(moduleKey) {
    if (!isFirebaseReady) return;
    const path = MODULE_META[moduleKey].path;
    const stateKey = moduleKey;

    db.ref(path).once('value', (snapshot) => {
        const data = snapshot.val();
        let records = [];
        if (data) {
            records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            records = sortRecordsByDate(records);
        }
        state.records[stateKey] = records;
        state.displayLimit[moduleKey] = 20;
        scheduleRender();
    }).catch(err => {
        console.error(`初始加载 ${path} 失败:`, err);
        showToast(`读取数据失败`);
    });

    const ref = db.ref(path);
    ref.on('child_added', (snapshot) => {
        const record = { id: snapshot.key, ...snapshot.val() };
        updateLocalRecords(state.records[stateKey], record, 'added');
        state.displayLimit[moduleKey] = 20;
        scheduleRender();
    }, (err) => { console.error(`child_added 监听失败:`, err); });

    ref.on('child_changed', (snapshot) => {
        const record = { id: snapshot.key, ...snapshot.val() };
        updateLocalRecords(state.records[stateKey], record, 'changed');
        scheduleRender();
    }, (err) => { console.error(`child_changed 监听失败:`, err); });

    ref.on('child_removed', (snapshot) => {
        const id = snapshot.key;
        const records = state.records[stateKey];
        const idx = records.findIndex(r => r.id === id);
        if (idx !== -1) {
            records.splice(idx, 1);
            scheduleRender();
        }
    }, (err) => { console.error(`child_removed 监听失败:`, err); });
}

function loadData() {
    if (!isFirebaseReady) {
        showToast('数据库未连接');
        return;
    }
    MODULE_KEYS.forEach(key => listenModule(key));
}

// ================================================================
//  10. 事件绑定
// ================================================================
MODULE_KEYS.forEach(key => {
    const dom = domMap[key];
    if (dom.dateInput) {
        const today = getTodayStr();
        dom.dateInput.value = today;
        state.dates[key] = today;

        dom.dateInput.addEventListener('change', function() {
            state.dates[key] = this.value;
            state.displayLimit[key] = 20;
            renderStats(key);
            renderList(key);
            if (key === 'debt') renderRepaymentResults();
        });
    }
});

MODULE_KEYS.forEach(key => {
    domMap[key].submit.addEventListener('click', function() {
        submitRecord(key);
    });
});

MODULE_KEYS.forEach(key => {
    domMap[key].clearBtn.addEventListener('click', function() {
        clearRecords(key);
    });
});

document.addEventListener('click', function(e) {
    const delBtn = e.target.closest('.del-btn');
    if (!delBtn) return;
    const id = delBtn.dataset.id;
    const path = delBtn.dataset.path;
    if (id && path && confirm('确定删除这条记录吗？')) {
        if (!isFirebaseReady) { showToast('数据库未连接'); return; }
        db.ref(`${path}/${id}`).remove()
            .then(() => showToast('已删除'))
            .catch(() => showToast('删除失败'));
    }
});

// ================================================================
//  11. 还款功能
// ================================================================
function renderRepaymentResults() {
    const keyword = repaymentSearch.value.trim();
    state.repaymentSearchKeyword = keyword;
    let filtered = state.records.debt || [];

    if (keyword === '') {
        filtered = filtered.filter(r => !r.note || r.note.trim() === '');
    } else {
        const lower = keyword.toLowerCase();
        filtered = filtered.filter(r => r.note && r.note.toLowerCase().includes(lower));
    }

    filtered = filtered.filter(r => (r.amount || 0) > 0 || (r.goodsAmount || 0) > 0);

    if (filtered.length === 0) {
        repaymentResults.innerHTML = `<div class="empty-state">${keyword === '' ? '没有未结清且无备注的债务' : '未找到匹配的未结清债务'}</div>`;
        state.selectedDebtId = null;
        return;
    }

    const sorted = sortRecordsByDate(filtered);
    let html = '';
    sorted.forEach(r => {
        const dateDisplay = r.date ? formatDate(r.date) : formatTime(r.createdAt);
        const noteDisplay = r.note && r.note.trim() !== '' ? r.note : '（无备注）';
        const isSelected = state.selectedDebtId === r.id;
        html += `
            <div class="repayment-result-item ${isSelected ? 'selected' : ''}" data-id="${r.id}">
                <div class="left">
                    <span class="date">${dateDisplay}</span>
                    <span class="note" title="${noteDisplay}">${noteDisplay}</span>
                    <span style="font-size:12px;color:#a5856a;">${r.person || ''}</span>
                </div>
                <div class="right">
                    ${r.amount > 0 ? `<span class="amount">欠 ¥${toFixed(r.amount)}</span>` : ''}
                    ${r.goodsAmount > 0 ? `<span class="goods">货款 ¥${toFixed(r.goodsAmount)}</span>` : ''}
                </div>
            </div>
        `;
    });
    repaymentResults.innerHTML = html;

    if (state.selectedDebtId) {
        const stillExists = sorted.some(r => r.id === state.selectedDebtId);
        if (!stillExists) state.selectedDebtId = null;
    }
    if (!state.selectedDebtId && sorted.length > 0) {
        state.selectedDebtId = sorted[0].id;
    }
    document.querySelectorAll('.repayment-result-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === state.selectedDebtId);
    });
}

repaymentResults.addEventListener('click', function(e) {
    const item = e.target.closest('.repayment-result-item');
    if (!item) return;
    const id = item.dataset.id;
    if (!id) return;
    state.selectedDebtId = (state.selectedDebtId === id) ? null : id;
    renderRepaymentResults();
});

repaymentSearch.addEventListener('input', function() {
    renderRepaymentResults();
});

repaymentSubmitBtn.addEventListener('click', function() {
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    if (!state.selectedDebtId) {
        showToast('请先从搜索结果中选择一条债务记录');
        return;
    }
    const selectedRecord = state.records.debt.find(r => r.id === state.selectedDebtId);
    if (!selectedRecord) {
        showToast('选中的记录不存在，请刷新');
        state.selectedDebtId = null;
        renderRepaymentResults();
        return;
    }
    const amount = parseFloat(repaymentAmount.value);
    if (!amount || amount <= 0) {
        showToast('请输入有效的还款金额（大于0）');
        return;
    }
    const typeKey = repaymentType.value;
    const typeLabel = typeKey === 'amount' ? '欠款' : '货款欠款';
    const currentBalance = selectedRecord[typeKey] || 0;
    if (amount > currentBalance) {
        showToast(`还款金额不能超过${typeLabel}余额（¥${toFixed(currentBalance)}）`);
        return;
    }
    const updateData = {};
    updateData[typeKey] = currentBalance - amount;

    const btn = repaymentSubmitBtn;
    btn.disabled = true;
    btn.textContent = '还款中...';

    db.ref(`debtRecords/${state.selectedDebtId}`).update(updateData)
        .then(() => {
            const historyRef = db.ref('repaymentHistory').push();
            const historyRecord = {
                debtId: state.selectedDebtId,
                amount: amount,
                type: typeKey,
                person: state.currentPerson,
                createdAt: Date.now(),
                note: selectedRecord.note || '',
                originalAmount: currentBalance,
                remainingAmount: currentBalance - amount
            };
            historyRef.set(historyRecord).catch(err => console.error('记录还款历史失败:', err));

            showToast(`还款成功，${typeLabel}减少 ¥${toFixed(amount)}`);
            repaymentAmount.value = '';
            state.selectedDebtId = null;
            renderRepaymentResults();
        })
        .catch((err) => {
            console.error(err);
            showToast('还款失败，请重试');
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '确认还款';
        });
});

// ================================================================
//  12. 更新公告
// ================================================================
const modalOverlay = document.getElementById('updateModal');
const oldVersionSpan = document.getElementById('oldVersion');
const newVersionSpan = document.getElementById('newVersion');
const updateListEl = document.getElementById('updateList');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

function checkUpdateModal() {
    const currentVersion = APP_VERSION;
    let lastShownVersion = localStorage.getItem('lastShownVersion') || 'v0.0';
    if (currentVersion === lastShownVersion) return;
    const updateItems = UPDATE_LOGS[currentVersion] || ['本次更新内容未填写，请查看代码中的 UPDATE_LOGS'];
    oldVersionSpan.textContent = lastShownVersion;
    newVersionSpan.textContent = currentVersion;
    updateListEl.innerHTML = updateItems.map(item => `<li>${item}</li>`).join('');
    modalOverlay.classList.add('active');
}

modalConfirmBtn.addEventListener('click', function() {
    const currentVersion = APP_VERSION;
    localStorage.setItem('lastShownVersion', currentVersion);
    modalOverlay.classList.remove('active');
});

// ================================================================
//  13. 启动 & 快捷键
// ================================================================
function initApp() {
    watchMembers();
    loadData();
    document.getElementById('version').textContent = APP_VERSION;
    setTimeout(checkUpdateModal, 500);
}

initApp();

// 快捷键
const focusMap = {
    income: { amt: domMap.income.amt, goods: domMap.income.goods, note: domMap.income.note },
    family: { amt: domMap.family.amt, note: domMap.family.note },
    debt: { amt: domMap.debt.amt, goods: domMap.debt.goods, note: domMap.debt.note }
};

Object.keys(focusMap).forEach(key => {
    const f = focusMap[key];
    if (f.amt) {
        f.amt.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (f.goods) f.goods.focus();
                else if (f.note) f.note.focus();
            }
        });
    }
    if (f.goods) {
        f.goods.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (f.note) f.note.focus(); }
        });
    }
});

repaymentAmount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); repaymentSubmitBtn.click(); }
});

document.addEventListener('click', function(e) {
    const card = e.target.closest('.member-stat-card');
    if (!card) return;
    const nameEl = card.querySelector('.member-stat-header .name');
    if (!nameEl) return;
    const name = nameEl.textContent.trim();
    if (state.members.includes(name)) {
        state.currentPerson = name;
        personSelector.querySelectorAll('.person-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.person === name);
        });
        showToast(`切换到 ${name}`);
    }
});

refreshBtn.addEventListener('click', function() {
    state.displayLimit = { income: 20, family: 20, debt: 20 };
    renderAll();
    showToast('数据已刷新');
});

console.log(`版本 ${APP_VERSION} 已启动（移除缓存、修复清除逻辑）`);