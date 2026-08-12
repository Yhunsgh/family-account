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

const PERSON_KEYS = ['刘力伟', '郑少容'];   // 直接使用真实姓名
const INCOME_NODE = 'familyRecords';
const DEBT_NODE = 'debtRecords';

let db = null;
let isFirebaseReady = false;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    isFirebaseReady = true;
} catch (err) {
    console.error('Firebase 初始化失败:', err);
    showToast('⚠️ Firebase 配置有误，请检查 config');
}

// ================================================================
//  2.  应用状态
// ================================================================
const state = {
    currentPerson: '刘力伟',   // 直接存姓名
    records: [],
    debtRecords: [],
    selectedDate: new Date().toISOString().slice(0, 10),
};

// DOM 引用
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const personBtns = $$('.person-btn');
const expenseInput = $('#expenseAmt');
const incomeAmtInput = $('#incomeAmt');
const goodsInput = $('#goodsAmt');
const noteInput = $('#noteInput');
const submitBtn = $('#submitBtn');
const statsContainer = $('#statsContainer');
const grandTotal = $('#grandTotal');
const recordList = $('#recordList');
const selectedDateInput = $('#selectedDate');
const clearAllBtn = $('#clearAllBtn');

const debtAmount = $('#debtAmount');
const debtGoodsAmount = $('#debtGoodsAmount');
const debtNote = $('#debtNote');
const debtSubmitBtn = $('#debtSubmitBtn');
const debtRecordList = $('#debtRecordList');
const clearDebtBtn = $('#clearDebtBtn');
const debtStats = $('#debtStats');

