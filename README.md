# Ibtesab Alam Portfolio — Supabase GUI Admin

## What this version does
- `index.html`: public portfolio
- `admin.html`: login-protected admin panel
- Profile photo: upload/replace from the admin panel
- Experience: add/edit/delete from the admin panel
- Supabase project is connected through `supabase-config.js`
- Admin password recovery uses Supabase Auth email recovery; the browser does not store passwords or create reset tokens.

## Admin password recovery
- The Admin Panel requests a Supabase Auth recovery email and returns a generic confirmation to avoid account enumeration.
- In Supabase Dashboard → Authentication → URL Configuration, allow the deployed Admin Panel URL (for example, `https://ibtesab-alam.vercel.app/admin.html`) as a Redirect URL. Set the Site URL to the deployed site origin. Add a localhost redirect only if testing from a local web server; opening the page as `file://` is not a supported recovery redirect.
- Configure Supabase Auth email delivery (custom SMTP is recommended for reliable production delivery), sender details, rate limits and the password recovery email template in the Dashboard. The reset email must link back to the requested redirect URL.
- The recipient opens the one-time, expiring recovery link, chooses and confirms a new password in `admin.html`, and Supabase Auth verifies the recovery session and updates the password using its server-side password hashing. No reset token or password is stored by portfolio code.
- Reset email delivery and token expiry are controlled by Supabase Auth settings; no email-service credentials or reset secrets are required in frontend configuration.

## Supabase setup already completed
- Project created
- `experience` table created
- `profile-photo` public bucket created
- Supabase Auth admin user created
- Experience and Storage policies created

## Important
The browser uses the Supabase **publishable** key. Do NOT put an `sb_secret_...` key in this repository.

## Admin URL after Vercel deployment
`https://ibtesab-portfolio.vercel.app/admin.html`

## Database columns expected
`id`, `company`, `position`, `start_date`, `end_date`, `description`, `sort_order`

## Storage
Bucket: `profile-photo`
Fixed file path used by the app: `profile/profile-photo.webp`

If the portfolio shows old content after a photo change, refresh the page once.
