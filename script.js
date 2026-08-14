/**
 * ================================================================
 *  家庭账本应用 - 主脚本
 *  技术栈：Firebase Realtime Database（无后端）
 *  功能模块：账本（收入+货款）、支出（个人+家庭）、债务（欠款+货款欠款）
 *  核心特性：人员切换、日期筛选、实时数据同步、增删改查、还款功能
 * ================================================================
 */

// ================================================================
//  1.  Firebase 配置
// ================================================================
const firebaseConfig = {
    apiKey: "AIzaSyA42r5qGK6t5h-Ggq7sC0m9pCv90yMIOI",
    authDomain: "family-account-book-22cc3.firebaseapp.com",
    databaseURL: "https://family-account-book-22cc3-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "family-account-book-22cc3",
    storageBucket: "family-account-book-22cc3.firebasestorage.app",
    messagingSenderId: "883258053961",
    appId: "1:883258053961:web:44d29f6635598b6a22f698"
};

let db = null;
let isFirebaseReady = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    isFirebaseReady = true;
    console.log("Firebase 初始化成功");
} catch (err) {
    console.error("Firebase 初始化失败:", err);
    showToast("Firebase 配置有误，请检查 config");
}

// ================================================================
//  2.  人员常量
// ================================================================
const PERSON_NAMES = ['刘力伟', '郑少容'];

// ================================================================
//  3.  应用状态
// ================================================================
const state = {
    currentPerson: '刘力伟',
    incomeRecords: [],
    familyRecords: [],
    debtRecords: [],
    incomeDate: new Date().toISOString().slice(0, 10),
    familyDate: new Date().toISOString().slice(0, 10),
    debtDate: new Date().toISOString().slice(0, 10),
    selectedDebtId: null,
    repaymentSearchKeyword: '',
};

// ================================================================
//  DOM 引用
// ================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const personBtns = $$('.person-btn');

const incomeAmtInput = $('#incomeAmt');
const goodsInput = $('#goodsAmt');
const noteInput = $('#noteInput');
const submitBtn = $('#submitBtn');
const incomeStatsContainer = $('#incomeStatsContainer');
const incomeGrandTotal = $('#incomeGrandTotal');
const incomeRecordList = $('#incomeRecordList');
const incomeDateInput = $('#incomeDate');
const clearIncomeBtn = $('#clearIncomeBtn');

const personalExpenseInput = $('#personalExpense');
const familyExpenseInput = $('#familyExpense');
const familyNoteInput = $('#familyNote');
const familySubmitBtn = $('#familySubmitBtn');
const familyStatsContainer = $('#familyStatsContainer');
const familyGrandTotal = $('#familyGrandTotal');
const familyRecordList = $('#familyRecordList');
const familyDateInput = $('#familyDate');
const clearFamilyBtn = $('#clearFamilyBtn');

const debtAmount = $('#debtAmount');
const debtGoodsAmount = $('#debtGoodsAmount');
const debtNote = $('#debtNote');
const debtSubmitBtn = $('#debtSubmitBtn');
const debtRecordList = $('#debtRecordList');
const debtStats = $('#debtStats');
const debtDateInput = $('#debtDate');
const clearDebtBtn = $('#clearDebtBtn');

const repaymentAmount = $('#repaymentAmount');
const repaymentType = $('#repaymentType');
const repaymentSearch = $('#repaymentSearch');
const repaymentResults = $('#repaymentResults');
const repaymentSubmitBtn = $('#repaymentSubmitBtn');

// ================================================================
//  4.  工具函数
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
function getTodayStr() { return new Date().toISOString().slice(0, 10); }

// ================================================================
//  5.  人员切换
// ================================================================
personBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        personBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.currentPerson = this.dataset.person;
    });
});
personBtns.forEach(btn => {
    if (btn.dataset.person === state.currentPerson) btn.classList.add('active');
});

