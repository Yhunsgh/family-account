/**
 * ================================================================
 *  家庭账本应用 - 主脚本（已集成 Firebase Auth + 数据隔离）
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

const loginPage = $('#loginPage');
const mainApp = $('#mainApp');
const loginUsername = $('#loginUsername');
const loginPassword = $('#loginPassword');
const loginBtn = $('#loginBtn');
const loginError = $('#loginError');
const logoutBtn = $('#logoutBtn');

const personSelector = $('#personSelector');
const manageMemberBtn = $('#manageMemberBtn');
const memberModal = $('#memberModal');
const memberModalClose = $('#memberModalClose');
const memberList = $('#memberList');
const newMemberInput = $('#newMemberInput');
const addMemberBtn = $('#addMemberBtn');

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
const debtStatsContainer = $('#debtStatsContainer');
const debtDateInput = $('#debtDate');
const clearDebtBtn = $('#clearDebtBtn');

const repaymentAmount = $('#repaymentAmount');
const repaymentType = $('#repaymentType');
const repaymentSearch = $('#repaymentSearch');
const repaymentResults = $('#repaymentResults');
const repaymentSubmitBtn = $('#repaymentSubmitBtn');

const incomeGlobalStats = $('#incomeGlobalStats');
const familyGlobalStats = $('#familyGlobalStats');
const debtGlobalStats = $('#debtGlobalStats');

// ================================================================
//  3.  辅助函数（新增：获取当前用户 UID，构建隔离路径）
// ================================================================
function getCurrentUid() {
    const user = firebase.auth().currentUser;
    return user ? user.uid : null;
}

/** 生成带用户隔离的数据库路径 */
function getDbPath(subPath) {
    const uid = getCurrentUid();
    if (!uid) throw new Error('用户未登录，无法操作数据库');
    return `users/${uid}/${subPath}`;
}

// ================================================================
//  4.  登录逻辑（使用 Firebase Auth，支持自动注册）
// ================================================================
function checkLogin() {
    const user = firebase.auth().currentUser;
    if (user) {
        // 已登录
        loginPage.style.display = 'none';
        mainApp.style.display = 'block';
        loginError.textContent = '';
        initApp();
    } else {
        loginPage.style.display = 'flex';
        mainApp.style.display = 'none';
        loginError.textContent = '';
    }
}

// 监听 Auth 状态变化（自动响应登录/登出）
firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        // 已登录，但可能页面还没初始化，调用 checkLogin 确保界面切换
        checkLogin();
    } else {
        // 未登录
        loginPage.style.display = 'flex';
        mainApp.style.display = 'none';
        // 如果之前有监听数据库，需要清理？实际我们会在 initApp 中重新监听，无所谓。
    }
});

loginBtn.addEventListener('click', function() {
    const email = loginUsername.value.trim();
    const pass = loginPassword.value.trim();

    if (!email || !pass) {
        loginError.textContent = '请填写邮箱和密码';
        return;
    }
    if (pass.length < 6) {
        loginError.textContent = '密码至少6位';
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '处理中...';
    loginError.textContent = '';

    // 1. 尝试登录
    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(() => {
            // 登录成功，由 onAuthStateChanged 处理
            loginBtn.disabled = false;
            loginBtn.textContent = '登录 / 注册';
        })
        .catch((error) => {
            if (error.code === 'auth/user-not-found') {
                // 2. 用户不存在，自动注册
                firebase.auth().createUserWithEmailAndPassword(email, pass)
                    .then(() => {
                        // 注册成功，自动登录
                        loginBtn.disabled = false;
                        loginBtn.textContent = '登录 / 注册';
                    })
                    .catch((regError) => {
                        loginError.textContent = '注册失败：' + regError.message;
                        loginBtn.disabled = false;
                        loginBtn.textContent = '登录 / 注册';
                    });
            } else {
                loginError.textContent = '登录失败：' + error.message;
                loginBtn.disabled = false;
                loginBtn.textContent = '登录 / 注册';
            }
        });
});

loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
loginUsername.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });

logoutBtn.addEventListener('click', function() {
    firebase.auth().signOut()
        .then(() => {
            // 退出后界面由 onAuthStateChanged 处理
            location.reload(); // 简单刷新重置状态
        })
        .catch((err) => {
            showToast('退出失败：' + err.message);
        });
});

// ================================================================
//  5.  工具函数（保持不变）
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

function getMonthKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function getCurrentMonthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// ================================================================
//  6.  人员管理（动态成员）— 路径已改为 getDbPath
// ================================================================
function watchMembers() {
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    try {
        const path = getDbPath('members');
        db.ref(path).on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                // 首次使用，初始化默认成员
                db.ref(path).push('刘力伟');
                db.ref(path).push('郑少容');
                return;
            }
            const members = Object.values(data).filter(v => typeof v === 'string' && v.trim() !== '');
            state.members = members;
            if (!state.currentPerson || !members.includes(state.currentPerson)) {
                state.currentPerson = members.length > 0 ? members[0] : null;
            }
            renderPersonButtons();
            renderAll();
            renderRepaymentResults();
        }, (err) => {
            console.error('读取 members 失败:', err);
            showToast('读取成员列表失败');
        });
    } catch (e) {
        showToast(e.message);
    }
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
            if (!confirm(`确定删除成员“${name}”吗？\n（历史记录不会删除，但将不再显示该成员的数据）`)) return;
            try {
                const path = getDbPath('members');
                db.ref(path).orderByValue().equalTo(name).once('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        const key = Object.keys(data)[0];
                        db.ref(path + '/' + key).remove()
                            .then(() => {
                                showToast(`已删除成员 ${name}`);
                                if (state.currentPerson === name) {
                                    state.currentPerson = state.members.length > 0 ? state.members[0] : null;
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('删除失败');
                            });
                    }
                });
            } catch (e) {
                showToast(e.message);
            }
        });
    });
}

addMemberBtn.addEventListener('click', function() {
    const name = newMemberInput.value.trim();
    if (!name) { showToast('请输入姓名'); return; }
    if (state.members.includes(name)) { showToast('成员已存在'); return; }
    try {
        const path = getDbPath('members');
        db.ref(path).push(name)
            .then(() => {
                showToast(`已添加成员 ${name}`);
                newMemberInput.value = '';
            })
            .catch(err => {
                console.error(err);
                showToast('添加失败');
            });
    } catch (e) {
        showToast(e.message);
    }
});
newMemberInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addMemberBtn.click();
});

