// ================================================================
//  0.  版本与更新公告（版本号从 HTML 读取，更新日志在此维护）
// ================================================================
const UPDATE_LOGS = {
    'v0.01': [
        '优化代码结构，提升性能'
    ],
    'v0.02': [
        '优化代码结构，提升性能'
    ],
    'v0.03': [
        '优化代码结构，提升性能'
    ],
    'v0.04': [
        '优化代码结构，提升性能'
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
    'v0.11': [
        '增加家庭支出模块，支持个人支出和家庭支出记录',
        '彻底移除映射，数据库直接存储真实姓名',
        '所有界面直接显示数据库中的姓名，不再依赖前端映射',
        '优化逻辑，修复已知问题',
        '优化代码结构，提升性能'
    ]
};

// 弹窗 DOM
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
    if (currentVersion === lastShownVersion) return;

    const updateItems = UPDATE_LOGS[currentVersion] || ['本次更新内容未填写，请查看代码中的 UPDATE_LOGS'];
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
//  1.  Firebase 配置（请替换为你的真实配置）
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
    console.log("✅ Firebase 初始化成功");
} catch (err) {
    console.error("❌ Firebase 初始化失败:", err);
    showToast("⚠️ Firebase 配置有误，请检查 config");
}

// ================================================================
//  2.  人员常量（直接使用真实姓名）
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
};

// DOM 引用
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// 人员
const personBtns = $$('.person-btn');

// 收支
const expenseInput = $('#expenseAmt');
const incomeAmtInput = $('#incomeAmt');
const goodsInput = $('#goodsAmt');
const noteInput = $('#noteInput');
const submitBtn = $('#submitBtn');
const incomeStatsContainer = $('#incomeStatsContainer');
const incomeGrandTotal = $('#incomeGrandTotal');
const incomeRecordList = $('#incomeRecordList');
const incomeDateInput = $('#incomeDate');
const clearIncomeBtn = $('#clearIncomeBtn');

// 家庭支出
const personalExpenseInput = $('#personalExpense');
const familyExpenseInput = $('#familyExpense');
const familyNoteInput = $('#familyNote');
const familySubmitBtn = $('#familySubmitBtn');
const familyStatsContainer = $('#familyStatsContainer');
const familyGrandTotal = $('#familyGrandTotal');
const familyRecordList = $('#familyRecordList');
const familyDateInput = $('#familyDate');
const clearFamilyBtn = $('#clearFamilyBtn');

// 债务
const debtAmount = $('#debtAmount');
const debtGoodsAmount = $('#debtGoodsAmount');
const debtNote = $('#debtNote');
const debtSubmitBtn = $('#debtSubmitBtn');
const debtRecordList = $('#debtRecordList');
const debtStats = $('#debtStats');
const clearDebtBtn = $('#clearDebtBtn');

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
//  5.  人员选择
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
//  6.  提交收支记录
// ================================================================
submitBtn.addEventListener('click', function() {
    if (!isFirebaseReady) { showToast('⚠️ 数据库未连接'); return; }
    const person = state.currentPerson;
    const expense = parseFloat(expenseInput.value) || 0;
    const income = parseFloat(incomeAmtInput.value) || 0;
    const goods = parseFloat(goodsInput.value) || 0;
    const note = noteInput.value.trim() || '';
    if (expense === 0 && income === 0 && goods === 0) {
        showToast('⚠️ 支出、收入或货款至少填一项');
        return;
    }
    const record = {
        person: person,
        date: state.incomeDate,
        expense: expense,
        income: income,
        goods: goods,
        note: note,
        createdAt: Date.now(),
    };
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    const newRef = db.ref('familyRecords').push();
    newRef.set(record)
        .then(() => {
            showToast('记录成功！');
            expenseInput.value = '';
            incomeAmtInput.value = '';
            goodsInput.value = '';
            noteInput.value = '';
            expenseInput.focus();
        })
        .catch((err) => { console.error(err); showToast('❌ 提交失败'); })
        .finally(() => { submitBtn.disabled = false; submitBtn.textContent = '记录'; });
});
noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitBtn.click(); }
});

