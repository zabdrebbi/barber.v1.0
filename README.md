# حجز مواعيد صالون حلاقة — PWA (React + Vite + TS + Tailwind + shadcn/ui + TanStack Query + Zod)

يعمل تطبيق "صالون الأناقة" بالكامل كـ PWA مع دعم عربي (RTL) وخط Cairo، يُظهر مواعيد حقيقية، يمنع الحجز المزدوج، يدير حالات الموعد، ويعمل في وضع عرض تجريبي دون إعداد Supabase.

## 1. المتطلبات
- Node.js >= 20
- npm >= 10

## 2. تشغيل محلياً
```bash
npm install
npm run dev
```
يفتح التطبيق على http://localhost:5173

## 3. إعداد Supabase (اختياري)
أنشئ مشروع جديد في Supabase ثم نفذ:
- `supabase/migrations/0001_init.sql`
- `supabase/seed.sql` (عدّل `{{ADMIN_EMAIL}}` إلى بريدك الأولي في الملف أو عدّل `app_secrets.admin_email` بعد التنفيذ)

انسخ `.env.example` إلى `.env` وعدّل:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
ADMIN_EMAIL=your-email@gmail.com
```

## 4. نشر Edge Functions (اختياري)
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy book --no-verify-jwt=false
supabase functions deploy auth-bootstrap --no-verify-jwt=false
```

## 5. متغيرات الإنتاج
اجعل في مشروع Vite (Vercel/Netlify) القيم التالية:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- (بريد الأدمن يُقرأ من الخادم فقط عبر Edge Function `auth-bootstrap` أو دالة `claim_admin_role`)

## 6. نقاط ملاحظات
- جميع الأوقات تُخزّن UTC ويُعرض حسب `Africa/Algiers` عبر Intl.
- فرض التداخلات عبر `EXCLUDE USING GIST (tstzrange(scheduled_at, ends_at) WITH &&)` مع شرط `WHERE status IN ('pending','accepted_awaiting_schedule','scheduled')`.
- الزبون يمكنه إلغاء مواده فقط. بقية التحوّلات للحلاق عبر `user_roles` و`is_admin()`.
- وضع العرض التجريبي يعمل تلقائياً عند عدم تعيين مفاتيح Supabase.

## 7. سكربتات
- `npm run dev` — تطوير
- `npm run build` — بناء + TypeScript
- `npm run preview` — معاينة البناء
- `npm run typecheck` — فحص الأنواع
- `npm run test` — اختبار

## 8. ملحقات سريعة
- Admin: `/admin` (يطلب تسجيل دخول + صلاحية حلاق)
- التتبع: `/track?token=...`
- التاريخ: `/history`
- قالب واتساب: الرابط يُولّد تلقائياً مع اسم الخدمة/التاريخ/الوقت
