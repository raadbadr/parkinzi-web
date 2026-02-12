# 🚀 نشر موقع Parkinzi على Cloudflare Pages

دليل شامل لنشر الموقع على Cloudflare Pages (مجاني، سريع، CDN عالمي).

---

## الطريقة 1: Direct Upload (الأسرع - بدون Git)

### الخطوة 1: تجهيز الملفات

```bash
cd /Users/Raad/Documents/Xcode/Web
```

تأكد أن جميع الملفات التالية موجودة:
- `index.html`
- `Monoton-Regular.ttf`
- `parkinzi-logo.png` (أو `logo.png`)
- `parkinzi-logo-dark.png`
- `parkinzi-logo-light.png`

### الخطوة 2: إنشاء ملف ZIP

```bash
cd /Users/Raad/Documents/Xcode/Web
zip -r parkinzi-deploy.zip index.html . -x "*.md" -x "*.DS_Store"
```

أو يدوياً: ضع الملفات في مجلد واحد ثم اضغطها كـ ZIP.

### الخطوة 3: النشر عبر Dashboard

1. ادخل إلى [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. من القائمة الجانبية: **Workers & Pages** → **Create** → **Pages**
3. اختر **Upload assets**
4. اكتب اسم المشروع: `parkinzi`
5.اسحب ملف ZIP أو اختره
6. اضغط **Deploy site**

سيتم النشر خلال دقائق على الرابط: `https://parkinzi.pages.dev`

---

## الطريقة 2: Wrangler CLI (للنشر من السطر)

### الخطوة 1: تثبيت Wrangler

```bash
npm install -g wrangler
```

أو استخدم بدون تثبيت:
```bash
npx wrangler pages deploy . --project-name=parkinzi
```

### الخطوة 2: تسجيل الدخول

```bash
wrangler login
```

سيُفتح المتصفح لتسجيل الدخول في Cloudflare.

### الخطوة 3: النشر

```bash
cd /Users/Raad/Documents/Xcode/Web
wrangler pages deploy . --project-name=parkinzi
```

ملاحظة: استخدم `--project-name=parkinzi` إذا كان المشروع جديداً.

---

## الطريقة 3: Git Integration (للتحديثات التلقائية)

### الخطوة 1: رفع المشروع على GitHub

1. أنشئ repo جديد على GitHub (مثلاً `parkinzi-web`)
2. ارفع محتويات مجلد Web:

```bash
cd /Users/Raad/Documents/Xcode/Web
git init
git add index.html Monoton-Regular.ttf *.png
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/parkinzi-web.git
git push -u origin main
```

### الخطوة 2: ربط Cloudflare بـ GitHub

1. **Workers & Pages** → **Create** → **Pages**
2. اختر **Connect to Git**
3. اختر **GitHub** واتبع الإعداد
4. اختر repo: `parkinzi-web`
5. إعدادات البناء:
   - **Framework preset:** None
   - **Build command:** `exit 0` (أو اتركه فارغاً)
   - **Build output directory:** `/` (الجذر)
6. **Save and Deploy**

بعد كل `git push` سيتم النشر تلقائياً.

---

## إعداد Custom Domain (اختياري)

1. في Cloudflare Pages: مشروعك → **Custom domains**
2. **Set up a custom domain**
3. أدخل اسم النطاق (مثلاً `parkinzi.com` أو `www.parkinzi.com`)
4. اتبع الخطوات لتعديل DNS عند مسجل النطاق

---

## ملخص الملفات المطلوبة للنشر

| الملف | مطلوب |
|-------|--------|
| index.html | ✓ |
| Monoton-Regular.ttf | ✓ |
| parkinzi-logo.png | ✓ |
| parkinzi-logo-dark.png | ✓ |
| parkinzi-logo-light.png | ✓ |

---

## استكشاف الأخطاء

### لا تظهر الصور أو الخطوط
- تأكد أن المسارات في الـ HTML صحيحة (مثل `./parkinzi-logo.png` وليس `./images/...`)
- تأكد أن جميع الملفات موجودة في نفس المجلد أو المسارات الصحيحة

### خطأ 404
- تأكد أن `index.html` في جذر المجلد (root)
- لا تضع الملفات داخل مجلد فرعي

### الموقع بطيء
- Cloudflare Pages يستخدم CDN تلقائياً
- تحقق من حجم الصور وجرب ضغطها

---

**تم التحديث:** 2026-02-10
