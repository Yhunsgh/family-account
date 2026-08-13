/**
 * ================================================================
 *  家庭账本应用 - 主脚本
 *  技术栈：Firebase Realtime Database（无后端）
 *  功能模块：账本（收入+货款）、支出（个人+家庭）、债务（欠款+货款欠款）
 *  核心特性：人员切换、日期筛选、实时数据同步、增删改查
 * ================================================================
 */

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

/** Firebase 数据库实例 */
let db = null;
/** 是否已成功连接 Firebase */
let isFirebaseReady = false;

// 初始化 Firebase，若失败则显示提示
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
/** 系统支持的人员列表（与前端按钮保持一致） */
const PERSON_NAMES = ['刘力伟', '郑少容'];

// ================================================================
//  3.  应用状态
// ================================================================
/**
 * 全局状态对象
 * @property {string} currentPerson       - 当前选中的记账人
 * @property {Array}  incomeRecords       - 账本记录（从 Firebase 同步）
 * @property {Array}  familyRecords       - 支出记录
 * @property {Array}  debtRecords         - 债务记录
 * @property {string} incomeDate          - 账本当前筛选日期
 * @property {string} familyDate          - 支出当前筛选日期
 * @property {string} debtDate            - 债务当前筛选日期
 */
const state = {
    currentPerson: '刘力伟',
    incomeRecords: [],
    familyRecords: [],
    debtRecords: [],
    incomeDate: new Date().toISOString().slice(0, 10),
    familyDate: new Date().toISOString().slice(0, 10),
    debtDate: new Date().toISOString().slice(0, 10),
};

// ================================================================
//  DOM 引用（使用 $ 和 $$ 简化选择器）
// ================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- 人员按钮 ----
const personBtns = $$('.person-btn');

// ---- 账本模块（收入+货款） ----
const incomeAmtInput = $('#incomeAmt');
const goodsInput = $('#goodsAmt');
const noteInput = $('#noteInput');
const submitBtn = $('#submitBtn');
const incomeStatsContainer = $('#incomeStatsContainer');
const incomeGrandTotal = $('#incomeGrandTotal');
const incomeRecordList = $('#incomeRecordList');
const incomeDateInput = $('#incomeDate');
const clearIncomeBtn = $('#clearIncomeBtn');

// ---- 支出模块（个人+家庭） ----
const personalExpenseInput = $('#personalExpense');
const familyExpenseInput = $('#familyExpense');
const familyNoteInput = $('#familyNote');
const familySubmitBtn = $('#familySubmitBtn');
const familyStatsContainer = $('#familyStatsContainer');
const familyGrandTotal = $('#familyGrandTotal');
const familyRecordList = $('#familyRecordList');
const familyDateInput = $('#familyDate');
const clearFamilyBtn = $('#clearFamilyBtn');

// ---- 债务模块（欠款+货款欠款） ----
const debtAmount = $('#debtAmount');
const debtGoodsAmount = $('#debtGoodsAmount');
const debtNote = $('#debtNote');
const debtSubmitBtn = $('#debtSubmitBtn');
const debtRecordList = $('#debtRecordList');
const debtStats = $('#debtStats');
const debtDateInput = $('#debtDate');
const clearDebtBtn = $('#clearDebtBtn');

// ================================================================
//  4.  工具函数
// ================================================================

