# دليل استضافة مشروع «محاسب خردوات المامو» على Render

المشروع مهيأ بالكامل للعمل على منصة **Render** كـ **Web Service (Node.js)** مع خادم Express، وبناء Vite + PWA، ومسارات الذكاء الاصطناعي `/api/ai/*`، وفحص الجاهزية `/health`.

---

## الطريقة الأولى: النشر التلقائي عبر Blueprint (`render.yaml`) — الأسهل
1. ارفع المشروع إلى مستودع **GitHub** (أو GitLab).
2. ادخل إلى لوحة تحكم [Render](https://dashboard.render.com/) واختر **New +** ← **Blueprint**.
3. اربط مستودع GitHub الخاص بالمشروع؛ سيتعرف Render تلقائياً على ملف `render.yaml`.
4. أدخل متغيرات البيئة الاختيارية للذكاء الاصطناعي (واحد على الأقل لتشغيل المستشار الذكي):
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
5. اضغط **Apply / Deploy** وانتظر انتهاء البناء وتشغيل الخدمة.

---

## الطريقة الثانية: إنشاء Web Service يدوياً على Render
إذا أنشأت الخدمة يدوياً من **New +** ← **Web Service**:
- **Runtime:** `Node`
- **Build Command:** `npm install --include=dev && npm run build`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`
- **Environment Variables:**
  - `NODE_ENV` = `production`
  - `NODE_VERSION` = `22.23.2`
  - `GEMINI_API_KEY` = مفتاح Gemini الخاص بك (اختياري)
  - `GROQ_API_KEY` = مفتاح Groq الخاص بك (اختياري)

> **ملاحظة مهمة:** المنفذ (`PORT`) يُحقن تلقائياً من Render، والخادم يربط على `0.0.0.0` تلقائياً.

---

## تفعيل تسجيل الدخول بحساب Google (Firebase) بعد النشر
بعد الحصول على رابط Render الخاص بك (مثل `https://almamo-accounting.onrender.com`):
1. افتح **Firebase Console** ← مشروعك ← **Authentication** ← **Settings** ← **Authorized domains**.
2. اضغط **Add domain** وأضف نطاق Render الخاص بك (بدون `https://`، مثل: `almamo-accounting.onrender.com`).
3. بعد هذه الخطوة سيعمل تسجيل الدخول بحساب Google والمزامنة السحابية فوراً من رابط Render.

---

## العمل بلا إنترنت على خطة Render المجانية
- في الخطة المجانية من Render قد يدخل الخادم في وضع السبات بعد 15 دقيقة دون طلبات، ويستيقظ تلقائياً عند أول زيارة.
- بفضل دعم **PWA** وقاعدة البيانات المحلية **IndexedDB**، يستمر التطبيق في العمل والبيع والطباعة فوراً حتى أثناء السبات أو انقطاع الإنترنت، ثم يزامن تلقائياً مع السحابة فور عودة الاتصال.
