# 🚀 نشر موقع Parkinzi على Cloudflare Pages

دليل شامل لنشر الموقع على Cloudflare Pages (مجاني، سريع، CDN عالمي).

---

## الطريقة 1: Direct Upload (الأسرع - بدون Git)

### الخطوة 1: تجهيز الملفات

```bash
cd /Users/Raad/Documents/Xcode/Web
```

تأكد أن جميع الملفات التالية موجودة:
- `index.html`, `privacy.html`, `refund.html`
- `header.css`, `footer.css`
- `Monoton-Regular.ttf`
- `parkinzi-logo-dark.png`, `parkinzi-logo-light.png`

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

## الطريقة 3: Git Integration (للتحديثات التلقائية) ✅ مُعد مسبقاً

### الخطوة 1: إنشاء Repo على GitHub

1. ادخل [github.com/new](https://github.com/new)
2. اسم المستودع: `parkinzi-web` (أو أي اسم)
3. **Public** → **Create repository**
4. لا تضف README أو .gitignore (موجود مسبقاً)

### الخطوة 2: ربط والدفع

```bash
cd /Users/Raad/Documents/Xcode/Web
git remote add origin https://github.com/YOUR_USERNAME/parkinzi-web.git
git branch -M main
git push -u origin main
```

استبدل `YOUR_USERNAME` باسم حسابك على GitHub.

### الخطوة 3: ربط Cloudflare بـ GitHub

1. **Workers & Pages** → **Create** → **Pages**
2. اختر **Connect to Git**
3. اختر **GitHub** واتبع إعداد الصلاحيات
4. اختر repo: `parkinzi-web`
5. إعدادات البناء:
   - **Framework preset:** None
   - **Build command:** اتركه فارغ أو `exit 0`
   - **Build output directory:** `/`
6. **Save and Deploy**
7. أضف **Custom domains**: `parkinzi.com` و `www.parkinzi.com`

**ملاحظة:** إذا كان لديك مشروع Direct Upload باسم `parkinzi`، أنشئ المشروع الجديد باسم `parkinzi` أو حذف القديم أولاً. الدومين `parkinzi.com` يُربط بالمشروع الجديد.

### التحديثات اللاحقة

```bash
cd /Users/Raad/Documents/Xcode/Web
# عدّل الملفات...
git add .
git commit -m "تحديث الموقع"
git push
```

سيتم النشر تلقائياً خلال دقائق.

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

---

## 🔒 إعداد Cloudflare Zero Trust (Access)

Zero Trust يمنح التحكم في الوصول عبر البريد الإلكتروني أو Google/GitHub.

### متى تستخدمه؟

| الحالة | التوصية |
|--------|----------|
| الموقع عام للجميع | لا تحتاج Access |
| حماية مسار إداري (مثل `/admin`) | استخدم Access على المسار فقط |
| إخفاء الموقع مؤقتاً (ستايجينغ) | استخدم Access على كامل الموقع |

### الخطوة 1: Zero Trust Dashboard

1. ادخل [one.dash.cloudflare.com](https://one.dash.cloudflare.com/) أو من لوحة التحكم: **Zero Trust**
2. إذا سُئلت عن إنشاء تنظيم، اختر اسم (مثل `parkinzi`) ثم **Create**

### الخطوة 2: إضافة تطبيق (Application)

1. من القائمة: **Access** → **Applications**
2. **Add an application**
3. اختر **Self-hosted**
4. املأ الحقول:
   - **Application name:** `Parkinzi Website`
   - **Session Duration:** 24 hours (أو حسب الحاجة)
   - **Application domain:**
     - لحماية كامل الموقع: `parkinzi.com`
     - لحماية مسار فقط: `parkinzi.com/admin` (مثال)

5. اضغط **Next**

### الخطوة 3: إنشاء سياسة الوصول (Policy)

1. **Add a policy**
2. **Policy name:** `Allowed Emails`
3. **Action:** Allow
4. **Configure rules:**
   - **Include** → **Emails** → أدخل بريدك (مثل `raadbadr@gmail.com`)
   - أو **Include** → **Emails ending in** → `@parkinzi.com` (لو عندك دومين بريد)
5. اضغط **Next** ثم **Save**

### الخطوة 4: ربط الدومين

- الدومين `parkinzi.com` يجب أن يكون **مُداراً عبر Cloudflare** (السحابة برتقالية)
- من **Zero Trust** → **Settings** → **Authentication** → تحقق من وجود `parkinzi.com` في **Application Domains**
- إذا لم يكن موجوداً، أضفه وجرب الوصول مجدداً

### إلغاء الحماية

للإيقاف: **Access** → **Applications** → اختر التطبيق → **Delete** أو **Disable**.

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

**تم التحديث:** 2026-02-17
