# دليل الاستضافة المباشرة على Netlify — نظام محاسب خردوات المامو

تم تجهيز وتكوين التطبيق بالكامل ليعمل على **Netlify** بنقرة واحدة وبأعلى كفاءة.

---

### ملفات التكوين المجهزة تلقائياً:
1. **`netlify.toml`**: يحدد أمر البناء (`npm run build`) ومجلد النشر (`dist`) ودوال Serverless (`netlify/functions`) وقواعد إعادة التوجيه لـ SPA (`/* -> /index.html`).
2. **`public/_redirects`**: يضمن عمل التوجيه الداخلي وتمرير كافة الروابط بدون أخطاء 404 عند تحديث الصفحة أو استخدام روابط مباشرة.
3. **`netlify/functions/api.ts`**: دالة Serverless سحابية لمعالجة اتصالات الذكاء الاصطناعي (`/api/ai/chat` و `/api/ai/status`) لدعم نماذج Qwen و Gemini.
4. **محرك الذكاء الاصطناعي المباشر (Offline/Client Resilience)**: يعمل تلقائياً حتى بدون خادم أو مفاتيح API، لمعالجة الأوامر المحاسبية الفورية مثل «أضف منتج جديد باسم مسمار» أو «ما هو رصيد المخزون؟».

---

### خطوات النشر على Netlify (طريقتان):

#### الطريقة الأولى: الربط عبر GitHub (الأسهل والأفضل للتحديثات التلقائية)
1. ارفع المشروع إلى مستودع GitHub الخاص بك.
2. ادخل إلى حسابك في [Netlify](https://app.netlify.com/).
3. اضغط على **"Add new site"** ثم **"Import an existing project"**.
4. اختر **GitHub** ثم حدد مستودع المشروع.
5. سيقرأ Netlify الإعدادات تلقائياً من `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
6. (اختياري) أضف المتغيرات البيئية في **Site Configuration > Environment variables**:
   - `GROQ_API_KEY`: مفتاح Groq لنموذج Qwen 3.8 27B.
   - `GEMINI_API_KEY`: مفتاح Google Gemini البديل.
7. اضغط **Deploy Site** وسيبدأ موقعك بالعمل فوراً برابط مجاني مثل `https://your-app.netlify.app`.

---

#### الطريقة الثانية: الرفع المباشر بدون كود (Netlify Drop)
1. قم بتشغيل أمر البناء محلياً:
   ```bash
   npm run build
   ```
2. ادخل إلى [Netlify Drop](https://app.netlify.com/drop).
3. اسحب مجلد **`dist`** وأفلته في الصفحة.
4. سيعمل التطبيق فوراً خلال 5 ثوانٍ!
