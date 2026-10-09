# خطوات النشر الفعلي (Supabase + Vercel + Google + wa.me)

## 1) Supabase
1. أنشئ مشروعًا جديدًا، ثم خذ من `Project Settings > API`: **Project URL** و**anon public key**، ومن `General` خذ **Project Ref**.
2. افتح `SQL Editor` وشغّل `supabase/migrations/0001_init.sql` كاملًا.
3. افتح `supabase/seed.sql` واستبدل `{{ADMIN_EMAIL}}` ببريد Google الذي ستدخل به كحلاق (أدمن)، ثم شغّله في `SQL Editor`.
   - إن أخطأت في البريد: `update public.app_secrets set value = 'you@gmail.com' where key = 'admin_email';`
4. Realtime: ملف الهجرة يضيف الجدولين تلقائيًا. تحقق فقط من `Database > Publications > supabase_realtime`.

## 2) Edge Functions
```bash
npm i -g supabase            # أو: npx supabase ...
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ADMIN_EMAIL=you@gmail.com
supabase functions deploy book
supabase functions deploy auth-bootstrap
```
- المتغيّران `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` يوفّرهما Supabase تلقائيًا للدوال، لا تضفهما.
- لا يوجد خيار `--set` في أمر `deploy`؛ الأسرار تُضبط بـ `supabase secrets set`.

## 3) تسجيل الدخول بـ Google
1. في Google Cloud Console: `APIs & Services > Credentials > Create OAuth client ID` (نوع **Web application**).
2. أضف في **Authorized redirect URIs**: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. في Supabase: `Authentication > Providers > Google` فعّله وألصق `Client ID` و`Client Secret`.
4. في Supabase: `Authentication > URL Configuration`:
   - **Site URL** = رابط موقعك على Vercel (مثل `https://your-app.vercel.app` أو نطاقك الخاص).
   - **Redirect URLs** أضف نفس الرابط، وأضف `http://localhost:5173` للتطوير.

## 4) Vercel
1. ارفع المستودع إلى GitHub (بعد تنظيفه من `node_modules` و`dist`)، ثم `Add New > Project` في Vercel واختره. الإعدادات يقرؤها Vercel من `vercel.json` (Vite، مجلد الإخراج `dist`، وإعادة توجيه المسارات إلى `index.html`).
2. في `Settings > Environment Variables` أضف:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. أعد النشر (Redeploy) بعد إضافة المتغيّرات، لأن متغيّرات `VITE_` تُدمج وقت البناء.
4. لا تضف `ADMIN_EMAIL` ولا أي مفتاح سري في Vercel؛ مكانها أسرار Supabase فقط.

## 5) التحقق
1. افتح الموقع وجرّب حجزًا كزبون من الصفحة الرئيسية.
2. سجّل الدخول بحساب Google المطابق لـ `ADMIN_EMAIL`، ثم افتح `/admin/requests` وتأكد من ظهور الطلب.
3. جرّب قبول الطلب وتحديد وقته، وافتح رابط التتبّع `/track?token=...`.
4. إشعارات واتساب تعمل بروابط `wa.me` المجانية: يفتح الحلاق الرابط ويضغط إرسال بنفسه (لا إرسال تلقائي).
5. PWA: افتح الموقع في الهاتف، أضفه إلى الشاشة الرئيسية، واختبر وضع عدم الاتصال.