// ================================================================
//  7.  提交家庭支出记录
// ================================================================
familySubmitBtn.addEventListener('click', function() {
    if (!isFirebaseReady) { showToast('⚠️ 数据库未连接'); return; }
    const person = state.currentPerson;
    const personal = parseFloat(personalExpenseInput.value) || 0;
    const family = parseFloat(familyExpenseInput.value) || 0;
    const note = familyNoteInput.value.trim() || '';
    if (personal === 0 && family === 0) {
        showToast('⚠️ 个人支出或家庭支出至少填一项');
        return;
    }
    const record = {
        person: person,
        date: state.familyDate,
        personalExpense: personal,
        familyExpense: family,
        note: note,
        createdAt: Date.now(),
    };
    familySubmitBtn.disabled = true;
    familySubmitBtn.textContent = '提交中...';
    const newRef = db.ref('familyExpenses').push();
    newRef.set(record)
        .then(() => {
            showToast('家庭支出记录成功！');
            personalExpenseInput.value = '';
            familyExpenseInput.value = '';
            familyNoteInput.value = '';
            personalExpenseInput.focus();
        })
        .catch((err) => { console.error(err); showToast('❌ 提交失败'); })
        .finally(() => { familySubmitBtn.disabled = false; familySubmitBtn.textContent = '记录'; });
});
familyNoteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); familySubmitBtn.click(); }
});

// ================================================================
//  8.  提交债务记录
// ================================================================
debtSubmitBtn.addEventListener('click', function() {
    if (!isFirebaseReady) { showToast('⚠️ 数据库未连接'); return; }
    const person = state.currentPerson;
    const amount = parseFloat(debtAmount.value) || 0;
    const goodsAmount = parseFloat(debtGoodsAmount.value) || 0;
    const note = debtNote.value.trim() || '';
    if (amount === 0 && goodsAmount === 0) {
        showToast('⚠️ 欠款或货款欠款至少填一项');
        return;
    }
    const record = {
        person: person,
        amount: amount,
        goodsAmount: goodsAmount,
        note: note,
        createdAt: Date.now(),
    };
    debtSubmitBtn.disabled = true;
    debtSubmitBtn.textContent = '提交中...';
    const newRef = db.ref('debtRecords').push();
    newRef.set(record)
        .then(() => {
            showToast('债务记录成功！');
            debtAmount.value = '';
            debtGoodsAmount.value = '';
            debtNote.value = '';
            debtAmount.focus();
        })
        .catch((err) => { console.error(err); showToast('❌ 提交失败'); })
        .finally(() => { debtSubmitBtn.disabled = false; debtSubmitBtn.textContent = '记录'; });
});
debtNote.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); debtSubmitBtn.click(); }
});

// ================================================================
//  9.  日期选择器
// ================================================================
incomeDateInput.value = getTodayStr();
incomeDateInput.addEventListener('change', function() {
    state.incomeDate = this.value;
    renderIncomeStats();
    renderIncomeList();
});

familyDateInput.value = getTodayStr();
familyDateInput.addEventListener('change', function() {
    state.familyDate = this.value;
    renderFamilyStats();
    renderFamilyList();
});

// ================================================================
//  10. 数据读取 & 实时更新
// ================================================================
function loadData() {
    if (!isFirebaseReady) {
        showToast('⚠️ 数据库未连接');
        return;
    }
    // 收支
    db.ref('familyRecords').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) { state.incomeRecords = []; renderIncomeStats(); renderIncomeList(); return; }
        const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        state.incomeRecords = records;
        renderIncomeStats();
        renderIncomeList();
    }, (err) => { console.error(err); showToast('⚠️ 读取收支数据失败'); });

    // 家庭支出
    db.ref('familyExpenses').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) { state.familyRecords = []; renderFamilyStats(); renderFamilyList(); return; }
        const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        state.familyRecords = records;
        renderFamilyStats();
        renderFamilyList();
    }, (err) => { console.error(err); showToast('⚠️ 读取家庭支出数据失败'); });

    // 债务
    db.ref('debtRecords').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) { state.debtRecords = []; renderDebtStats(); renderDebtList(); return; }
        const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        state.debtRecords = records;
        renderDebtStats();
        renderDebtList();
    }, (err) => { console.error(err); showToast('⚠️ 读取债务数据失败'); });
}

