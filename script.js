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
//  2.  应用状态
// ================================================================
const state = {
    currentPerson: '爸', // 存储内部代号，显示时映射
    records: [],
    selectedDate: new Date().toISOString().slice(0, 10),
};

// 姓名映射
const nameMap = {
    '爸': '刘力伟',
    '妈': '郑少容'
};

// 获取显示名称
function getDisplayName(personKey) {
    return nameMap[personKey] || personKey;
}

// DOM 引用
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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

// ================================================================
//  3.  工具函数
// ================================================================
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth()+1}月${d.getDate()}日`;
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
//  4.  人员选择
// ================================================================
personBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        personBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.currentPerson = this.dataset.person;
    });
});

// ================================================================
//  5.  提交记录
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
        date: state.selectedDate,
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
//  6.  日期选择器
// ================================================================
selectedDateInput.value = getTodayStr();
selectedDateInput.addEventListener('change', function() {
    state.selectedDate = this.value;
    renderAll();
});

// ================================================================
//  7.  数据读取 & 实时更新
// ================================================================
function loadData() {
    if (!isFirebaseReady) {
        renderEmptyState('等待数据库连接...');
        return;
    }
    const ref = db.ref('familyRecords');
    ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) { state.records = []; renderAll(); return; }
        const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        state.records = records;
        renderAll();
    }, (err) => { console.error(err); showToast('⚠️ 读取数据失败'); });
}

// ================================================================
//  8.  渲染
// ================================================================
function renderAll() {
    renderStats();
    renderRecords();
}

// ---------- 统计看板 ----------
function renderStats() {
    const records = state.records;
    const selectedDate = state.selectedDate;
    const dayRecords = records.filter(r => r.date === selectedDate);
    // 使用内部键名，但显示时映射
    const personKeys = ['爸', '妈'];

    const totalIncomeAll = dayRecords.reduce((sum, r) => sum + (r.income || 0), 0);
    const totalGoodsAll = dayRecords.reduce((sum, r) => sum + (r.goods || 0), 0);
    const profit = totalIncomeAll - totalGoodsAll;

    let profitHtml = `<div class="profit-card">`;
    profitHtml += `<span class="profit-label">所选日期 (${formatDate(selectedDate)}) 盈利</span>`;
    let profitClass = 'zero';
    if (profit > 0) profitClass = 'positive';
    else if (profit < 0) profitClass = 'negative';
    profitHtml += `<span class="profit-amount ${profitClass}">¥${toFixed(profit)}</span>`;
    profitHtml += `</div>`;

    let html = profitHtml;
    personKeys.forEach(key => {
        const pRecords = dayRecords.filter(r => r.person === key);
        const totalExpense = pRecords.reduce((sum, r) => sum + (r.expense || 0), 0);
        const totalIncome = pRecords.reduce((sum, r) => sum + (r.income || 0), 0);
        const totalGoods = pRecords.reduce((sum, r) => sum + (r.goods || 0), 0);

        const displayName = getDisplayName(key);

        html += `<div class="member-stat-card">`;
        html += `<div class="member-stat-header">
                    <span class="name">${displayName}</span>
                    <span class="totals">
                        <span class="cost">-¥${toFixed(totalExpense)}</span>
                        <span class="income">+¥${toFixed(totalIncome)}</span>
                        <span class="goods">¥${toFixed(totalGoods)}</span>
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
                const dateStr = r.date || '未知';
                const note = r.note || '';
                let amountHtml = '';
                if (expense > 0) amountHtml += `<span class="cost">-¥${toFixed(expense)}</span>`;
                if (income > 0) amountHtml += `<span class="income">+¥${toFixed(income)}</span>`;
                if (goods > 0) amountHtml += `<span class="goods">¥${toFixed(goods)}</span>`;
                if (!amountHtml) amountHtml = `<span>—</span>`;
                html += `<div class="detail-item">
                            <div class="left">
                                <span class="date">${formatDate(dateStr)}</span>
                                ${note ? `<span class="note" title="${note}">${note}</span>` : ''}
                            </div>
                            <div class="right">${amountHtml}</div>
                        </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });
    statsContainer.innerHTML = html;

    const allExpense = dayRecords.reduce((sum, r) => sum + (r.expense || 0), 0);
    const allIncome = dayRecords.reduce((sum, r) => sum + (r.income || 0), 0);
    const allGoods = dayRecords.reduce((sum, r) => sum + (r.goods || 0), 0);
    grandTotal.innerHTML = `
        <div class="item">总支出 <span class="num cost">¥${toFixed(allExpense)}</span></div>
        <div class="item">总收入 <span class="num income">¥${toFixed(allIncome)}</span></div>
        <div class="item">总货款 <span class="num goods">¥${toFixed(allGoods)}</span></div>
    `;
}

// ---------- 全部记录 ----------
function renderRecords() {
    const records = state.records;
    if (!records || records.length === 0) {
        recordList.innerHTML = `<div class="empty-state">还没有记录，快来记一笔吧！</div>`;
        return;
    }
    const showRecords = records.slice(0, 50);
    let html = '';
    showRecords.forEach((r, index) => {
        const dateStr = r.date || '未知日期';
        const note = r.note || '';
        const expense = r.expense || 0;
        const income = r.income || 0;
        const goods = r.goods || 0;
        let rightHtml = '';
        if (expense > 0) rightHtml += `<span class="cost">-¥${toFixed(expense)}</span>`;
        if (income > 0) rightHtml += `<span class="income">+¥${toFixed(income)}</span>`;
        if (goods > 0) rightHtml += `<span class="goods">¥${toFixed(goods)}</span>`;
        if (!rightHtml) rightHtml = `<span class="empty">—</span>`;
        const displayName = getDisplayName(r.person);
        html += `
            <div class="record-item" data-id="${r.id}" style="animation-delay:${index * 20}ms">
                <div class="left">
                    <div class="top">
                        <span class="pname">${displayName}</span>
                        <span class="pdate">${formatDate(dateStr)}</span>
                    </div>
                    ${note ? `<div class="note">${note}</div>` : ''}
                </div>
                <div class="right">
                    ${rightHtml}
                    <button class="del-btn" data-id="${r.id}" title="删除">✕</button>
                </div>
            </div>
        `;
    });
    recordList.innerHTML = html;
    recordList.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            if (id && confirm('确定删除这条记录吗？')) deleteRecord(id);
        });
    });
}

// ---------- 删除 & 清空 ----------
function deleteRecord(id) {
    if (!isFirebaseReady) return;
    db.ref(`familyRecords/${id}`).remove()
        .then(() => showToast('已删除'))
        .catch(() => showToast('删除失败'));
}

clearAllBtn.addEventListener('click', function() {
    if (state.records.length === 0) { showToast('没有记录'); return; }
    if (confirm('确定清空所有记录吗？不可恢复！')) {
        if (!isFirebaseReady) return;
        db.ref('familyRecords').remove()
            .then(() => showToast('已清空'))
            .catch(() => showToast('清空失败'));
    }
});

function renderEmptyState(msg) {
    statsContainer.innerHTML = `<div class="member-stat-card" style="text-align:center;color:#b8a392;padding:20px;">${msg}</div>`;
    grandTotal.innerHTML = '';
    recordList.innerHTML = `<div class="empty-state">${msg}</div>`;
}

// ================================================================
//  9.  启动
// ================================================================
loadData();

expenseInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); incomeAmtInput.focus(); } });
incomeAmtInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goodsInput.focus(); } });
goodsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); noteInput.focus(); } });

statsContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.member-stat-card');
    if (!card) return;
    const nameEl = card.querySelector('.member-stat-header .name');
    if (!nameEl) return;
    const displayName = nameEl.textContent.trim();
    // 反向映射查找内部键
    let personKey = null;
    for (let [key, val] of Object.entries(nameMap)) {
        if (val === displayName) { personKey = key; break; }
    }
    if (personKey && ['爸', '妈'].includes(personKey)) {
        personBtns.forEach(b => b.classList.toggle('active', b.dataset.person === personKey));
        state.currentPerson = personKey;
        showToast(`切换到 ${displayName}`);
    }
});

console.log('收支账本（姓名映射，无图标，无金额前缀）已启动！');