# Ibtesab Alam Portfolio

Vercel-ready static portfolio for **Ibtesab Alam — Network Engineer & IT Infrastructure Engineer**.

## Structure

- `index.html` — portfolio homepage + SEO metadata + Person structured data
- `sitemap.xml` — search-engine sitemap
- `robots.txt` — crawler instructions + sitemap URL
- `vercel.json` — Vercel headers
- `Ibtesab_Alam_CV.pdf` — downloadable CV

## Deploy on Vercel

Vercel supports static websites and can deploy a folder/ZIP directly. Upload this project through Vercel's dashboard/Drop flow or import it into a Git repository.

After deployment, verify:

- `https://YOUR-DOMAIN/sitemap.xml`
- `https://YOUR-DOMAIN/robots.txt`

### Important

The current SEO canonical/sitemap URL is:

`https://ibtesab-alam.vercel.app`

If Vercel assigns a different project URL, replace `https://ibtesab-alam.vercel.app` in **both `index.html` and `sitemap.xml`** with the actual production URL before requesting indexing.

## Google indexing

After the site is live, add the production URL to Google Search Console and submit:

`https://YOUR-DOMAIN/sitemap.xml`

Google decides when/if a page appears in search; SEO metadata improves how the page is understood and displayed but does not guarantee a particular ranking.