// ================================================================
//  11. 渲染：收支统计（按人、按日期）
// ================================================================
function renderIncomeStats() {
    const records = state.incomeRecords;
    const selectedDate = state.incomeDate;
    const dayRecords = records.filter(r => r.date === selectedDate);

    const totalIncomeAll = dayRecords.reduce((s, r) => s + (r.income || 0), 0);
    const totalGoodsAll = dayRecords.reduce((s, r) => s + (r.goods || 0), 0);
    const profit = totalIncomeAll - totalGoodsAll;

    let html = `<div class="profit-card">
        <span class="profit-label">所选日期 (${formatDate(selectedDate)}) 盈利</span>
        <span class="profit-amount ${profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'zero'}">¥${toFixed(profit)}</span>
    </div>`;

    PERSON_NAMES.forEach(name => {
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
            const sorted = [...pRecords].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            sorted.forEach(r => {
                const expense = r.expense || 0;
                const income = r.income || 0;
                const goods = r.goods || 0;
                const note = r.note || '';
                let amt = '';
                if (expense > 0) amt += `<span class="cost">-¥${toFixed(expense)}</span>`;
                if (income > 0) amt += `<span class="income">+¥${toFixed(income)}</span>`;
                if (goods > 0) amt += `<span class="goods">货款 ¥${toFixed(goods)}</span>`;
                if (!amt) amt = `<span>—</span>`;
                html += `<div class="detail-item">
                    <div class="left">
                        <span class="date">${formatDate(r.date)}</span>
                        ${note ? `<span class="note" title="${note}">${note}</span>` : ''}
                    </div>
                    <div class="right">${amt}</div>
                </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });
    incomeStatsContainer.innerHTML = html;

    const allExpense = dayRecords.reduce((s, r) => s + (r.expense || 0), 0);
    const allIncome = dayRecords.reduce((s, r) => s + (r.income || 0), 0);
    const allGoods = dayRecords.reduce((s, r) => s + (r.goods || 0), 0);
    incomeGrandTotal.innerHTML = `
        <div class="item">总支出 <span class="num cost">¥${toFixed(allExpense)}</span></div>
        <div class="item">总收入 <span class="num income">¥${toFixed(allIncome)}</span></div>
        <div class="item">总货款 <span class="num goods">¥${toFixed(allGoods)}</span></div>
    `;
}

// ---------- 收支全部记录 ----------
function renderIncomeList() {
    const records = state.incomeRecords;
    if (!records || records.length === 0) {
        incomeRecordList.innerHTML = `<div class="empty-state">还没有收支记录</div>`;
        return;
    }
    const show = records.slice(0, 50);
    let html = '';
    show.forEach((r, idx) => {
        const name = r.person;
        const note = r.note || '';
        const expense = r.expense || 0;
        const income = r.income || 0;
        const goods = r.goods || 0;
        let right = '';
        if (expense > 0) right += `<span class="cost">-¥${toFixed(expense)}</span>`;
        if (income > 0) right += `<span class="income">+¥${toFixed(income)}</span>`;
        if (goods > 0) right += `<span class="goods">货款 ¥${toFixed(goods)}</span>`;
        if (!right) right = `<span class="empty">—</span>`;
        html += `
            <div class="record-item" data-id="${r.id}" style="animation-delay:${idx * 20}ms">
                <div class="left">
                    <div class="top">
                        <span class="pname">${name}</span>
                        <span class="pdate">${formatDate(r.date)}</span>
                    </div>
                    ${note ? `<div class="note">${note}</div>` : ''}
                </div>
                <div class="right">
                    ${right}
                    <button class="del-btn" data-id="${r.id}" data-type="income" title="删除">✕</button>
                </div>
            </div>
        `;
    });
    incomeRecordList.innerHTML = html;
    incomeRecordList.querySelectorAll('.del-btn[data-type="income"]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            if (id && confirm('确定删除这条收支记录吗？')) deleteRecord(id, 'familyRecords');
        });
    });
}

// ================================================================
//  12. 渲染：家庭支出统计（按人、按日期）
// ================================================================
function renderFamilyStats() {
    const records = state.familyRecords;
    const selectedDate = state.familyDate;
    const dayRecords = records.filter(r => r.date === selectedDate);

    let html = '';
    PERSON_NAMES.forEach(name => {
        const pRecords = dayRecords.filter(r => r.person === name);
        const totalPersonal = pRecords.reduce((s, r) => s + (r.personalExpense || 0), 0);
        const totalFamily = pRecords.reduce((s, r) => s + (r.familyExpense || 0), 0);

        html += `<div class="member-stat-card">
            <div class="member-stat-header">
                <span class="name">${name}</span>
                <span class="totals">
                    <span class="cost">个人 ¥${toFixed(totalPersonal)}</span>
                    <span class="goods">家庭 ¥${toFixed(totalFamily)}</span>
                    <span class="count">${pRecords.length}笔</span>
                </span>
            </div>`;
        if (pRecords.length === 0) {
            html += `<div class="member-detail-list"><div class="detail-empty">当天无记录</div></div>`;
        } else {
            html += `<div class="member-detail-list">`;
            const sorted = [...pRecords].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            sorted.forEach(r => {
                const personal = r.personalExpense || 0;
                const family = r.familyExpense || 0;
                const note = r.note || '';
                let amt = '';
                if (personal > 0) amt += `<span class="cost">个人 ¥${toFixed(personal)}</span>`;
                if (family > 0) amt += `<span class="goods">家庭 ¥${toFixed(family)}</span>`;
                if (!amt) amt = `<span>—</span>`;
                html += `<div class="detail-item">
                    <div class="left">
                        <span class="date">${formatDate(r.date)}</span>
                        ${note ? `<span class="note" title="${note}">${note}</span>` : ''}
                    </div>
                    <div class="right">${amt}</div>
                </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });
    familyStatsContainer.innerHTML = html || `<div class="empty-state">所选日期无记录</div>`;

    const allPersonal = dayRecords.reduce((s, r) => s + (r.personalExpense || 0), 0);
    const allFamily = dayRecords.reduce((s, r) => s + (r.familyExpense || 0), 0);
    familyGrandTotal.innerHTML = `
        <div class="item">个人总支出 <span class="num cost">¥${toFixed(allPersonal)}</span></div>
        <div class="item">家庭总支出 <span class="num goods">¥${toFixed(allFamily)}</span></div>
    `;
}

// ---------- 家庭支出全部记录 ----------
function renderFamilyList() {
    const records = state.familyRecords;
    if (!records || records.length === 0) {
        familyRecordList.innerHTML = `<div class="empty-state">还没有家庭支出记录</div>`;
        return;
    }
    const show = records.slice(0, 50);
    let html = '';
    show.forEach((r, idx) => {
        const name = r.person;
        const note = r.note || '';
        const personal = r.personalExpense || 0;
        const family = r.familyExpense || 0;
        let right = '';
        if (personal > 0) right += `<span class="cost">个人 ¥${toFixed(personal)}</span>`;
        if (family > 0) right += `<span class="goods">家庭 ¥${toFixed(family)}</span>`;
        if (!right) right = `<span class="empty">—</span>`;
        html += `
            <div class="record-item" data-id="${r.id}" style="animation-delay:${idx * 20}ms">
                <div class="left">
                    <div class="top">
                        <span class="pname">${name}</span>
                        <span class="pdate">${formatDate(r.date)}</span>
                    </div>
                    ${note ? `<div class="note">${note}</div>` : ''}
                </div>
                <div class="right">
                    ${right}
                    <button class="del-btn" data-id="${r.id}" data-type="family" title="删除">✕</button>
                </div>
            </div>
        `;
    });
    familyRecordList.innerHTML = html;
    familyRecordList.querySelectorAll('.del-btn[data-type="family"]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            if (id && confirm('确定删除这条家庭支出记录吗？')) deleteRecord(id, 'familyExpenses');
        });
    });
}

