/**
 * ================================================================
 *  家庭账本应用 - 主脚本（DRY 重构版）
 *  v0.52 - 还款搜索逻辑恢复原样（留空显示无备注债务）
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
    _statsCache: { income: null, family: null, debt: null },
    _lastRecordIds: { income: [], family: [], debt: [] },
    _renderScheduled: false,
};

// ================================================================
//  DOM 引用
// ================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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
        grandTotal: $('#incomeGrandTotal'),
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
        grandTotal: $('#familyGrandTotal'),
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
        grandTotal: null,
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
//  3.  工具函数
// ================================================================
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
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
    const d = new Date(dateStr + 'T00:00:00');
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getCurrentMonthKey() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function areRecordIdsEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

// ================================================================
//  4.  人员管理
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
        renderAll();
        renderRepaymentResults();
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

            const paths = ['familyRecords', 'familyExpenses', 'debtRecords'];
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
//  5.  通用渲染函数
// ================================================================
function renderGlobalStats(moduleKey) {
    const records = state.records[moduleKey] || [];
    const container = domMap[moduleKey].globalStats;
    if (!container) return;

    if (!records || records.length === 0) {
        container.innerHTML = '';
        state._statsCache[moduleKey] = null;
        return;
    }

    const currentMonthKey = getCurrentMonthKey();
    const cacheData = state._statsCache[moduleKey];

    if (cacheData && cacheData.monthKey === currentMonthKey && cacheData.recordCount === records.length) {
        container.innerHTML = cacheData.html;
        return;
    }

    let monthRecords = [];
    records.forEach(r => {
        const dateStr = r.date || new Date(r.createdAt).toISOString().slice(0, 10);
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
        monthTotal = monthRecords.reduce((s, r) => s + (r.amount || 0) + (r.goodsAmount || 0), 0);
        totalAll = records.reduce((s, r) => s + (r.amount || 0) + (r.goodsAmount || 0), 0);
        label = '总欠款';
        className = 'goods';
    }

    const html = `<div class="global-stats">
        <div class="stat-row"><span class="label">本月</span><span class="${className}">${label} ¥${toFixed(monthTotal)}</span></div>
        <div class="stat-row"><span class="label">总计</span><span class="${className}">${label} ¥${toFixed(totalAll)}</span></div>
    </div>`;

    container.innerHTML = html;
    state._statsCache[moduleKey] = { monthKey: currentMonthKey, recordCount: records.length, html };
}

function renderStatsGeneric(moduleKey) {
    const records = state.records[moduleKey] || [];
    const selectedDate = state.dates[moduleKey];
    const config = getModuleConfig(moduleKey);
    const {
        container,
        fields,
        detailFields,
        showDetails,
        dateKey,
        personKey,
        noteKey,
        createdAtKey,
    } = config;

    const personKey_ = personKey || 'person';
    const noteKey_ = noteKey || 'note';
    const createdAtKey_ = createdAtKey || 'createdAt';
    const detailFields_ = detailFields || fields;

    let dayRecords = records;
    if (selectedDate && dateKey) {
        dayRecords = records.filter(r => r[dateKey] === selectedDate);
    }

    let memberHtml = '';
    const members = state.members || [];
    members.forEach(name => {
        const pRecords = dayRecords.filter(r => r[personKey_] === name);
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
            const sorted = [...pRecords].sort((a, b) => {
                const dateA = a[dateKey] || new Date(a[createdAtKey_]).toISOString().slice(0, 10);
                const dateB = b[dateKey] || new Date(b[createdAtKey_]).toISOString().slice(0, 10);
                if (dateB !== dateA) return dateB.localeCompare(dateA);
                return (b[createdAtKey_] || 0) - (a[createdAtKey_] || 0);
            });
            sorted.forEach(r => {
                let amtHtml = '';
                detailFields_.forEach(f => {
                    const val = r[f.key] || 0;
                    if (val > 0) amtHtml += `<span class="${f.class}">${f.label} ¥${toFixed(val)}</span>`;
                });
                if (!amtHtml) amtHtml = `<span>—</span>`;
                const dateDisplay = r[dateKey] ? formatDate(r[dateKey]) : formatTime(r[createdAtKey_]);
                const note = r[noteKey_] || '';
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
    const config = getModuleConfig(moduleKey);
    const {
        fields,
        path,
        dateKey,
        timeKey,
        personKey,
        noteKey,
    } = config;

    const personKey_ = personKey || 'person';
    const noteKey_ = noteKey || 'note';
    const timeKey_ = timeKey || 'createdAt';

    if (!records || records.length === 0) {
        container.innerHTML = `<div class="empty-state">还没有记录</div>`;
        return;
    }

    const sortedRecords = [...records].sort((a, b) => {
        const dateA = a[dateKey] || new Date(a[timeKey_]).toISOString().slice(0, 10);
        const dateB = b[dateKey] || new Date(b[timeKey_]).toISOString().slice(0, 10);
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b[timeKey_] || 0) - (a[timeKey_] || 0);
    });

    const limit = state.displayLimit[moduleKey] || 20;
    const showCount = Math.min(limit, sortedRecords.length);
    const show = sortedRecords.slice(0, showCount);

    const currentIds = show.map(r => r.id);
    const lastIds = state._lastRecordIds[moduleKey] || [];
    if (areRecordIdsEqual(currentIds, lastIds) && show.length === lastIds.length) {
        updateLoadMoreButton(container, sortedRecords.length, showCount, moduleKey);
        return;
    }
    state._lastRecordIds[moduleKey] = currentIds;

    let html = '';
    show.forEach((r, idx) => {
        const name = r[personKey_];
        const note = r[noteKey_] || '';
        const dateDisplay = (dateKey && r[dateKey]) ? formatDate(r[dateKey]) : formatTime(r[timeKey_]);
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

    if (showCount < sortedRecords.length) {
        html += `
            <div class="load-more-container">
                <button class="load-more-btn" data-module="${moduleKey}" data-total="${sortedRecords.length}">
                    加载更多（${showCount}/${sortedRecords.length}）
                </button>
            </div>
        `;
    } else if (sortedRecords.length > limit) {
        html += `
            <div class="load-more-container">
                <span class="load-all-info">已显示全部 ${sortedRecords.length} 条</span>
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
            state._lastRecordIds[module] = [];
            renderAll();
        });
    });
}

function updateLoadMoreButton(container, total, shown, moduleKey) {
    const existingBtn = container.querySelector('.load-more-btn');
    const existingInfo = container.querySelector('.load-all-info');
    if (shown < total) {
        if (existingBtn) {
            existingBtn.textContent = `加载更多（${shown}/${total}）`;
            existingBtn.dataset.total = total;
        }
    } else {
        if (existingBtn) {
            existingBtn.remove();
            const info = document.createElement('div');
            info.className = 'load-more-container';
            info.innerHTML = `<span class="load-all-info">已显示全部 ${total} 条</span>`;
            container.appendChild(info);
        }
    }
}

// ================================================================
//  6.  模块配置工厂
// ================================================================
const MODULE_KEYS = ['income', 'family', 'debt'];

function getModuleFields(moduleKey) {
    const map = {
        income: [
            { key: 'income', label: '收入', class: 'income' },
            { key: 'goods', label: '货款', class: 'goods' }
        ],
        family: [
            { key: 'personalExpense', label: '支出', class: 'cost' }
        ],
        debt: [
            { key: 'amount', label: '欠款', class: 'cost' },
            { key: 'goodsAmount', label: '货款欠款', class: 'goods' }
        ]
    };
    return map[moduleKey];
}

function getModuleConfig(moduleKey) {
    const fields = getModuleFields(moduleKey);
    const base = {
        container: domMap[moduleKey].statsContainer,
        grandTotalContainer: null,
        fields: fields,
        detailFields: fields,
        showDetails: true,
        dateKey: 'date',
        personKey: 'person',
        noteKey: 'note',
        createdAtKey: 'createdAt',
        path: getDbPath(moduleKey),
        timeKey: 'createdAt',
    };
    if (moduleKey === 'debt') {
        base.showDetails = false;
        base.detailFields = [];
    }
    return base;
}

function getDbPath(moduleKey) {
    const map = {
        income: 'familyRecords',
        family: 'familyExpenses',
        debt: 'debtRecords'
    };
    return map[moduleKey];
}

function getSubmitConfig(moduleKey) {
    const dom = domMap[moduleKey];
    const map = {
        income: {
            dbPath: 'familyRecords',
            fields: [
                { dom: dom.amt, key: 'income', parse: parseFloat },
                { dom: dom.goods, key: 'goods', parse: parseFloat }
            ],
            noteDom: dom.note,
            buttonDom: dom.submit,
            dateStateKey: 'dates',
            onSuccess: () => {
                dom.amt.value = '';
                dom.goods.value = '';
                dom.note.value = '';
                dom.amt.focus();
            }
        },
        family: {
            dbPath: 'familyExpenses',
            fields: [
                { dom: dom.amt, key: 'personalExpense', parse: parseFloat }
            ],
            noteDom: dom.note,
            buttonDom: dom.submit,
            dateStateKey: 'dates',
            onSuccess: () => {
                dom.amt.value = '';
                dom.note.value = '';
                dom.amt.focus();
            }
        },
        debt: {
            dbPath: 'debtRecords',
            fields: [
                { dom: dom.amt, key: 'amount', parse: parseFloat },
                { dom: dom.goods, key: 'goodsAmount', parse: parseFloat }
            ],
            noteDom: dom.note,
            buttonDom: dom.submit,
            dateStateKey: 'dates',
            onSuccess: () => {
                dom.amt.value = '';
                dom.goods.value = '';
                dom.note.value = '';
                dom.amt.focus();
            }
        }
    };
    return map[moduleKey];
}

// ================================================================
//  7.  渲染函数（入口）
// ================================================================
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
//  8.  提交逻辑
// ================================================================
function submitRecord(moduleKey) {
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    const person = state.currentPerson;
    if (!person) { showToast('请先添加成员'); return; }

    const config = getSubmitConfig(moduleKey);
    const { dbPath, fields, noteDom, onSuccess } = config;

    const record = {
        person,
        note: noteDom.value.trim() || '',
        createdAt: Date.now()
    };
    if (state.dates[moduleKey]) {
        record.date = state.dates[moduleKey];
    }

    let hasValue = false;
    fields.forEach(f => {
        const val = f.parse(f.dom.value) || 0;
        record[f.key] = val;
        if (val > 0) hasValue = true;
    });

    if (!hasValue) {
        showToast('至少填写一个金额');
        return;
    }

    const btn = config.buttonDom;
    btn.disabled = true;
    btn.textContent = '提交中...';
    const newRef = db.ref(dbPath).push();
    newRef.set(record)
        .then(() => {
            showToast('记录成功');
            if (onSuccess) onSuccess();
        })
        .catch((err) => { console.error(err); showToast('提交失败'); })
        .finally(() => { btn.disabled = false; btn.textContent = '记录'; });
}

// ================================================================
//  9.  清除逻辑
// ================================================================
function clearRecords(moduleKey) {
    const records = state.records[moduleKey] || [];
    if (!records || records.length === 0) { showToast('没有记录'); return; }
    const dbPath = getDbPath(moduleKey);
    const confirmMsg = `确定清空所有${moduleKey === 'income' ? '账本' : moduleKey === 'family' ? '支出' : '债务'}记录吗？不可恢复！`;
    if (confirm(confirmMsg)) {
        db.ref(dbPath).remove()
            .then(() => showToast('已清空'))
            .catch(() => showToast('清空失败'));
    }
}

// ================================================================
//  10. 数据监听（增量）
// ================================================================
function updateLocalRecords(recordsArray, newRecord, type) {
    const idx = recordsArray.findIndex(r => r.id === newRecord.id);
    if (type === 'removed') {
        if (idx !== -1) recordsArray.splice(idx, 1);
        return;
    }
    if (type === 'changed' || type === 'added') {
        if (idx !== -1) {
            recordsArray[idx] = newRecord;
        } else {
            recordsArray.push(newRecord);
        }
        recordsArray.sort((a, b) => {
            const dateA = a.date || new Date(a.createdAt || 0).toISOString().slice(0, 10);
            const dateB = b.date || new Date(b.createdAt || 0).toISOString().slice(0, 10);
            if (dateB !== dateA) return dateB.localeCompare(dateA);
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
    }
}

function listenModule(moduleKey) {
    if (!isFirebaseReady) return;
    const path = getDbPath(moduleKey);
    const stateKey = moduleKey;

    db.ref(path).once('value', (snapshot) => {
        const data = snapshot.val();
        let records = [];
        if (data) {
            records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            records.sort((a, b) => {
                const dateA = a.date || new Date(a.createdAt || 0).toISOString().slice(0, 10);
                const dateB = b.date || new Date(b.createdAt || 0).toISOString().slice(0, 10);
                if (dateB !== dateA) return dateB.localeCompare(dateA);
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
        }
        state.records[stateKey] = records;
        state.displayLimit[moduleKey] = 20;
        state._lastRecordIds[moduleKey] = [];
        state._statsCache[moduleKey] = null;
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
        state._lastRecordIds[moduleKey] = [];
        state._statsCache[moduleKey] = null;
        scheduleRender();
        if (moduleKey === 'debt') renderRepaymentResults();
    }, (err) => { console.error(`child_added 监听失败:`, err); });

    ref.on('child_changed', (snapshot) => {
        const record = { id: snapshot.key, ...snapshot.val() };
        updateLocalRecords(state.records[stateKey], record, 'changed');
        state._lastRecordIds[moduleKey] = [];
        state._statsCache[moduleKey] = null;
        scheduleRender();
        if (moduleKey === 'debt') renderRepaymentResults();
    }, (err) => { console.error(`child_changed 监听失败:`, err); });

    ref.on('child_removed', (snapshot) => {
        const id = snapshot.key;
        const records = state.records[stateKey];
        const idx = records.findIndex(r => r.id === id);
        if (idx !== -1) {
            records.splice(idx, 1);
            state._lastRecordIds[moduleKey] = [];
            state._statsCache[moduleKey] = null;
            scheduleRender();
            if (moduleKey === 'debt') renderRepaymentResults();
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
//  11. 事件绑定
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
            state._lastRecordIds[key] = [];
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
//  12. 还款功能（逻辑恢复原样：留空显示无备注记录）
// ================================================================
function renderRepaymentResults() {
    const keyword = repaymentSearch.value.trim();
    state.repaymentSearchKeyword = keyword;
    let filtered = state.records.debt || [];

    // 原逻辑：留空时只显示没有备注的记录
    if (keyword === '') {
        filtered = filtered.filter(r => !r.note || r.note.trim() === '');
    } else {
        const lower = keyword.toLowerCase();
        filtered = filtered.filter(r => r.note && r.note.toLowerCase().includes(lower));
    }

    if (filtered.length === 0) {
        repaymentResults.innerHTML = `<div class="empty-state">${keyword === '' ? '没有无备注的债务记录' : '未找到匹配的债务记录'}</div>`;
        state.selectedDebtId = null;
        return;
    }
    const sorted = [...filtered].sort((a, b) => {
        const dateA = a.date || new Date(a.createdAt || 0).toISOString().slice(0, 10);
        const dateB = b.date || new Date(b.createdAt || 0).toISOString().slice(0, 10);
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b.createdAt || 0) - (a.createdAt || 0);
    });
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
                    ${r.amount <= 0 && r.goodsAmount <= 0 ? `<span class="empty">已还清</span>` : ''}
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
//  13. 更新公告
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
//  14. 启动 & 快捷键
// ================================================================
function initApp() {
    document.querySelectorAll('.grand-total').forEach(el => el.remove());

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
    state._lastRecordIds = { income: [], family: [], debt: [] };
    state._statsCache = { income: null, family: null, debt: null };
    renderAll();
    showToast('数据已刷新');
});

console.log(`版本 ${APP_VERSION} 已启动（排序修正 + 支出单字段 + 还款搜索回退原逻辑）`);