// ================================================================
//  6.  通用渲染函数
// ================================================================
function renderStatsGeneric(records, selectedDate, config) {
    const {
        container,
        grandTotalContainer,
        fields,
        detailFields,
        profitConfig,
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

    let html = '';

    if (profitConfig) {
        const totalIncome = dayRecords.reduce((s, r) => s + (r[profitConfig.incomeKey] || 0), 0);
        const totalGoods = dayRecords.reduce((s, r) => s + (r[profitConfig.goodsKey] || 0), 0);
        const profit = totalIncome - totalGoods;
        html += `<div class="profit-card">
            <span class="profit-label">所选日期 (${selectedDate ? formatDate(selectedDate) : '全部'}) 盈利</span>
            <span class="profit-amount ${profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'zero'}">¥${toFixed(profit)}</span>
        </div>`;
    }

    PERSON_NAMES.forEach(name => {
        const pRecords = dayRecords.filter(r => r[personKey_] === name);
        const totals = {};
        fields.forEach(f => {
            totals[f.key] = pRecords.reduce((s, r) => s + (r[f.key] || 0), 0);
        });

        html += `<div class="member-stat-card">
            <div class="member-stat-header">
                <span class="name">${name}</span>
                <span class="totals">
                    ${fields.map(f => `<span class="${f.class}">${f.label} ¥${toFixed(totals[f.key])}</span>`).join('')}
                </span>
            </div>`;

        if (showDetails && pRecords.length > 0) {
            html += `<div class="member-detail-list">`;
            const sorted = [...pRecords].sort((a, b) => (b[createdAtKey_] || 0) - (a[createdAtKey_] || 0));
            sorted.forEach(r => {
                let amtHtml = '';
                detailFields_.forEach(f => {
                    const val = r[f.key] || 0;
                    if (val > 0) amtHtml += `<span class="${f.class}">${f.label} ¥${toFixed(val)}</span>`;
                });
                if (!amtHtml) amtHtml = `<span>—</span>`;
                const dateDisplay = r[dateKey] ? formatDate(r[dateKey]) : formatTime(r[createdAtKey_]);
                const note = r[noteKey_] || '';
                html += `<div class="detail-item">
                    <div class="left">
                        <span class="date">${dateDisplay}</span>
                        ${note ? `<span class="note" title="${note}">${note}</span>` : ''}
                    </div>
                    <div class="right">${amtHtml}</div>
                </div>`;
            });
            html += `</div>`;
        } else if (showDetails && pRecords.length === 0) {
            html += `<div class="member-detail-list"><div class="detail-empty">当天无记录</div></div>`;
        }
        html += `</div>`;
    });

    container.innerHTML = html || `<div class="empty-state">所选日期无记录</div>`;

    if (grandTotalContainer) {
        const totals = {};
        fields.forEach(f => {
            totals[f.key] = dayRecords.reduce((s, r) => s + (r[f.key] || 0), 0);
        });
        const grandHtml = fields.map(f => 
            `<div class="item">${f.label}总 <span class="num ${f.class}">¥${toFixed(totals[f.key])}</span></div>`
        ).join('');
        grandTotalContainer.innerHTML = grandHtml;
    }
}

function renderListGeneric(records, container, config) {
    const {
        fields,
        path,
        dateKey,
        timeKey,
        personKey,
        noteKey,
        maxItems = 50,
    } = config;

    const personKey_ = personKey || 'person';
    const noteKey_ = noteKey || 'note';
    const timeKey_ = timeKey || 'createdAt';

    if (!records || records.length === 0) {
        container.innerHTML = `<div class="empty-state">还没有记录</div>`;
        return;
    }

    const show = records.slice(0, maxItems);
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
    container.innerHTML = html;
}

// ================================================================
//  7.  模块配置
// ================================================================
const MODULES = {
    income: {
        dbPath: 'familyRecords',
        statsConfig: {
            container: incomeStatsContainer,
            grandTotalContainer: incomeGrandTotal,
            fields: [
                { key: 'income', label: '收入', class: 'income' },
                { key: 'goods', label: '货款', class: 'goods' }
            ],
            detailFields: [
                { key: 'income', label: '', class: 'income' },
                { key: 'goods', label: '货款', class: 'goods' }
            ],
            profitConfig: { incomeKey: 'income', goodsKey: 'goods' },
            showDetails: true,
            dateKey: 'date',
            personKey: 'person',
            noteKey: 'note',
            createdAtKey: 'createdAt',
        },
        listConfig: {
            fields: [
                { key: 'income', label: '', class: 'income' },
                { key: 'goods', label: '货款', class: 'goods' }
            ],
            path: 'familyRecords',
            dateKey: 'date',
            timeKey: 'createdAt',
            personKey: 'person',
            noteKey: 'note',
        },
        dateInput: incomeDateInput,
        dateStateKey: 'incomeDate',
        clearBtn: clearIncomeBtn,
        recordsStateKey: 'incomeRecords',
        confirmMsg: '确定清空所有账本记录吗？不可恢复！',
        submitConfig: {
            dbPath: 'familyRecords',
            fields: [
                { dom: incomeAmtInput, key: 'income', parse: parseFloat },
                { dom: goodsInput, key: 'goods', parse: parseFloat }
            ],
            noteDom: noteInput,
            buttonDom: submitBtn,
            dateStateKey: 'incomeDate',
            onSuccess: () => {
                incomeAmtInput.value = '';
                goodsInput.value = '';
                noteInput.value = '';
                incomeAmtInput.focus();
            }
        }
    },
    family: {
        dbPath: 'familyExpenses',
        statsConfig: {
            container: familyStatsContainer,
            grandTotalContainer: familyGrandTotal,
            fields: [
                { key: 'personalExpense', label: '个人', class: 'cost' },
                { key: 'familyExpense', label: '家庭', class: 'goods' }
            ],
            detailFields: [
                { key: 'personalExpense', label: '个人', class: 'cost' },
                { key: 'familyExpense', label: '家庭', class: 'goods' }
            ],
            profitConfig: null,
            showDetails: true,
            dateKey: 'date',
            personKey: 'person',
            noteKey: 'note',
            createdAtKey: 'createdAt',
        },
        listConfig: {
            fields: [
                { key: 'personalExpense', label: '个人', class: 'cost' },
                { key: 'familyExpense', label: '家庭', class: 'goods' }
            ],
            path: 'familyExpenses',
            dateKey: 'date',
            timeKey: 'createdAt',
            personKey: 'person',
            noteKey: 'note',
        },
        dateInput: familyDateInput,
        dateStateKey: 'familyDate',
        clearBtn: clearFamilyBtn,
        recordsStateKey: 'familyRecords',
        confirmMsg: '确定清空所有支出记录吗？不可恢复！',
        submitConfig: {
            dbPath: 'familyExpenses',
            fields: [
                { dom: personalExpenseInput, key: 'personalExpense', parse: parseFloat },
                { dom: familyExpenseInput, key: 'familyExpense', parse: parseFloat }
            ],
            noteDom: familyNoteInput,
            buttonDom: familySubmitBtn,
            dateStateKey: 'familyDate',
            onSuccess: () => {
                personalExpenseInput.value = '';
                familyExpenseInput.value = '';
                familyNoteInput.value = '';
                personalExpenseInput.focus();
            }
        }
    },
    debt: {
        dbPath: 'debtRecords',
        statsConfig: {
            container: debtStats,
            grandTotalContainer: null,
            fields: [
                { key: 'amount', label: '欠款', class: 'cost' },
                { key: 'goodsAmount', label: '货款欠款', class: 'goods' }
            ],
            detailFields: [],
            profitConfig: null,
            showDetails: false,
            dateKey: 'date',
            personKey: 'person',
            noteKey: 'note',
            createdAtKey: 'createdAt',
        },
        listConfig: {
            fields: [
                { key: 'amount', label: '欠款', class: 'cost' },
                { key: 'goodsAmount', label: '货款欠款', class: 'goods' }
            ],
            path: 'debtRecords',
            dateKey: 'date',
            timeKey: 'createdAt',
            personKey: 'person',
            noteKey: 'note',
        },
        dateInput: debtDateInput,
        dateStateKey: 'debtDate',
        clearBtn: clearDebtBtn,
        recordsStateKey: 'debtRecords',
        confirmMsg: '确定清空所有债务记录吗？不可恢复！',
        submitConfig: {
            dbPath: 'debtRecords',
            fields: [
                { dom: debtAmount, key: 'amount', parse: parseFloat },
                { dom: debtGoodsAmount, key: 'goodsAmount', parse: parseFloat }
            ],
            noteDom: debtNote,
            buttonDom: debtSubmitBtn,
            dateStateKey: 'debtDate',
            onSuccess: () => {
                debtAmount.value = '';
                debtGoodsAmount.value = '';
                debtNote.value = '';
                debtAmount.focus();
            }
        }
    }
};

// ================================================================
//  8.  具体渲染函数
// ================================================================
function renderIncomeStats() {
    renderStatsGeneric(state.incomeRecords, state.incomeDate, MODULES.income.statsConfig);
}
function renderFamilyStats() {
    renderStatsGeneric(state.familyRecords, state.familyDate, MODULES.family.statsConfig);
}
function renderDebtStats() {
    renderStatsGeneric(state.debtRecords, state.debtDate, MODULES.debt.statsConfig);
}

function renderIncomeList() {
    renderListGeneric(state.incomeRecords, incomeRecordList, MODULES.income.listConfig);
}
function renderFamilyList() {
    renderListGeneric(state.familyRecords, familyRecordList, MODULES.family.listConfig);
}
function renderDebtList() {
    renderListGeneric(state.debtRecords, debtRecordList, MODULES.debt.listConfig);
}

// ================================================================
//  9.  提交逻辑
// ================================================================
function submitRecord(config) {
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    const person = state.currentPerson;
    const {
        dbPath,
        fields,
        noteDom,
        dateStateKey,
        onSuccess,
    } = config;

    const record = { 
        person, 
        note: noteDom.value.trim() || '', 
        createdAt: Date.now() 
    };
    if (dateStateKey && state[dateStateKey]) {
        record.date = state[dateStateKey];
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
            showToast('记录成功！');
            if (onSuccess) onSuccess();
        })
        .catch((err) => { console.error(err); showToast('提交失败'); })
        .finally(() => { btn.disabled = false; btn.textContent = '记录'; });
}

