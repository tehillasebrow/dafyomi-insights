# Newspaper importer

This brings Rabbi Sebrow's **"Delving into the Daf"** columns from **The Jewish Home** (2019 to now, read from the paper's digital edition on issuu.com/jewishhome) onto the site, with the title, the full text, subheadings and the photo.

It only takes a page whose byline is **"By Rabbi Avrohom Sebrow"**, so other writers' columns are never imported.

Nothing goes on the site until it has been checked. Each run saves the articles as files first, in `data/import/`. You can look at them, they get reviewed, and then they're published.

## One-time setup

1. You need **`.env.local`** with the Supabase keys (see `scripts/README.md`, step 2).
2. For the weekly run on GitHub, open the repository on GitHub and go to **Settings → Secrets and variables → Actions → New repository secret**. Add these four, with the same values as in `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REVALIDATE_SECRET`
3. Make sure GitHub emails you about issues: **github.com → Settings → Notifications**, with "Email" turned on for issues you're assigned to.

## The backfill (old articles, done once)

```
npm run import:jh -- --since 2019-01-01      # 1. find every column since 2019 (takes a few hours, can be stopped and restarted)
npm run import:preview                       # 2. open data/import/preview.html in a browser to look through them
```
3. In Claude Code, type **`/review-import`**. Claude checks every article against the newspaper page and fixes it: the order of the text, tables, headings, the daf and the photo. You can do one year at a time, e.g. `/review-import 2023`.
4. Look over `data/import/review.csv` (it opens in Excel) or the preview page again.
```
npm run import:publish -- --dry-run          # 5. shows what would be published, changes nothing
npm run import:publish                       # 6. publishes the reviewed articles to the site
```
An article that's already on the site (one you typed in by hand) is skipped and listed, never overwritten or doubled.

## Every week: automatic

GitHub runs `.github/workflows/weekly-import.yml` every **Thursday** and, as a second try, every **Friday**. Each run:
1. checks the newest issues of The Jewish Home for his column,
2. publishes it right away **if nothing looks wrong**,
3. otherwise holds it back and **opens a GitHub issue, which emails you**. The same happens if:
   - there's still no column by Friday (normal for a Yom Tov week),
   - no new issue has been uploaded in over 9 days,
   - publishing failed,
   - or anything crashed.

When you get that email, open the project in Claude Code and say **"review the newspaper import"**. Close the GitHub issue when it's handled.

You can also run it by hand: on GitHub go to **Actions → Weekly newspaper import → Run workflow**. Or run it on your computer:
```
npm run import:weekly -- --dry-run           # check without publishing
```

## What gets checked automatically

An article is held back for a person when:
- its title, its ending (the author bio) or a photo can't be found,
- it's unusually short,
- it contains a table, box or wide section (the reading order can get scrambled),
- some text didn't fit the columns,
- or its daf seems far from that week's Daf Yomi.

Smaller notes don't hold an article back, but they are listed in the review sheet. Examples: the article continues on a second page, there's a second picture, or a pull quote was left out.

## Files

- `data/import/review.csv`: one row per article. "CHECK" rows need a look and come first.
- `data/import/preview.html`: the articles as they'll look, next to the newspaper page.
- `data/import/jewishhome/articles/<date>-<title>/`:
  - `article.json`: the article
  - `photo.jpg`: the photo
  - `page.jpg` / `page-<n>.jpg`: the newspaper page(s)
- `logs/import-jewishhome.log`: the backfill's log.

`data/import/` is not saved in git.

## 5 Towns Jewish Times (before mid-2019)

5TJT rebuilt its website in 2024 and his older columns are no longer on it; the only copies left are in the Internet Archive (web.archive.org). That importer isn't built yet.