/** 将日期字符串格式化为 "X月X日"（本地时区） */
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth()+1}月${d.getDate()}日`;
}

/** 将时间戳格式化为 "X月X日 HH:MM" */
function formatTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/** 保留两位小数（返回字符串） */
function toFixed(v) { return Number(v).toFixed(2); }

/** 显示短暂 Toast 提示 */
function showToast(msg, duration = 2000) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

/** 获取今天的日期字符串（YYYY-MM-DD） */
function getTodayStr() { return new Date().toISOString().slice(0, 10); }

// ================================================================
//  5.  人员切换逻辑
// ================================================================
personBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        personBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.currentPerson = this.dataset.person;
    });
});
// 初始化高亮当前人员
personBtns.forEach(btn => {
    if (btn.dataset.person === state.currentPerson) btn.classList.add('active');
});

// ================================================================
//  6.  通用渲染函数（供各模块调用）
// ================================================================

/**
 * 通用统计渲染：按人员汇总数据，显示金额和明细列表
 * @param {Array}  records        - 当前模块的所有记录
 * @param {string|null} selectedDate - 筛选日期，null 表示不过滤
 * @param {Object} config         - 渲染配置
 * @param {HTMLElement} config.container - 统计区域容器
 * @param {HTMLElement|null} config.grandTotalContainer - 总计容器（可选）
 * @param {Array}  config.fields  - 显示在卡片顶部的字段 [{key, label, class}]
 * @param {Array}  config.detailFields - 明细列表显示的字段（结构与 fields 相同）
 * @param {Object|null} config.profitConfig - 盈利计算配置 { incomeKey, goodsKey }
 * @param {boolean} config.showDetails - 是否展开明细列表
 * @param {string|null} config.dateKey - 记录中的日期字段名（null 则不筛选）
 * @param {string} config.personKey - 记录中人员字段名（默认 'person'）
 * @param {string} config.noteKey - 备注字段名（默认 'note'）
 * @param {string} config.createdAtKey - 创建时间字段名（默认 'createdAt'）
 */
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

    // 根据日期筛选记录
    let dayRecords = records;
    if (selectedDate && dateKey) {
        dayRecords = records.filter(r => r[dateKey] === selectedDate);
    }

    let html = '';

    // ---- 盈利卡片（仅用于账本模块） ----
    if (profitConfig) {
        const totalIncome = dayRecords.reduce((s, r) => s + (r[profitConfig.incomeKey] || 0), 0);
        const totalGoods = dayRecords.reduce((s, r) => s + (r[profitConfig.goodsKey] || 0), 0);
        const profit = totalIncome - totalGoods;
        html += `<div class="profit-card">
            <span class="profit-label">所选日期 (${selectedDate ? formatDate(selectedDate) : '全部'}) 盈利</span>
            <span class="profit-amount ${profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'zero'}">¥${toFixed(profit)}</span>
        </div>`;
    }

    // ---- 按人员遍历 ----
    PERSON_NAMES.forEach(name => {
        const pRecords = dayRecords.filter(r => r[personKey_] === name);
        // 统计该人员各字段总和
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

        // ---- 明细列表（如果启用） ----
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

    // ---- 总计（底部） ----
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

/**
 * 通用列表渲染：展示所有记录（支持删除按钮）
 * @param {Array}  records    - 当前模块的所有记录
 * @param {HTMLElement} container - 列表容器
 * @param {Object} config     - 渲染配置
 * @param {Array}  config.fields - 显示金额字段 [{key, label, class}]
 * @param {string} config.path   - 删除时对应的数据库节点名
 * @param {string|null} config.dateKey - 日期字段（null 则使用时间戳）
 * @param {string} config.timeKey - 时间戳字段名（默认 'createdAt'）
 * @param {string} config.personKey - 人员字段名（默认 'person'）
 * @param {string} config.noteKey   - 备注字段名（默认 'note'）
 * @param {number} config.maxItems  - 最大显示条数（默认 50）
 */
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
        // 组装金额部分
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
//  7.  模块配置统一化（便于扩展新模块）
// ================================================================
/**
 * MODULES 对象：集中管理所有模块的配置，包括数据库路径、渲染参数、提交参数等。
 * 新增模块只需在此添加一项，并在 HTML 中增加相应的 DOM 容器即可。
 * @property {Object} income  - 账本模块
 * @property {Object} family  - 支出模块
 * @property {Object} debt    - 债务模块
 */
const MODULES = {
    income: {
        dbPath: 'familyRecords',                               // Firebase 节点
        statsConfig: {                                         // 统计渲染配置
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
        listConfig: {                                          // 列表渲染配置
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
        dateInput: incomeDateInput,                            // 日期选择器 DOM
        dateStateKey: 'incomeDate',                            // 状态中的日期字段名
        clearBtn: clearIncomeBtn,                              // 清空按钮
        recordsStateKey: 'incomeRecords',                      // 状态中的记录数组名
        confirmMsg: '确定清空所有账本记录吗？不可恢复！',
        submitConfig: {                                        // 提交配置
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
//  8.  具体渲染函数（从 MODULES 读取配置）
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
//  9.  提交逻辑（通用函数 + 配置驱动）
// ================================================================

/**
 * 通用提交函数：将记录写入 Firebase，并处理成功/失败回调
 * @param {Object} config - 提交配置（从 MODULES 中获取）
 * @param {string} config.dbPath - Firebase 节点路径
 * @param {Array}  config.fields - 输入字段配置 [{dom, key, parse}]
 * @param {HTMLElement} config.noteDom - 备注输入框
 * @param {HTMLElement} config.buttonDom - 触发按钮（用于禁用状态）
 * @param {string} config.dateStateKey - 状态中的日期字段名
 * @param {Function} config.onSuccess - 成功后的回调（清空输入框等）
 */
function submitRecord(config) {
    if (!isFirebaseReady) { showToast('⚠️ 数据库未连接'); return; }
    const person = state.currentPerson;
    const {
        dbPath,
        fields,
        noteDom,
        dateStateKey,
        onSuccess,
    } = config;

    // 构建记录对象（包含人员、备注、日期、时间戳）
    const record = { 
        person, 
        note: noteDom.value.trim() || '', 
        createdAt: Date.now() 
    };
    // 添加日期字段（如果有配置）
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
        showToast(`⚠️ 至少填写一个金额`);
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
        .catch((err) => { console.error(err); showToast('❌ 提交失败'); })
        .finally(() => { btn.disabled = false; btn.textContent = '记录'; });
}

// 绑定三个提交按钮（配置均来自 MODULES）
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
//  10. 清除逻辑（通用函数 + 配置驱动）
// ================================================================

/**
 * 清空指定节点的所有记录
 * @param {string} dbPath - Firebase 节点路径
 * @param {Array}  records - 当前记录数组（用于检查是否有数据）
 * @param {string} confirmMsg - 确认提示信息
 */
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
//  11. 日期选择器（循环初始化）
// ================================================================
/** 需要绑定日期选择器的模块列表（income、family、debt） */
const dateModules = ['income', 'family', 'debt'];
dateModules.forEach(moduleKey => {
    const mod = MODULES[moduleKey];
    if (mod.dateInput) {
        // 设置默认值为今天
        mod.dateInput.value = getTodayStr();
        // 监听变化，更新状态并重新渲染
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
            }
        });
    }
});

// ================================================================
//  12. 数据读取 & 实时更新（循环绑定 Firebase 监听）
// ================================================================

/**
 * 从 Firebase 加载所有数据，并设置实时监听。
 * 每个模块独立监听，更新对应的 state 和视图。
 */
function loadData() {
    if (!isFirebaseReady) {
        showToast('⚠️ 数据库未连接');
        return;
    }

    // 配置需要监听的模块
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
                return;
            }
            // 将数据转换为数组并添加 id
            const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            state[recordsStateKey] = records;
            renderStats();
            renderList();
        }, (err) => {
            console.error(err);
            showToast(`⚠️ 读取 ${path} 数据失败`);
        });
    });
}

// ================================================================
//  13. 删除事件委托（不绑定到具体按钮，性能更优）
// ================================================================
document.addEventListener('click', function(e) {
    const delBtn = e.target.closest('.del-btn');
    if (!delBtn) return;
    const id = delBtn.dataset.id;
    const path = delBtn.dataset.path;
    if (id && path && confirm('确定删除这条记录吗？')) {
        if (!isFirebaseReady) { showToast('⚠️ 数据库未连接'); return; }
        db.ref(`${path}/${id}`).remove()
            .then(() => showToast('已删除'))
            .catch(() => showToast('删除失败'));
    }
});

// ================================================================
//  14. 更新公告逻辑（使用全局 APP_VERSION 和 UPDATE_LOGS）
// ================================================================
const modalOverlay = document.getElementById('updateModal');
const oldVersionSpan = document.getElementById('oldVersion');
const newVersionSpan = document.getElementById('newVersion');
const updateListEl = document.getElementById('updateList');
const dontShowAgainCheck = document.getElementById('dontShowAgain');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

/**
 * 检查并显示更新公告弹窗
 * 规则：
 *   - 如果用户勾选了"本次更新不再提示"，则记录忽略版本
 *   - 如果当前版本号与上次显示的版本相同，则不重复弹出
 */
function checkUpdateModal() {
    const currentVersion = APP_VERSION;
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

// 确认按钮：记录版本状态并关闭弹窗
modalConfirmBtn.addEventListener('click', function() {
    const currentVersion = APP_VERSION;
    if (dontShowAgainCheck.checked) {
        localStorage.setItem('ignoredVersion', currentVersion);
    }
    localStorage.setItem('lastShownVersion', currentVersion);
    modalOverlay.classList.remove('active');
});

// ================================================================
//  15. 启动 & 键盘快捷跳转
// ================================================================
loadData();

// 在页脚显示版本号
document.getElementById('version').textContent = APP_VERSION;

// 延迟 500ms 检查更新（确保 DOM 完全加载）
setTimeout(() => {
    checkUpdateModal();
}, 500);

// ---- 键盘跳转：按 Enter 跳到下一个输入框 ----
// 账本
incomeAmtInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goodsInput.focus(); } });
goodsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); noteInput.focus(); } });
// 支出
personalExpenseInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); familyExpenseInput.focus(); } });
familyExpenseInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); familyNoteInput.focus(); } });
// 债务
debtAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); debtGoodsAmount.focus(); } });
debtGoodsAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); debtNote.focus(); } });

// ---- 点击统计卡片可快速切换当前人员（仅限账本模块） ----
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

console.log(`✅ 优化后版本 ${APP_VERSION} 已启动！`);