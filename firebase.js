// ================================================================
//  Firebase 配置与初始化（独立模块）
//  作用：集中管理 Firebase 项目的配置和数据库实例的初始化。
//  其他脚本通过全局变量 isFirebaseReady 和 db 来判断是否可用。
// ================================================================

// Firebase 配置对象，包含项目密钥、域名、数据库 URL 等。
// 这些信息来自 Firebase 控制台，公开但受安全规则保护。
const firebaseConfig = {
    apiKey: "AIzaSyA42r5qGKt6stH-ggd7sC0m9pCv9OyMIOI",
    authDomain: "family-account-book-22cc3.firebaseapp.com",
    databaseURL: "https://family-account-book-22cc3-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "family-account-book-22cc3",
    storageBucket: "family-account-book-22cc3.firebasestorage.app",
    messagingSenderId: "883258053961",
    appId: "1:883258053961:web:44d29f6635598b6a22f698"
};

// 数据库实例引用，初始为 null，初始化成功后赋值。
let db = null;
// 标志位，表示 Firebase 是否已成功初始化。
let isFirebaseReady = false;

// 尝试初始化 Firebase 应用并获取数据库实例。
// 如果失败，捕获错误并记录，不影响页面其他功能（仅显示控制台错误）。
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    isFirebaseReady = true;
    console.log("Firebase 初始化成功");
} catch (err) {
    console.error("Firebase 初始化失败:", err);
}