submitBtn.addEventListener('click', function() {
    submitRecord(MODULES.income.submitConfig);
});
familySubmitBtn.addEventListener('click', function() {
    submitRecord(MODULES.family.submitConfig);
});
debtSubmitBtn.addEventListener('click', function() {
    submitRecord(MODULES.debt.submitConfig);
});

// ================================================================
//  10. 清除逻辑
// ================================================================
function clearRecords(dbPath, records, confirmMsg) {
    if (!records || records.length === 0) { showToast('没有记录'); return; }
    if (confirm(confirmMsg)) {
        db.ref(dbPath).remove()
            .then(() => showToast('已清空'))
            .catch(() => showToast('清空失败'));
    }
}

clearIncomeBtn.addEventListener('click', function() {
    clearRecords(MODULES.income.dbPath, state[MODULES.income.recordsStateKey], MODULES.income.confirmMsg);
});
clearFamilyBtn.addEventListener('click', function() {
    clearRecords(MODULES.family.dbPath, state[MODULES.family.recordsStateKey], MODULES.family.confirmMsg);
});
clearDebtBtn.addEventListener('click', function() {
    clearRecords(MODULES.debt.dbPath, state[MODULES.debt.recordsStateKey], MODULES.debt.confirmMsg);
});

// ================================================================
//  11. 日期选择器
// ================================================================
const dateModules = ['income', 'family', 'debt'];
dateModules.forEach(moduleKey => {
    const mod = MODULES[moduleKey];
    if (mod.dateInput) {
        mod.dateInput.value = getTodayStr();
        mod.dateInput.addEventListener('change', function() {
            state[mod.dateStateKey] = this.value;
            if (moduleKey === 'income') {
                renderIncomeStats();
                renderIncomeList();
            } else if (moduleKey === 'family') {
                renderFamilyStats();
                renderFamilyList();
            } else if (moduleKey === 'debt') {
                renderDebtStats();
                renderDebtList();
                renderRepaymentResults();
            }
        });
    }
});