// ================================================================
//  7.  通用渲染函数（无路径修改，只读 state）
// ================================================================
function renderGlobalStats(records, container, fields) {
    if (!container) return;
    if (!records || records.length === 0) {
        container.innerHTML = '';
        return;
    }
    const currentMonthKey = getCurrentMonthKey();
    let monthRecords = [];
    records.forEach(r => {
        const dateStr = r.date || new Date(r.createdAt).toISOString().slice(0, 10);
        if (getMonthKey(dateStr) === currentMonthKey) {
            monthRecords.push(r);
        }
    });

    let html = `<div class="global-stats">`;
    html += `<div class="stat-row">`;
    html += `<span class="label">本月</span>`;
    fields.forEach(f => {
        const sum = monthRecords.reduce((s, r) => s + (r[f.key] || 0), 0);
        html += `<span class="${f.class}">${f.label} ¥${toFixed(sum)}</span>`;
    });
    html += `</div>`;
    html += `<div class="stat-row">`;
    html += `<span class="label">总计</span>`;
    fields.forEach(f => {
        const sum = records.reduce((s, r) => s + (r[f.key] || 0), 0);
        html += `<span class="${f.class}">${f.label} ¥${toFixed(sum)}</span>`;
    });
    html += `</div>`;
    html += `</div>`;
    container.innerHTML = html;
}

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

    let memberHtml = '';

    if (profitConfig) {
        const totalIncome = dayRecords.reduce((s, r) => s + (r[profitConfig.incomeKey] || 0), 0);
        const totalGoods = dayRecords.reduce((s, r) => s + (r[profitConfig.goodsKey] || 0), 0);
        const profit = totalIncome - totalGoods;
        memberHtml += `<div class="profit-card">
            <span class="profit-label">所选日期 (${selectedDate ? formatDate(selectedDate) : '全部'}) 盈利</span>
            <span class="profit-amount ${profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'zero'}">¥${toFixed(profit)}</span>
        </div>`;
    }

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
        path,      // 仅用于删除，但删除时我们会重新构造带隔离的路径
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
//  8.  模块配置（dbPath 仅作为逻辑标识，实际读写会用 getDbPath）
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
        globalContainer: incomeGlobalStats,
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
        globalContainer: familyGlobalStats,
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
            container: debtStatsContainer,
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
        globalContainer: debtGlobalStats,
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
//  9.  具体渲染函数（不变）
// ================================================================
function renderIncomeStats() {
    renderStatsGeneric(state.incomeRecords, state.incomeDate, MODULES.income.statsConfig);
    renderGlobalStats(state.incomeRecords, MODULES.income.globalContainer, MODULES.income.statsConfig.fields);
}
function renderFamilyStats() {
    renderStatsGeneric(state.familyRecords, state.familyDate, MODULES.family.statsConfig);
    renderGlobalStats(state.familyRecords, MODULES.family.globalContainer, MODULES.family.statsConfig.fields);
}
function renderDebtStats() {
    renderStatsGeneric(state.debtRecords, state.debtDate, MODULES.debt.statsConfig);
    renderGlobalStats(state.debtRecords, MODULES.debt.globalContainer, MODULES.debt.statsConfig.fields);
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

function renderAll() {
    renderIncomeStats();
    renderIncomeList();
    renderFamilyStats();
    renderFamilyList();
    renderDebtStats();
    renderDebtList();
    renderRepaymentResults();
}

// ================================================================
//  10. 提交逻辑（使用 getDbPath）
// ================================================================
function submitRecord(config) {
    if (!isFirebaseReady) { showToast('数据库未连接'); return; }
    const person = state.currentPerson;
    if (!person) { showToast('请先添加成员'); return; }
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
    try {
        const path = getDbPath(dbPath);
        const newRef = db.ref(path).push();
        newRef.set(record)
            .then(() => {
                showToast('记录成功');
                if (onSuccess) onSuccess();
            })
            .catch((err) => { console.error(err); showToast('提交失败'); })
            .finally(() => { btn.disabled = false; btn.textContent = '记录'; });
    } catch (e) {
        showToast(e.message);
        btn.disabled = false;
        btn.textContent = '记录';
    }
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
//  11. 清除逻辑（使用 getDbPath）
// ================================================================
function clearRecords(dbPath, records, confirmMsg) {
    if (!records || records.length === 0) { showToast('没有记录'); return; }
    if (confirm(confirmMsg)) {
        try {
            const path = getDbPath(dbPath);
            db.ref(path).remove()
                .then(() => showToast('已清空'))
                .catch(() => showToast('清空失败'));
        } catch (e) {
            showToast(e.message);
        }
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
//  12. 日期选择器（不变）
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
//  13. 数据读取 & 实时更新（使用 getDbPath）
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
        try {
            const fullPath = getDbPath(path);
            db.ref(fullPath).on('value', (snapshot) => {
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
        } catch (e) {
            showToast(e.message);
        }
    });
}

// ================================================================
//  14. 删除事件委托（使用 getDbPath）
// ================================================================
document.addEventListener('click', function(e) {
    const delBtn = e.target.closest('.del-btn');
    if (!delBtn) return;
    const id = delBtn.dataset.id;
    const path = delBtn.dataset.path;
    if (id && path && confirm('确定删除这条记录吗？')) {
        if (!isFirebaseReady) { showToast('数据库未连接'); return; }
        try {
            const fullPath = getDbPath(path);
            db.ref(`${fullPath}/${id}`).remove()
                .then(() => showToast('已删除'))
                .catch(() => showToast('删除失败'));
        } catch (e) {
            showToast(e.message);
        }
    }
});

// ================================================================
//  15. 还款功能（使用 getDbPath）
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

    try {
        const fullPath = getDbPath('debtRecords');
        db.ref(`${fullPath}/${state.selectedDebtId}`).update(updateData)
            .then(() => {
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
    } catch (e) {
        showToast(e.message);
        btn.disabled = false;
        btn.textContent = '确认还款';
    }
});

// ================================================================
//  16. 更新公告逻辑（不变）
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
//  17. 启动 & 快捷键
// ================================================================
function initApp() {
    watchMembers();
    loadData();
    document.getElementById('version').textContent = APP_VERSION;
    setTimeout(() => {
        checkUpdateModal();
    }, 500);
}

// 初始检查登录状态（由 onAuthStateChanged 触发，但页面加载时可能还没触发，先调一次）
// 注意：onAuthStateChanged 会异步触发，所以这里调用 checkLogin 可以立即显示界面
// 但 checkLogin 内部会判断 user 是否存在，若不存在则显示登录页。
checkLogin();

// 快捷键（保持不变）
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

console.log(`版本 ${APP_VERSION} 已启动`);