// ================================================================
//  Firebase 配置与初始化（独立模块）
// ================================================================

const firebaseConfig = {
    apiKey: "AIzaSyA42r5qGKt6stH-ggd7sC0m9pCv9OyMIOI",
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
}