// ================================================================
//  13. 渲染：债务统计（按人，无日期）
// ================================================================
function renderDebtStats() {
    const records = state.debtRecords;
    let html = '';
    PERSON_NAMES.forEach(name => {
        const pRecords = records.filter(r => r.person === name);
        const totalAmount = pRecords.reduce((s, r) => s + (r.amount || 0), 0);
        const totalGoods = pRecords.reduce((s, r) => s + (r.goodsAmount || 0), 0);
        html += `
            <div class="member-stat-card" style="margin-bottom: 12px;">
                <div class="member-stat-header">
                    <span class="name">${name}</span>
                    <span class="totals">
                        <span class="cost">欠款 ¥${toFixed(totalAmount)}</span>
                        <span class="goods">货款欠款 ¥${toFixed(totalGoods)}</span>
                    </span>
                </div>
            </div>
        `;
    });
    debtStats.innerHTML = html || `<div class="empty-state">暂无债务记录</div>`;
}

// ---------- 债务全部记录 ----------
function renderDebtList() {
    const records = state.debtRecords;
    if (!records || records.length === 0) {
        debtRecordList.innerHTML = `<div class="empty-state">还没有债务记录</div>`;
        return;
    }
    const show = records.slice(0, 50);
    let html = '';
    show.forEach((r, idx) => {
        const name = r.person;
        const note = r.note || '';
        const amount = r.amount || 0;
        const goodsAmount = r.goodsAmount || 0;
        let right = '';
        if (amount > 0) right += `<span class="cost">欠款 ¥${toFixed(amount)}</span>`;
        if (goodsAmount > 0) right += `<span class="goods">货款欠款 ¥${toFixed(goodsAmount)}</span>`;
        if (!right) right = `<span class="empty">—</span>`;
        html += `
            <div class="record-item" data-id="${r.id}" style="animation-delay:${idx * 20}ms">
                <div class="left">
                    <div class="top">
                        <span class="pname">${name}</span>
                        <span class="pdate">${formatTime(r.createdAt)}</span>
                    </div>
                    ${note ? `<div class="note">${note}</div>` : ''}
                </div>
                <div class="right">
                    ${right}
                    <button class="del-btn" data-id="${r.id}" data-type="debt" title="删除">✕</button>
                </div>
            </div>
        `;
    });
    debtRecordList.innerHTML = html;
    debtRecordList.querySelectorAll('.del-btn[data-type="debt"]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            if (id && confirm('确定删除这条债务记录吗？')) deleteRecord(id, 'debtRecords');
        });
    });
}

