# Ibtesab Alam Portfolio — Supabase GUI Admin

## What this version does
- `index.html`: public portfolio
- `admin.html`: login-protected admin panel
- Profile photo: upload/replace from the admin panel
- Experience: add/edit/delete from the admin panel
- Supabase project is connected through `supabase-config.js`

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
