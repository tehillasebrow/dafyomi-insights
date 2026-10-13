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

**On your PC (the one in use, since 2026-10-13).** A Windows scheduled task runs `npm run import:weekly-pc` every **Thursday** and **Friday** at 11am (or as soon as the PC is on). It finds the new column, has **Claude Code review it** with `/review-import` exactly like the backfill (text against the page, title, daf, 3–6 topics plus subtopics, other places, stories, photo), adds a title card if there's no usable photo, and publishes it. The site refreshes and the admin gets the mailing-list preview email. New subtopics are added to `data/topics.json`, and that one file is committed and pushed, so Vercel rebuilds the site and their pages appear. Anything Claude isn't sure about is set to `held` and not published, and a GitHub issue emails you what to check. It uses your Claude Code plan, not an API key.
```
npm run import:schedule                                   # set up the scheduled task (once)
npm run import:weekly-pc -- --dry-run                     # check without publishing
npm run import:weekly-pc -- --only data/import/jewishhome/articles/<folder>   # re-run one column
```
The log is in `logs/weekly-import.log`. Keep the GitHub workflow below **disabled** so the column isn't published twice.

**On GitHub (no Claude, so no topics or stories; disabled).** GitHub runs `.github/workflows/weekly-import.yml` every **Thursday** and, as a second try, every **Friday**. Each run:
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

## Pieces that aren't about a daf ("Beyond the Daf")

Some of his pieces are hespedim, tributes, interviews or other writing, not a daf column. During review these get `"standalone": true` in `article.json`, with `masechta`, `daf` and `daf_end` set to `null` and `refs` set to `[]`. When published they appear under **Beyond the Daf** (`/beyond-the-daf`) instead of on a daf page; their stories show under "Beyond the Daf" on the stories page. `npm run import:publish` refuses any article that is neither standalone nor on a real masechta and daf, and `npm run import:check-seo` flags a standalone article that still has a daf or refs. This needs the database migration `supabase/migrations/20261013000000_standalone_articles.sql`.

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

## 5 Towns Jewish Times (2010–2021)

He wrote "Daf Yomi Insights" for 5TJT from at least 2010 until January 2021. 5TJT rebuilt its website in 2024 and the old article pages are gone, so the columns come from two places:

1. **The printed issues (July 2011–2020).** 5tjt.com/paper/ still links every issue to a Flipdocs flipbook with the full PDF. The list of issues is in `scripts/import/5tjt-flipdocs.tsv` (collected 2026-10-12).
   ```
   npm run import:5tjt-pdf                    every issue (about an hour; resumes where it stopped)
   npm run import:5tjt-pdf -- --issue 306203  one issue
   npm run import:5tjt-pdf -- --year 2018     one year
   ```
   It reads each PDF's text with the same layout code as the Jewish Home importer, follows "Continued on Page N", draws the page images itself, and crops the photo. A column also found on the old website (same title, within three weeks) is skipped.
2. **The old website, via the Internet Archive** (2010–2021, including issues missing from the PDFs). Some networks block archive.org, so the downloading runs on GitHub (`.github/workflows/fetch-5tjt.yml` and `sweep-5tjt.yml` on the `import-5tjt` branch); download the run's files into `data/import/5tjt/<folder>/`, then `npm run import:5tjt -- --new-only` stages them (`--dry-run` to just look). Pages by Baila or other Sebrows are kept apart, never staged.
