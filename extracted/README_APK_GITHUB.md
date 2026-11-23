# دليل تحويل «محاسب خردوات المامو» إلى تطبيق Android APK عبر GitHub وتشغيل Firebase بدون أخطاء SHA

تم تجهيز المشروع بالكامل باستخدام **Capacitor Android** وإعدادات **GitHub Actions** لتوليد ملف **`.apk`** موقّع وجاهز للتثبيت مباشرة على هواتف أندرويد، مع معالجة كاملة لمشكلة **بصمات Firebase (SHA-1 / SHA-256 / `DEVELOPER_ERROR`)**.

---

## 1. كيف يبني GitHub ملف APK تلقائياً؟

عند رفع المشروع إلى مستودع GitHub (`main` أو `master`) أو تشغيل Workflow يدوياً:
1. افتح مستودعك على GitHub ثم انتقل إلى تبويب **Actions**.
2. اختر الـ Workflow المسمّى **`Build Android APK (خردوات المامو)`**.
3. يمكنك تشغيله فوراً بالضغط على **Run workflow**.
4. بعد انتهاء التنفيذ (حوالي دقيقتين)، ستجد في أسفل الصفحة قسم **Artifacts** وبداخله ملف:
   - **`almamo-hardware-store-apk`** (بداخله ملف `almamo-hardware-store.apk` الجاهز للتثبيت على الهاتف).
5. وإذا قمت بإنشاء Tag يبدأ بحرف `v` (مثل `v1.0.0`)، فسيقوم GitHub تلقائياً بنشر ملف APK داخل **GitHub Releases**.

---

## 2. لماذا يعمل Firebase بدون أخطاء SHA-1 / SHA-256 بعد التثبيت؟

عادةً في تطبيقات أندرويد تظهر أخطاء مثل:
- `ApiException: 10` أو `DEVELOPER_ERROR`
- `auth/unauthorized-domain`
- فشل مزامنة Firestore أو حظر نافذة تسجيل الدخول

تم حل كل هذه المشاكل جذرياً في البنية الحالية عبر:
1. **تشغيل التطبيق داخل Capacitor على النطاق المصرح به في Firebase (`https://first-hook-1w2pc.web.app`)**:
   - هذا النطاق معتمد رسمياً ضمن قائمة `authorizedDomains` الخاصة بمشروع Firebase، بينما يبقى `authDomain` على `first-hook-1w2pc.firebaseapp.com` مما يمنع خطأ `auth/unauthorized-domain` داخل APK تماماً.
   - يعمل **Firestore** وقاعدة البيانات المحلية (**IndexedDB**) وكاميرا مسح الباركود والتقاط لقطات الأمان (`getUserMedia`) داخل سياق HTTPS آمن بالكامل.
2. **تفعيل النوافذ المنبثقة وتنظيف User-Agent وملفات الارتباط داخل `MainActivity.java`**:
   - يدعم `MainActivity` نوافذ مصادقة Google المنبثقة (`onCreateWindow`) وملفات تعريف الارتباط للطرف الثالث (`CookieManager`) مع تنظيف علامة WebView لتجاوز قيود `disallowed_useragent` وفتح صلاحيات الكاميرا والتخزين تلقائياً.
3. **الانتقال الذكي عند تسجيل الدخول بـ Google وأزرار الدخول الفوري**:
   - تتوفر دائماً أزرار الدخول الفوري بكلمة المرور أو بالوضع المحلي مباشرة داخل شاشة الدخول ورسائل التنبيه.
4. **ثبات بصمة التوقيع عبر `Keystore` مخزّن مؤقتاً (`actions/cache`)**:
   - يحتفظ GitHub بنفس شهادة التوقيع عبر كل البناءات بدلاً من توليد بصمة عشوائية في كل مرة.
   - يطبع الـ Workflow بصمتي **SHA-1** و **SHA-256** واضحتين داخل **Build Summary**، ويحقنها تلقائياً داخل `public/.well-known/assetlinks.json`.

---

## 3. متغيرات وأسرار اختيارية (GitHub Secrets & Variables)

المشروع يبني APK فوراً **بدون أي إعداد إضافي**، لكن يُنصح اختيارياً بما يلي:
- **`VITE_API_BASE_URL`** (في GitHub → Settings → Secrets and variables → Actions → **Variables**):
  - ضع رابط خادم Render الخاص بك (مثلاً `https://almamo-accounting.onrender.com`) حتى يعمل المساعد الذكي `/api/ai/chat` من داخل ملف APK مباشرة.
  - يمكنك أيضاً تعديله أو إدخاله لاحقاً من داخل التطبيق في: **الإعدادات ← تجهيز تطبيق الأندرويد (APK) وبصمة Firebase SHA**.
- **`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`** (في **Secrets**):
  - اختياري فقط إذا كان لديك ملف توقيع `.jks` خاص بك وتريد استخدامه بدلاً من التوقيع التلقائي.
- **`ANDROID_GOOGLE_SERVICES_JSON`** (في **Secrets**):
  - اختياري لدمج ملف `google-services.json` تلقائياً داخل `android/app/` أثناء بناء APK على GitHub (سواءً كنص JSON مباشر أو Base64).

---

## 4. تفعيل Google Sign-In الأصلي لأندرويد (Credential Manager + Google Sign-In)

يدعم التطبيق الآن **تسجيل دخول Google الأصلي على أندرويد** عبر إضافة مدمجة (`NativeGoogleAuthPlugin`) تستخدم أحدث واجهة **Android Credential Manager** مع مسار احتياطي تلقائي لخدمات Google Play (`GoogleSignInClient`) وتمرير `idToken` إلى **Firebase Authentication** (`signInWithCredential`).

لتفعيل النافذة الأصلية بدون خطأ `DEVELOPER_ERROR` / `10`:
1. افتح ملخص آخر تشغيل ناجح لـ Workflow **`Build Android APK (خردوات المامو)`** على GitHub وانسخ بصمة **`SHA-1`**.
2. ادخل إلى **Firebase Console ← إعدادات المشروع (`first-hook-1w2pc`) ← تطبيقاتك ← Android (`com.almamo.hardware`)**.
3. أضف بصمة **SHA-1** (وبصمة **SHA-256** أيضاً) واحفظ التغييرات.
4. *(اختياري)* نزّل `google-services.json` وأضفه كـ Secret باسم **`ANDROID_GOOGLE_SERVICES_JSON`** إذا أردت، علماً أن التطبيق مهيأ للعمل أيضاً عبر **`default_web_client_id`** مباشرة حتى بدون الملف.

---

## 5. استخراج وفحص SHA-256 من داخل التطبيق

من صفحة **الإعدادات** داخل التطبيق يمكنك:
- نسخ معرّف الحزمة: `com.almamo.hardware`
- نسخ معرّف مشروع Firebase، ونطاق المصادقة، و **Web Client ID (Google OAuth)**
- لصق بصمة **SHA-256** المطبوعة في GitHub لتوليد ونسخ ملف **`assetlinks.json`** الجاهز أو إضافتها في متغير البيئة **`ANDROID_SHA256_FINGERPRINTS`** على Render.