// ================================================================
//  3.  工具函数
// ================================================================
const formatDate = dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}月${d.getDate()}日`;
};
const formatTime = ts => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const toFixed = v => Number(v).toFixed(2);
const parseFloatInput = val => parseFloat(val) || 0;
const getTodayStr = () => new Date().toISOString().slice(0, 10);

let toastTimer;
const showToast = (msg, duration = 2000) => {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
};

// ================================================================
//  4.  人员切换
// ================================================================
const switchPerson = personName => {
    personBtns.forEach(b => b.classList.toggle('active', b.dataset.person === personName));
    state.currentPerson = personName;
};

personBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        switchPerson(this.dataset.person);
    });
});
// 初始化高亮
personBtns.forEach(btn => {
    if (btn.dataset.person === state.currentPerson) btn.classList.add('active');
});

// ================================================================
//  5.  键盘导航
// ================================================================
const setupEnterNavigation = (inputs, submitBtn) => {
    inputs.forEach((input, i) => {
        if (i < inputs.length - 1) {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); inputs[i + 1].focus(); }
            });
        }
    });
    const lastInput = inputs[inputs.length - 1];
    if (lastInput) {
        lastInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitBtn.click(); }
        });
    }
};

setupEnterNavigation([expenseInput, incomeAmtInput, goodsInput, noteInput], submitBtn);
setupEnterNavigation([debtAmount, debtGoodsAmount, debtNote], debtSubmitBtn);

// ================================================================
//  6.  提交记录（通用）
// ================================================================
const submitRecord = (refPath, fields, submitBtn) => {
    if (!isFirebaseReady) { showToast('⚠️ 数据库未连接'); return; }
    const person = state.currentPerson;   // 直接使用姓名
    const values = fields.map(f => parseFloatInput(f.value));
    const note = fields[fields.length - 1].value.trim() || '';
    if (values.every(v => v === 0)) {
        showToast('⚠️ 至少填一项金额');
        return;
    }

    const record = { person, ...fields.reduce((acc, f, i) => ({ ...acc, [f.key]: values[i] }), {}) };
    if (note) record.note = note;
    record.createdAt = Date.now();

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    db.ref(refPath).push().set(record)
        .then(() => {
            showToast('记录成功！');
            fields.forEach(f => f.value = '');
            fields[0].focus();
        })
        .catch(err => { console.error(err); showToast('❌ 提交失败'); })
        .finally(() => { submitBtn.disabled = false; submitBtn.textContent = '记录'; });
};

submitBtn.addEventListener('click', () => {
    submitRecord(INCOME_NODE, [
        { key: 'expense', value: expenseInput },
        { key: 'income', value: incomeAmtInput },
        { key: 'goods', value: goodsInput },
        { key: 'note', value: noteInput }
    ], submitBtn);
});

debtSubmitBtn.addEventListener('click', () => {
    submitRecord(DEBT_NODE, [
        { key: 'amount', value: debtAmount },
        { key: 'goodsAmount', value: debtGoodsAmount },
        { key: 'note', value: debtNote }
    ], debtSubmitBtn);
});

// ================================================================
//  7.  日期选择器
// ================================================================
selectedDateInput.value = getTodayStr();
selectedDateInput.addEventListener('change', function() {
    state.selectedDate = this.value;
    renderIncomeStats();
});

// ================================================================
//  8.  数据读取 & 实时更新
// ================================================================
const loadData = () => {
    if (!isFirebaseReady) {
        renderEmptyState('等待数据库连接...');
        return;
    }

    db.ref(INCOME_NODE).on('value', snapshot => {
        const data = snapshot.val();
        state.records = data ? Object.keys(data).map(id => ({ id, ...data[id] })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
        renderIncomeStats();
        renderIncomeList();
    }, err => { console.error(err); showToast('⚠️ 读取收支数据失败'); });

    db.ref(DEBT_NODE).on('value', snapshot => {
        const data = snapshot.val();
        state.debtRecords = data ? Object.keys(data).map(id => ({ id, ...data[id] })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
        renderDebtStats();
        renderDebtList();
    }, err => { console.error(err); showToast('⚠️ 读取债务数据失败'); });
};

// ================================================================
//  9.  通用列表渲染
// ================================================================
const renderRecordList = (records, container, renderRight, dateKey = 'date', timeKey = 'createdAt') => {
    if (!records || records.length === 0) {
        container.innerHTML = `<div class="empty-state">还没有记录</div>`;
        return;
    }
    let html = '';
    records.slice(0, 50).forEach((r, i) => {
        const displayName = r.person;   // 直接取数据库中的姓名
        const note = r.note || '';
        const dateStr = dateKey === 'date' ? formatDate(r[dateKey]) : formatTime(r[timeKey]);
        const rightHtml = renderRight(r);
        html += `
            <div class="record-item" style="animation-delay:${i * 20}ms">
                <div class="left">
                    <div class="top">
                        <span class="pname">${displayName}</span>
                        <span class="pdate">${dateStr}</span>
                    </div>
                    ${note ? `<div class="note">${note}</div>` : ''}
                </div>
                <div class="right">
                    ${rightHtml}
                    <button class="del-btn" data-id="${r.id}" data-type="${r.type || 'income'}" title="删除">✕</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    container.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const node = btn.dataset.type === 'debt' ? DEBT_NODE : INCOME_NODE;
            if (id && confirm('确定删除这条记录吗？')) deleteRecord(id, node);
        });
    });
};