// ================================================================
//  12. 数据读取 & 实时更新
// ================================================================
function loadData() {
    if (!isFirebaseReady) {
        showToast('数据库未连接');
        return;
    }

    const dbModules = [
        {
            key: 'income',
            path: 'familyRecords',
            recordsStateKey: 'incomeRecords',
            renderStats: renderIncomeStats,
            renderList: renderIncomeList,
        },
        {
            key: 'family',
            path: 'familyExpenses',
            recordsStateKey: 'familyRecords',
            renderStats: renderFamilyStats,
            renderList: renderFamilyList,
        },
        {
            key: 'debt',
            path: 'debtRecords',
            recordsStateKey: 'debtRecords',
            renderStats: renderDebtStats,
            renderList: renderDebtList,
        }
    ];

    dbModules.forEach(({ path, recordsStateKey, renderStats, renderList }) => {
        db.ref(path).on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                state[recordsStateKey] = [];
                renderStats();
                renderList();
                if (recordsStateKey === 'debtRecords') renderRepaymentResults();
                return;
            }
            const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            state[recordsStateKey] = records;
            renderStats();
            renderList();
            if (recordsStateKey === 'debtRecords') renderRepaymentResults();
        }, (err) => {
            console.error(err);
            showToast(`读取 ${path} 数据失败`);
        });
    });
}

