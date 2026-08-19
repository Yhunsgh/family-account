/**
 * ================================================================
 *  家庭账本 - 统一流水账模型 (v1.10)
 *  数据存入 records 表，按 type 区分：income / expense / debt
 *  income: { income, goods }  expense: { personalExpense }  
 *  debt: { amount, goodsAmount }
 *  还款直接扣减原债务记录的 amount 或 goodsAmount 字段
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
    records: [],
    dates: { income: null, expense: null, debt: null },
    selectedDebtId: null,
    displayLimit: { income: 20, expense: 20, debt: 20 },
    _submitting: false,
};

// ================================================================
//  3.  DOM 引用
// ================================================================
const $ = (sel) => document.querySelector(sel);

const manageMemberBtn = $('#manageMemberBtn');
const memberModal = $('#memberModal');
const memberModalClose = $('#memberModalClose');
const memberList = $('#memberList');
const newMemberInput = $('#newMemberInput');
const addMemberBtn = $('#addMemberBtn');

const dom = {
    income: {
        amt: $('#incomeAmt'),
        goods: $('#goodsAmt'),
        note: $('#incomeNote'),
        submit: $('#incomeSubmitBtn'),
        date: $('#incomeDate'),
        statsContainer: $('#incomeStatsContainer'),
        recordList: $('#incomeRecordList'),
        clearBtn: $('#clearIncomeBtn'),
        globalStats: $('#incomeGlobalStats'),
    },
    expense: {
        amt: $('#expenseAmt'),
        note: $('#expenseNote'),
        submit: $('#expenseSubmitBtn'),
        date: $('#expenseDate'),
        statsContainer: $('#expenseStatsContainer'),
        recordList: $('#expenseRecordList'),
        clearBtn: $('#clearExpenseBtn'),
        globalStats: $('#expenseGlobalStats'),
    },
    debt: {
        amt: $('#debtAmt'),
        type: $('#debtType'),
        note: $('#debtNote'),
        submit: $('#debtSubmitBtn'),
        date: $('#debtDate'),
        statsContainer: $('#debtStatsContainer'),
        recordList: $('#debtRecordList'),
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
//  4.  工具函数
// ================================================================
const TYPE_LABELS = { income: '账本', expense: '支出', debt: '债务' };
const DEBT_TYPE_LABELS = { amount: '欠款', goodsAmount: '货款欠款' };

function getRecordDate(r) {
    if (r.date) return r.date;
    const d = new Date(r.createdAt || 0);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function sortByDate(records) {
    return [...records].sort((a,b) => {
        const da = getRecordDate(a), db = getRecordDate(b);
        if (da !== db) return db.localeCompare(da);
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
function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getMonthKey(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function getCurrentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function showToast(msg, duration = 2000) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
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
            state.currentPerson = members.includes('郑少容') ? '郑少容' : (members[0] || null);
        }
        renderPersonButtons();
        renderAll();
    }, (err) => { console.error(err); showToast('读取成员列表失败'); });
}

function renderPersonButtons() {
    const members = state.members;
    const container = document.getElementById('personChips');
    if (!container) return;

    if (!members || members.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:#b8a392;">请添加成员</span>';
        return;
    }
    let html = '';
    members.forEach(name => {
        const active = (name === state.currentPerson) ? 'active' : '';
        html += `<button class="person-chip ${active}" data-person="${name}">${name}</button>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.person-chip').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.person-chip').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.currentPerson = this.dataset.person;
            renderAll();
        });
    });
}

manageMemberBtn.addEventListener('click', () => { renderMemberList(); memberModal.classList.add('active'); });
memberModalClose.addEventListener('click', () => memberModal.classList.remove('active'));
memberModal.addEventListener('click', (e) => { if (e.target === this) this.classList.remove('active'); });

function renderMemberList() {
    const members = state.members;
    if (!members || members.length === 0) {
        memberList.innerHTML = '<div class="empty-state">暂无成员</div>';
        return;
    }
    let html = '';
    members.forEach(name => {
        html += `<div class="member-item"><span class="name">${name}</span><button class="del-member-btn" data-name="${name}">✕</button></div>`;
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
                    db.ref('members/' + key).remove().then(() => {
                        showToast(`已删除成员 ${name}`);
                        if (state.currentPerson === name) {
                            state.currentPerson = state.members.length > 0 ? state.members[0] : null;
                        }
                    }).catch(err => { console.error(err); showToast('删除成员失败'); });
                }
            });
            db.ref('records').orderByChild('person').equalTo(name).once('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    Object.keys(data).forEach(key => {
                        db.ref(`records/${key}`).remove().catch(err => console.error(err));
                    });
                }
            });
        });
    });
}

addMemberBtn.addEventListener('click', function() {
    const name = newMemberInput.value.trim();
    if (!name) { showToast('请输入姓名'); return; }
    if (state.members.includes(name)) { showToast('成员已存在'); return; }
    db.ref('members').push(name).then(() => {
        showToast(`已添加成员 ${name}`);
        newMemberInput.value = '';
    }).catch(err => { console.error(err); showToast('添加失败'); });
});
newMemberInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addMemberBtn.click(); });

// ================================================================
//  6.  核心：统一监听 records
// ================================================================
function updateLocalRecords(newRecord, eventType) {
    const idx = state.records.findIndex(r => r.id === newRecord.id);
    if (eventType === 'removed') {
        if (idx !== -1) state.records.splice(idx, 1);
        return;
    }
    if (idx !== -1) {
        state.records[idx] = newRecord;
    } else {
        state.records.push(newRecord);
    }
    state.records = sortByDate(state.records);
}

function listenRecords() {
    if (!isFirebaseReady) return;
    const ref = db.ref('records');

    ref.once('value', (snapshot) => {
        const data = snapshot.val();
        let records = [];
        if (data) {
            records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            records = sortByDate(records);
        }
        state.records = records;
        Object.keys(state.displayLimit).forEach(k => state.displayLimit[k] = 20);
        scheduleRender();
    }).catch(err => { console.error('初始加载 records 失败:', err); showToast('读取数据失败'); });

    ref.on('child_added', (snapshot) => {
        const record = { id: snapshot.key, ...snapshot.val() };
        updateLocalRecords(record, 'added');
        Object.keys(state.displayLimit).forEach(k => state.displayLimit[k] = 20);
        scheduleRender();
    }, (err) => console.error('child_added 失败:', err));

    ref.on('child_changed', (snapshot) => {
        const record = { id: snapshot.key, ...snapshot.val() };
        updateLocalRecords(record, 'changed');
        scheduleRender();
    }, (err) => console.error('child_changed 失败:', err));

    ref.on('child_removed', (snapshot) => {
        const id = snapshot.key;
        const idx = state.records.findIndex(r => r.id === id);
        if (idx !== -1) {
            state.records.splice(idx, 1);
            scheduleRender();
        }
    }, (err) => console.error('child_removed 失败:', err));
}

// ================================================================
//  7.  渲染函数
// ================================================================
function getFilteredRecords(type) {
    return state.records.filter(r => r.type === type);
}

function renderGlobalStats(type) {
    const container = dom[type].globalStats;
    const records = getFilteredRecords(type);
    if (!records.length) { container.innerHTML = ''; return; }

    const currentMonth = getCurrentMonthKey();
    let monthRecords = records.filter(r => getMonthKey(getRecordDate(r)) === currentMonth);
    let monthTotal = 0, totalAll = 0;
    let label = '';

    if (type === 'income') {
        monthTotal = monthRecords.reduce((s, r) => s + (r.income || 0) - (r.goods || 0), 0);
        totalAll = records.reduce((s, r) => s + (r.income || 0) - (r.goods || 0), 0);
        label = '盈利';
    } else if (type === 'expense') {
        monthTotal = monthRecords.reduce((s, r) => s + (r.personalExpense || 0), 0);
        totalAll = records.reduce((s, r) => s + (r.personalExpense || 0), 0);
        label = '总支出';
    } else if (type === 'debt') {
        monthTotal = monthRecords.reduce((s, r) => s + (r.amount || 0) + (r.goodsAmount || 0), 0);
        totalAll = records.reduce((s, r) => s + (r.amount || 0) + (r.goodsAmount || 0), 0);
        label = '总欠款';
    }

    const cls = (type === 'income') ? 'income' : (type === 'expense' ? 'cost' : 'goods');
    container.innerHTML = `
        <div class="global-stats">
            <div class="stat-row"><span class="label">本月</span><span class="${cls}">${label} ¥${toFixed(monthTotal)}</span></div>
            <div class="stat-row"><span class="label">总计</span><span class="${cls}">${label} ¥${toFixed(totalAll)}</span></div>
        </div>
    `;
}

function renderStats(type) {
    const container = dom[type].statsContainer;
    const selectedDate = state.dates[type];

    let dayRecords = getFilteredRecords(type);
    if (selectedDate) {
        dayRecords = dayRecords.filter(r => getRecordDate(r) === selectedDate);
    }

    // 计算各项总和
    let totalIncome = 0, totalGoods = 0, totalPersonalExpense = 0;
    let totalAmount = 0, totalGoodsAmount = 0;

    if (type === 'income') {
        totalIncome = dayRecords.reduce((s, r) => s + (r.income || 0), 0);
        totalGoods = dayRecords.reduce((s, r) => s + (r.goods || 0), 0);
    } else if (type === 'expense') {
        totalPersonalExpense = dayRecords.reduce((s, r) => s + (r.personalExpense || 0), 0);
    } else if (type === 'debt') {
        totalAmount = dayRecords.reduce((s, r) => s + (r.amount || 0), 0);
        totalGoodsAmount = dayRecords.reduce((s, r) => s + (r.goodsAmount || 0), 0);
    }

    // 构建卡片头部
    let headerHtml = '';
    if (type === 'income') {
        headerHtml = `
            <div class="member-stat-header">
                <span class="name" style="font-size:15px; font-weight:600;">
                    收入 ¥${toFixed(totalIncome)}　货款 ¥${toFixed(totalGoods)}
                </span>
            </div>
        `;
    } else if (type === 'expense') {
        headerHtml = `
            <div class="member-stat-header">
                <span class="name" style="font-size:15px; font-weight:600;">
                    支出 ¥${toFixed(totalPersonalExpense)}
                </span>
            </div>
        `;
    } else if (type === 'debt') {
        headerHtml = `
            <div class="member-stat-header">
                <span class="name" style="font-size:15px; font-weight:600;">
                    欠款 ¥${toFixed(totalAmount)}　货款欠款 ¥${toFixed(totalGoodsAmount)}
                </span>
            </div>
        `;
    }

    // 构建明细列表
    let detailHtml = '';
    if (dayRecords.length === 0) {
        detailHtml = `<div class="detail-empty">当天无记录</div>`;
    } else {
        dayRecords.forEach(r => {
            let amtDisplay = '';
            if (type === 'income') {
                const inc = r.income || 0;
                const gds = r.goods || 0;
                amtDisplay = `收入 ¥${toFixed(inc)} 货款 ¥${toFixed(gds)}`;
            } else if (type === 'expense') {
                amtDisplay = `¥${toFixed(r.personalExpense || 0)}`;
            } else if (type === 'debt') {
                const amt = r.amount || 0;
                const gds = r.goodsAmount || 0;
                const parts = [];
                if (amt > 0) parts.push(`欠款 ¥${toFixed(amt)}`);
                if (gds > 0) parts.push(`货款欠款 ¥${toFixed(gds)}`);
                amtDisplay = parts.join(' ') || '¥0.00';
            }
            const dateDisplay = formatDate(getRecordDate(r));
            detailHtml += `
                <div class="detail-item">
                    <div class="left">
                        <span class="date">${dateDisplay}</span>
                        ${r.note ? `<span class="note" title="${r.note}">${r.note}</span>` : ''}
                    </div>
                    <div class="right"><span class="${type === 'income' ? 'income' : 'cost'}">${amtDisplay}</span></div>
                </div>
            `;
        });
    }

    container.innerHTML = `
        <div class="member-stat-card">
            ${headerHtml}
            <div class="member-detail-list">${detailHtml}</div>
        </div>
    `;
    renderGlobalStats(type);
}

function renderList(type) {
    const container = dom[type].recordList;
    const records = getFilteredRecords(type);
    if (!records.length) {
        container.innerHTML = `<div class="empty-state">还没有记录</div>`;
        return;
    }

    const limit = state.displayLimit[type] || 20;
    const show = records.slice(0, Math.min(limit, records.length));

    let html = '';
    show.forEach((r, idx) => {
        const dateDisplay = formatDate(getRecordDate(r));
        let amtDisplay = '';
        if (type === 'income') {
            amtDisplay = `收入 ¥${toFixed(r.income||0)} 货款 ¥${toFixed(r.goods||0)}`;
        } else if (type === 'expense') {
            amtDisplay = `¥${toFixed(r.personalExpense||0)}`;
        } else if (type === 'debt') {
            const amt = r.amount || 0;
            const gds = r.goodsAmount || 0;
            const parts = [];
            if (amt > 0) parts.push(`欠款 ¥${toFixed(amt)}`);
            if (gds > 0) parts.push(`货款欠款 ¥${toFixed(gds)}`);
            amtDisplay = parts.join(' ') || '¥0.00';
        }
        html += `
            <div class="record-item" style="animation-delay:${idx*20}ms">
                <div class="left">
                    <div class="top">
                        <span class="pname">${r.person}</span>
                        <span class="pdate">${dateDisplay}</span>
                    </div>
                    ${r.note ? `<div class="note">${r.note}</div>` : ''}
                </div>
                <div class="right">
                    <span class="${type === 'income' ? 'income' : 'cost'}">${amtDisplay}</span>
                    <button class="del-btn" data-id="${r.id}" title="删除">✕</button>
                </div>
            </div>
        `;
    });

    if (show.length < records.length) {
        html += `<div class="load-more-container">
            <button class="load-more-btn" data-type="${type}" data-total="${records.length}">加载更多（${show.length}/${records.length}）</button>
        </div>`;
    }

    container.innerHTML = html;
    container.querySelectorAll('.load-more-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const t = this.dataset.type;
            const total = parseInt(this.dataset.total);
            const cur = state.displayLimit[t] || 20;
            state.displayLimit[t] = Math.min(cur + 20, total);
            renderAll();
        });
    });
}

// ================================================================
//  财务总览渲染
// ================================================================
function renderOverview() {
    const records = state.records;
    if (!records.length) {
        ['MonthIncome', 'MonthExpense', 'MonthDebt', 'TotalIncome', 'TotalExpense', 'TotalDebt'].forEach(id => {
            document.getElementById('overview' + id).textContent = '¥0.00';
        });
        return;
    }

    const currentMonth = getCurrentMonthKey();

    let monthIncome = 0, monthExpense = 0, monthDebt = 0;
    let totalIncome = 0, totalExpense = 0, totalDebt = 0;

    records.forEach(r => {
        const monthKey = getMonthKey(getRecordDate(r));
        const isMonth = (monthKey === currentMonth);

        if (r.type === 'income') {
            const profit = (r.income || 0) - (r.goods || 0);
            totalIncome += profit;
            if (isMonth) monthIncome += profit;
        } else if (r.type === 'expense') {
            const val = r.personalExpense || 0;
            totalExpense += val;
            if (isMonth) monthExpense += val;
        } else if (r.type === 'debt') {
            const val = (r.amount || 0) + (r.goodsAmount || 0);
            if (val > 0) {
                totalDebt += val;
                if (isMonth) monthDebt += val;
            }
        }
    });

    document.getElementById('overviewMonthIncome').textContent = '¥' + toFixed(monthIncome);
    document.getElementById('overviewMonthExpense').textContent = '¥' + toFixed(monthExpense);
    document.getElementById('overviewMonthDebt').textContent = '¥' + toFixed(monthDebt);
    document.getElementById('overviewTotalIncome').textContent = '¥' + toFixed(totalIncome);
    document.getElementById('overviewTotalExpense').textContent = '¥' + toFixed(totalExpense);
    document.getElementById('overviewTotalDebt').textContent = '¥' + toFixed(totalDebt);
}

// ================================================================
//  统一渲染入口
// ================================================================
function renderAll() {
    ['income', 'expense', 'debt'].forEach(type => {
        renderStats(type);
        renderList(type);
    });
    renderRepaymentResults();
    renderOverview();
}

let _renderScheduled = false;
function scheduleRender() {
    if (_renderScheduled) return;
    _renderScheduled = true;
    requestAnimationFrame(() => {
        _renderScheduled = false;
        renderAll();
    });
}

// ================================================================
//  8.  提交记录
// ================================================================
function submitRecord(type) {
    if (state._submitting) return;
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    const person = state.currentPerson;
    if (!person) { showToast('请先添加成员'); return; }

    const d = dom[type];
    const record = {
        person,
        date: state.dates[type] || getTodayStr(),
        type: type,
        note: d.note.value.trim() || '',
        createdAt: Date.now()
    };

    let hasValue = false;
    if (type === 'income') {
        const inc = parseFloat(d.amt.value) || 0;
        const gds = parseFloat(d.goods.value) || 0;
        record.income = inc;
        record.goods = gds;
        if (inc > 0 || gds > 0) hasValue = true;
    } else if (type === 'expense') {
        const exp = parseFloat(d.amt.value) || 0;
        record.personalExpense = exp;
        if (exp > 0) hasValue = true;
    } else if (type === 'debt') {
        const amt = parseFloat(d.amt.value) || 0;
        record.amount = amt;
        record.goodsAmount = 0;
        // 根据下拉选择，决定存到 amount 还是 goodsAmount
        if (d.type.value === 'goodsAmount') {
            record.goodsAmount = amt;
            record.amount = 0;
        }
        if (amt > 0) hasValue = true;
    }

    if (!hasValue) {
        showToast('请填写有效金额');
        return;
    }

    state._submitting = true;
    const btn = d.submit;
    btn.disabled = true;
    btn.textContent = '提交中...';

    db.ref('records').push(record)
        .then(() => {
            showToast('记录成功');
            d.amt.value = '';
            if (d.goods) d.goods.value = '';
            d.note.value = '';
            d.amt.focus();
        })
        .catch(err => { console.error(err); showToast('提交失败'); })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '记录';
            state._submitting = false;
        });
}

// ================================================================
//  9.  删除 & 清空
// ================================================================
document.addEventListener('click', function(e) {
    const delBtn = e.target.closest('.del-btn');
    if (!delBtn) return;
    const id = delBtn.dataset.id;
    if (id && confirm('确定删除这条记录吗？')) {
        if (!isFirebaseReady) { showToast('数据库未连接'); return; }
        db.ref(`records/${id}`).remove()
            .then(() => showToast('已删除'))
            .catch(() => showToast('删除失败'));
    }
});

function clearRecords(type) {
    const selectedDate = state.dates[type];
    if (!selectedDate) { showToast('请先选择日期'); return; }
    const toDelete = state.records.filter(r => r.type === type && getRecordDate(r) === selectedDate);
    if (!toDelete.length) {
        showToast(`${TYPE_LABELS[type]}在 ${formatDate(selectedDate)} 没有记录`);
        return;
    }
    if (!confirm(`确定清空 ${formatDate(selectedDate)} 的所有${TYPE_LABELS[type]}记录吗？`)) return;
    const promises = toDelete.map(r => db.ref(`records/${r.id}`).remove());
    Promise.all(promises)
        .then(() => showToast(`已清空 ${formatDate(selectedDate)} 的${TYPE_LABELS[type]}记录`))
        .catch(() => showToast('清空失败，请重试'));
}

// ================================================================
//  10. 还款功能
// ================================================================
function getDebtBalance(debtId, typeKey) {
    const debt = state.records.find(r => r.id === debtId && r.type === 'debt');
    if (!debt) return 0;
    return debt[typeKey] || 0;
}

function renderRepaymentResults() {
    const keyword = repaymentSearch.value.trim();
    let debts = state.records.filter(r => 
        r.type === 'debt' && ((r.amount || 0) > 0 || (r.goodsAmount || 0) > 0)
    );

    if (keyword !== '') {
        const lower = keyword.toLowerCase();
        debts = debts.filter(r => r.note && r.note.toLowerCase().includes(lower));
    } else {
        debts = debts.filter(r => !r.note || r.note.trim() === '');
    }

    if (!debts.length) {
        repaymentResults.innerHTML = `<div class="empty-state">${keyword === '' ? '没有未结清且无备注的债务' : '未找到匹配的债务'}</div>`;
        state.selectedDebtId = null;
        return;
    }

    const sorted = sortByDate(debts);
    let html = '';
    sorted.forEach(r => {
        const amtBal = r.amount || 0;
        const gdsBal = r.goodsAmount || 0;
        const isSelected = state.selectedDebtId === r.id;
        html += `
            <div class="repayment-result-item ${isSelected ? 'selected' : ''}" data-id="${r.id}">
                <div class="left">
                    <span class="date">${formatDate(getRecordDate(r))}</span>
                    <span class="note" title="${r.note||''}">${r.note||'（无备注）'}</span>
                    <span style="font-size:12px;color:#a5856a;">${r.person}</span>
                </div>
                <div class="right">
                    ${amtBal > 0 ? `<span class="amount">欠款 ¥${toFixed(amtBal)}</span>` : ''}
                    ${gdsBal > 0 ? `<span class="goods">货款欠 ¥${toFixed(gdsBal)}</span>` : ''}
                </div>
            </div>
        `;
    });
    repaymentResults.innerHTML = html;

    if (state.selectedDebtId && !sorted.some(r => r.id === state.selectedDebtId)) {
        state.selectedDebtId = null;
    }
    if (!state.selectedDebtId && sorted.length) {
        state.selectedDebtId = sorted[0].id;
    }
    document.querySelectorAll('.repayment-result-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === state.selectedDebtId);
    });
}

repaymentResults.addEventListener('click', function(e) {
    const item = e.target.closest('.repayment-result-item');
    if (!item) return;
    state.selectedDebtId = (state.selectedDebtId === item.dataset.id) ? null : item.dataset.id;
    renderRepaymentResults();
});

repaymentSearch.addEventListener('input', renderRepaymentResults);

repaymentSubmitBtn.addEventListener('click', function() {
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    if (!state.selectedDebtId) {
        showToast('请先从搜索结果中选择一条债务记录');
        return;
    }
    const amount = parseFloat(repaymentAmount.value);
    if (!amount || amount <= 0) {
        showToast('请输入有效的还款金额（大于0）');
        return;
    }
    const typeKey = repaymentType.value;
    const typeLabel = typeKey === 'amount' ? '欠款' : '货款欠款';

    const debt = state.records.find(r => r.id === state.selectedDebtId);
    if (!debt) {
        showToast('选中的债务记录不存在，请刷新');
        state.selectedDebtId = null;
        renderRepaymentResults();
        return;
    }

    const currentBalance = debt[typeKey] || 0;
    if (amount > currentBalance) {
        showToast(`还款金额不能超过${typeLabel}余额（¥${toFixed(currentBalance)}）`);
        return;
    }

    const updateData = {};
    updateData[typeKey] = currentBalance - amount;

    const btn = repaymentSubmitBtn;
    btn.disabled = true;
    btn.textContent = '还款中...';

    db.ref(`records/${state.selectedDebtId}`).update(updateData)
        .then(() => {
            showToast(`还款成功，${typeLabel}减少 ¥${toFixed(amount)}`);
            repaymentAmount.value = '';
            state.selectedDebtId = null;
            renderRepaymentResults();
        })
        .catch(err => { console.error(err); showToast('还款失败'); })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '确认还款';
        });
});

// ================================================================
//  11. 日期 & 事件绑定
// ================================================================
['income', 'expense', 'debt'].forEach(type => {
    const d = dom[type];
    const today = getTodayStr();
    d.date.value = today;
    state.dates[type] = today;
    d.date.addEventListener('change', function() {
        state.dates[type] = this.value;
        state.displayLimit[type] = 20;
        renderStats(type);
        renderList(type);
        if (type === 'debt') renderRepaymentResults();
    });

    d.submit.addEventListener('click', () => submitRecord(type));
    d.clearBtn.addEventListener('click', () => clearRecords(type));
});

// ================================================================
//  12. 刷新 & 快捷键
// ================================================================
refreshBtn.addEventListener('click', function() {
    Object.keys(state.displayLimit).forEach(k => state.displayLimit[k] = 20);
    renderAll();
    showToast('数据已刷新');
});

['income', 'expense', 'debt'].forEach(type => {
    const d = dom[type];
    d.amt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (d.goods) d.goods.focus();
            else d.note.focus();
        }
    });
    if (d.goods) {
        d.goods.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); d.note.focus(); }
        });
    }
    d.note.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); d.submit.click(); }
    });
});
repaymentAmount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); repaymentSubmitBtn.click(); }
});

// ================================================================
//  13. 更新公告 & 启动
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
    const updateItems = UPDATE_LOGS[currentVersion] || ['本次更新内容未填写'];
    oldVersionSpan.textContent = lastShownVersion;
    newVersionSpan.textContent = currentVersion;
    updateListEl.innerHTML = updateItems.map(item => `<li>${item}</li>`).join('');
    modalOverlay.classList.add('active');
}
modalConfirmBtn.addEventListener('click', function() {
    localStorage.setItem('lastShownVersion', APP_VERSION);
    modalOverlay.classList.remove('active');
});

function initApp() {
    watchMembers();
    listenRecords();
    document.getElementById('version').textContent = APP_VERSION;
    setTimeout(checkUpdateModal, 500);
}
initApp();
console.log(`统一模型 v${APP_VERSION} 已启动`);