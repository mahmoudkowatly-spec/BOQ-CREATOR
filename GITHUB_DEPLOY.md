# دليل نشر منصة إعداد المقايسات عبر GitHub Pages

تم تجهيز التطبيق بالكامل للعمل على **GitHub Pages** بنظام المسار الفرعي (`https://<username>.github.io/<repo-name>/`) مع بناء ونشر تلقائي عبر **GitHub Actions**.

---

## الخطوة 1: إنشاء مستودع على GitHub ورفع المشروع

1. أنشئ مستودعاً جديداً على حسابك في GitHub (مثلاً باسم `engineering-boq`).
2. من مجلد المشروع على جهازك، نفّذ الأوامر التالية (استبدل `USERNAME` و`REPO_NAME` ببياناتك):

```bash
git init
git add .
git commit -m "Initial commit: Engineering BOQ Platform"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

---

## الخطوة 2: تفعيل GitHub Pages عبر GitHub Actions

1. افتح المستودع على GitHub وانتقل إلى **Settings** > **Pages**.
2. في قسم **Build and deployment**، اختر تحت **Source** الخيار: **GitHub Actions**.
3. انتقل إلى تبويب **Actions**؛ ستجد سير العمل **Deploy to GitHub Pages** يعمل تلقائياً عند كل `push` على فرع `main` أو `master` (ويمكنك أيضاً تشغيله يدوياً عبر زر **Run workflow**).
4. بعد انتهاء التشغيل بنجاح، سيظهر رابط الموقع المباشر بصيغة:
   `https://USERNAME.github.io/REPO_NAME/`

---

## الخطوة 3: تفعيل تسجيل الدخول بحساب Google على نطاق GitHub Pages

لضمان عمل زر **المتابعة بحساب Google**، وقاعدة البيانات السحابية **Firestore**، وربط **Google Drive** على الرابط الجديد:

1. افتح **Firebase Console** واختر مشروعك (`gen-lang-client-0551192739`).
2. انتقل إلى **Authentication** > **Settings** > **Authorized domains**.
3. اضغط **Add domain** وأضف النطاق:
   `USERNAME.github.io`
4. *(اختياري لميزة Google Drive)*: في **Google Cloud Console** > **APIs & Services** > **Credentials** > عميل OAuth المستخدم، أضف ضمن **Authorized JavaScript origins**:
   `https://USERNAME.github.io`

---

## اختبار البناء محلياً لمحاكاة GitHub Pages

يمكنك تجربة البناء بمسار فرعي قبل الرفع عبر الأمر:

```bash
VITE_BASE_PATH="/REPO_NAME/" npm run build
npm run preview
```