// ================================================================
//  13. 删除事件委托
// ================================================================
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
//  14. 还款功能
// ================================================================

function renderRepaymentResults() {
    const keyword = repaymentSearch.value.trim();
    state.repaymentSearchKeyword = keyword;

    let filtered = state.debtRecords;

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

    const sorted = [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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
        if (!stillExists) {
            state.selectedDebtId = null;
        }
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

    if (state.selectedDebtId === id) {
        state.selectedDebtId = null;
    } else {
        state.selectedDebtId = id;
    }
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

    const selectedRecord = state.debtRecords.find(r => r.id === state.selectedDebtId);
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
            showToast(`还款成功！${typeLabel}减少 ¥${toFixed(amount)}`);
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
//  15. 更新公告逻辑
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
//  16. 启动 & 快捷键
// ================================================================
loadData();
document.getElementById('version').textContent = APP_VERSION;

setTimeout(() => {
    checkUpdateModal();
}, 500);

// 键盘跳转
incomeAmtInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goodsInput.focus(); } });
goodsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); noteInput.focus(); } });
personalExpenseInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); familyExpenseInput.focus(); } });
familyExpenseInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); familyNoteInput.focus(); } });
debtAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); debtGoodsAmount.focus(); } });
debtGoodsAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); debtNote.focus(); } });

repaymentAmount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        repaymentSubmitBtn.click();
    }
});

// 点击统计卡片切换人员
incomeStatsContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.member-stat-card');
    if (!card) return;
    const nameEl = card.querySelector('.member-stat-header .name');
    if (!nameEl) return;
    const name = nameEl.textContent.trim();
    if (PERSON_NAMES.includes(name)) {
        personBtns.forEach(b => b.classList.toggle('active', b.dataset.person === name));
        state.currentPerson = name;
        showToast(`切换到 ${name}`);
    }
});

console.log(`版本 ${APP_VERSION} 已启动`);