// ================================================================
//  10. 渲染：收支统计
// ================================================================
const renderIncomeStats = () => {
    const dayRecords = state.records.filter(r => r.date === state.selectedDate);

    const totalIncome = dayRecords.reduce((s, r) => s + (r.income || 0), 0);
    const totalGoods = dayRecords.reduce((s, r) => s + (r.goods || 0), 0);
    const profit = totalIncome - totalGoods;

    let html = `<div class="profit-card">
        <span class="profit-label">所选日期 (${formatDate(state.selectedDate)}) 盈利</span>
        <span class="profit-amount ${profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'zero'}">¥${toFixed(profit)}</span>
    </div>`;

    PERSON_KEYS.forEach(name => {
        const pRecords = dayRecords.filter(r => r.person === name);
        const totalExpense = pRecords.reduce((s, r) => s + (r.expense || 0), 0);
        const totalIncome = pRecords.reduce((s, r) => s + (r.income || 0), 0);
        const totalGoods = pRecords.reduce((s, r) => s + (r.goods || 0), 0);

        html += `<div class="member-stat-card">
            <div class="member-stat-header">
                <span class="name">${name}</span>
                <span class="totals">
                    <span class="cost">-¥${toFixed(totalExpense)}</span>
                    <span class="income">+¥${toFixed(totalIncome)}</span>
                    <span class="goods">货款 ¥${toFixed(totalGoods)}</span>
                    <span class="count">${pRecords.length}笔</span>
                </span>
            </div>`;

        if (pRecords.length === 0) {
            html += `<div class="member-detail-list"><div class="detail-empty">当天无记录</div></div>`;
        } else {
            html += `<div class="member-detail-list">`;
            [...pRecords].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach(r => {
                const { expense = 0, income = 0, goods = 0, note = '' } = r;
                let amtHtml = '';
                if (expense > 0) amtHtml += `<span class="cost">-¥${toFixed(expense)}</span>`;
                if (income > 0) amtHtml += `<span class="income">+¥${toFixed(income)}</span>`;
                if (goods > 0) amtHtml += `<span class="goods">货款 ¥${toFixed(goods)}</span>`;
                if (!amtHtml) amtHtml = `<span>—</span>`;
                html += `<div class="detail-item">
                    <div class="left">
                        <span class="date">${formatDate(r.date)}</span>
                        ${note ? `<span class="note" title="${note}">${note}</span>` : ''}
                    </div>
                    <div class="right">${amtHtml}</div>
                </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });

    statsContainer.innerHTML = html;

    const allExpense = dayRecords.reduce((s, r) => s + (r.expense || 0), 0);
    const allIncome = dayRecords.reduce((s, r) => s + (r.income || 0), 0);
    const allGoods = dayRecords.reduce((s, r) => s + (r.goods || 0), 0);
    grandTotal.innerHTML = `
        <div class="item">总支出 <span class="num cost">¥${toFixed(allExpense)}</span></div>
        <div class="item">总收入 <span class="num income">¥${toFixed(allIncome)}</span></div>
        <div class="item">总货款 <span class="num goods">¥${toFixed(allGoods)}</span></div>
    `;
};

// ================================================================
//  11. 渲染：收支全部记录
// ================================================================
const renderIncomeList = () => {
    renderRecordList(state.records, recordList, r => {
        const { expense = 0, income = 0, goods = 0 } = r;
        let html = '';
        if (expense > 0) html += `<span class="cost">-¥${toFixed(expense)}</span>`;
        if (income > 0) html += `<span class="income">+¥${toFixed(income)}</span>`;
        if (goods > 0) html += `<span class="goods">货款 ¥${toFixed(goods)}</span>`;
        return html || `<span class="empty">—</span>`;
    }, 'date');
};

// ================================================================
//  12. 渲染：债务统计
// ================================================================
const renderDebtStats = () => {
    const records = state.debtRecords;
    let html = '';
    PERSON_KEYS.forEach(name => {
        const pRecords = records.filter(r => r.person === name);
        const totalAmount = pRecords.reduce((s, r) => s + (r.amount || 0), 0);
        const totalGoodsAmount = pRecords.reduce((s, r) => s + (r.goodsAmount || 0), 0);
        html += `
            <div class="member-stat-card" style="margin-bottom:12px;">
                <div class="member-stat-header">
                    <span class="name">${name}</span>
                    <span class="totals">
                        <span class="cost">欠款 ¥${toFixed(totalAmount)}</span>
                        <span class="goods">货款欠款 ¥${toFixed(totalGoodsAmount)}</span>
                    </span>
                </div>
            </div>
        `;
    });
    debtStats.innerHTML = html || `<div class="empty-state">暂无债务记录</div>`;
};

// ================================================================
//  13. 渲染：债务全部记录
// ================================================================
const renderDebtList = () => {
    renderRecordList(state.debtRecords, debtRecordList, r => {
        const { amount = 0, goodsAmount = 0 } = r;
        let html = '';
        if (amount > 0) html += `<span class="cost">欠款 ¥${toFixed(amount)}</span>`;
        if (goodsAmount > 0) html += `<span class="goods">货款欠款 ¥${toFixed(goodsAmount)}</span>`;
        return html || `<span class="empty">—</span>`;
    }, null, 'createdAt');
};

// ================================================================
//  14. 删除 & 清空
// ================================================================
const deleteRecord = (id, node) => {
    if (!isFirebaseReady) return;
    db.ref(`${node}/${id}`).remove()
        .then(() => showToast('已删除'))
        .catch(() => showToast('删除失败'));
};

const clearRecords = (node, records, confirmMsg) => {
    if (records.length === 0) { showToast('没有记录'); return; }
    if (confirm(confirmMsg)) {
        if (!isFirebaseReady) return;
        db.ref(node).remove()
            .then(() => showToast('已清空'))
            .catch(() => showToast('清空失败'));
    }
};

clearAllBtn.addEventListener('click', () => clearRecords(INCOME_NODE, state.records, '确定清空所有收支记录吗？不可恢复！'));
clearDebtBtn.addEventListener('click', () => clearRecords(DEBT_NODE, state.debtRecords, '确定清空所有债务记录吗？不可恢复！'));

// ================================================================
//  15. 空状态
// ================================================================
const renderEmptyState = msg => {
    statsContainer.innerHTML = `<div class="member-stat-card" style="text-align:center;color:#b8a392;padding:20px;">${msg}</div>`;
    grandTotal.innerHTML = '';
    recordList.innerHTML = `<div class="empty-state">${msg}</div>`;
};

// ================================================================
//  16. 点击统计卡片切换人员
// ================================================================
statsContainer.addEventListener('click', e => {
    const card = e.target.closest('.member-stat-card');
    if (!card) return;
    const nameEl = card.querySelector('.member-stat-header .name');
    if (!nameEl) return;
    const name = nameEl.textContent.trim();
    if (PERSON_KEYS.includes(name)) {
        switchPerson(name);
        showToast(`切换到 ${name}`);
    }
});

// ================================================================
//  17. 更新公告（可选）
// ================================================================
const UPDATE_LOGS = {
    'v0.01': [
        '优化代码结构，提升性能',
    ],
    'v0.02': [
        '优化代码结构，提升性能',
    ],
    'v0.03': [
        '优化代码结构，提升性能',
    ],
    'v0.04': [
        '优化代码结构，提升性能',
    ],
    'v0.09': [
        '新增债务记录模块，支持欠款和货款欠款',
        '优化代码结构，提升性能'
    ],
    'v0.10': [
        '数据库直接存储真实姓名，不再使用映射',
        '界面显示直接使用数据库中的姓名',
        '代码结构优化，逻辑更清晰'
    ],
};

const modalOverlay = document.getElementById('updateModal');
const oldVersionSpan = document.getElementById('oldVersion');
const newVersionSpan = document.getElementById('newVersion');
const updateListEl = document.getElementById('updateList');
const dontShowAgainCheck = document.getElementById('dontShowAgain');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

function checkUpdateModal() {
    const currentVersion = document.getElementById('version').textContent.trim();
    let lastShownVersion = localStorage.getItem('lastShownVersion') || 'v0.0';
    const ignoredVersion = localStorage.getItem('ignoredVersion');
    if (ignoredVersion === currentVersion) return;

    const updateItems = UPDATE_LOGS[currentVersion] || ['本次更新内容未填写'];
    oldVersionSpan.textContent = lastShownVersion;
    newVersionSpan.textContent = currentVersion;
    updateListEl.innerHTML = updateItems.map(item => `<li>${item}</li>`).join('');
    modalOverlay.classList.add('active');
}

modalConfirmBtn.addEventListener('click', function() {
    const currentVersion = document.getElementById('version').textContent.trim();
    if (dontShowAgainCheck.checked) {
        localStorage.setItem('ignoredVersion', currentVersion);
    }
    localStorage.setItem('lastShownVersion', currentVersion);
    modalOverlay.classList.remove('active');
});

// ================================================================
//  18. 启动
// ================================================================
loadData();

setTimeout(() => {
    checkUpdateModal();
}, 500);