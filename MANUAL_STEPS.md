# قائمة خطوات يدوية (بعد النشر في Supabase)

1. **إنشاء مشروع Supabase** → احصل على `Project URL` و`Anon Key` و`Project Ref`.
2. **تشغيل الهجرات** → `SQL Editor` → شغّل `supabase/migrations/0001_init.sql`.
3. **تخزين Seed** → شغّل `supabase/seed.sql` (تأكد من تعديل قيمة `admin_email` في الجدول `app_secrets` إلى بريد Google الخاص بك).
4. **تفعيل Realtime** → `Database > Replication` → فعّل `supabase_realtime` للجداول: appointments, in_app_notifications (اختياري).
5. **نشر Edge Functions**:
   ```bash
   supabase functions deploy book
   supabase functions deploy auth-bootstrap --set ADMIN_EMAIL=your-email@gmail.com
   ```
6. **إعداد OAuth (اختياري)** → `Authentication > Providers` → فعّل Google، وأضف Redirect URL للمشروع.
7. **متغيرات بيئة الواجهة** → `.env` (تطوير) أو منصة النشر: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
8. **تسجيل الدخول كأدمن** → سجل دخول بـ `ADMIN_EMAIL` → سينتقل الدور تلقائياً (عبر `claim_admin_role()`).
9. **التحقق من الحجز** → جرب حجزاً من الصفحة الرئيسية، تحقق من طلبات الحلاق `/admin/requests` وتتبّع الرابط.
10. **PWA** → افتح في الهاتف، أضف إلى الشاشة الرئيسية، اختبر وضع عدم الاتصال (Offline).

ملاحظة: وضع العرض التجريبي يعمل دون خطوات 1–8.