// ================================================================
//  14. 删除 & 清空
// ================================================================
function deleteRecord(id, node) {
    if (!isFirebaseReady) return;
    db.ref(`${node}/${id}`).remove()
        .then(() => showToast('已删除'))
        .catch(() => showToast('删除失败'));
}

clearIncomeBtn.addEventListener('click', function() {
    if (state.incomeRecords.length === 0) { showToast('没有收支记录'); return; }
    if (confirm('确定清空所有收支记录吗？不可恢复！')) {
        db.ref('familyRecords').remove()
            .then(() => showToast('已清空'))
            .catch(() => showToast('清空失败'));
    }
});

clearFamilyBtn.addEventListener('click', function() {
    if (state.familyRecords.length === 0) { showToast('没有家庭支出记录'); return; }
    if (confirm('确定清空所有家庭支出记录吗？不可恢复！')) {
        db.ref('familyExpenses').remove()
            .then(() => showToast('已清空'))
            .catch(() => showToast('清空失败'));
    }
});

clearDebtBtn.addEventListener('click', function() {
    if (state.debtRecords.length === 0) { showToast('没有债务记录'); return; }
    if (confirm('确定清空所有债务记录吗？不可恢复！')) {
        db.ref('debtRecords').remove()
            .then(() => showToast('已清空'))
            .catch(() => showToast('清空失败'));
    }
});

// ================================================================
//  15. 启动 & 键盘快捷跳转
// ================================================================
loadData();

// 检查并显示更新公告（延迟以确保 DOM 就绪）
setTimeout(() => {
    checkUpdateModal();
}, 500);

// 输入框跳转（收支）
expenseInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); incomeAmtInput.focus(); } });
incomeAmtInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goodsInput.focus(); } });
goodsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); noteInput.focus(); } });

// 输入框跳转（家庭支出）
personalExpenseInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); familyExpenseInput.focus(); } });
familyExpenseInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); familyNoteInput.focus(); } });

// 输入框跳转（债务）
debtAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); debtGoodsAmount.focus(); } });
debtGoodsAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); debtNote.focus(); } });

// 点击统计卡片切换人员（收支模块）
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

console.log('✅ 三模块：收支账本 + 家庭支出 + 债务（v1.0 无映射版）已启动！');