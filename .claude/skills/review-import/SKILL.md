---
name: review-import
description: Check and fix newspaper articles staged by the importer (data/import/*/articles/*/article.json) against the scanned newspaper page, so each one has the right title, the whole text in the right order, correct formatting, the right daf and the right photo. Use when asked to review, check, clean up or approve the newspaper import or the backfill, or when a weekly-import GitHub issue says an article was held back.
argument-hint: "[date range like 2024, 2024-05, or 'check' for flagged ones only]"
allowed-tools: Read, Glob, Grep, Write(data/import/**), Edit(data/import/**), Bash(npm run import:preview*), Bash(npm run import:jh*)
---

# Review imported newspaper articles

The importer copied Rabbi Avrohom Sebrow's "Delving into the Daf" columns out of the newspaper's digital edition. The words are exact (they come from the paper's own text layer, not OCR), but the **layout** can trip it up: columns read in the wrong order, a table read cell by cell, a heading missed, an ad's words mixed in, the end of the article on another page, the wrong photo. Your job is to make each article match the printed page.

**Never change his wording.** Fix order, missing or extra pieces, joins and formatting only. If a word is truly garbled in the source (rare), fix it to what the page image shows and say so in the notes.

## Which articles

Each staged article is a folder `data/import/<source>/articles/<date>-<slug>/` with:
- `article.json`: the article (fields below)
- `page.jpg`: the first newspaper page; `page-<n>.jpg`: any continuation page
- `photo.jpg`: the photo that will be shown with the article (may be missing)

Review folders whose `article.json` has `review.status` = `"pending"`. With arguments ($ARGUMENTS): a year or month (`2024`, `2024-05`) limits it to folders starting with that date; `check` limits it to articles that have `warnings`. Work oldest first. Do them in batches of about 10 and keep going until done or the user stops you; after each batch, say how many are left.

## For each article

1. **Read `article.json`**, then **look at `page.jpg`** (and every `page-<n>.jpg`). Read the `warnings`: they say where the importer was unsure.
2. **Title**: must match the headline exactly, including its subtitle as "Title: Subtitle". Keep the paper's spelling and punctuation.
3. **Whole text, right order**: the first sentence and the last sentence must match the page; every column must be there in reading order (down each column, then the next column to the right; text continues below a photo or pull quote in the same column). Nothing from ads, captions, pull quotes (a sentence repeated in big type), the page header or the author bio. For a continuation page, the article picks up where the last column of the first page ends.
4. **Paragraphs and headings**: paragraphs are separated by a blank line (`\n\n`). Each subheading printed in the column (usually orange/bold) is its own paragraph starting with `## `. A bold lead-in at the start of a paragraph is not a heading.
5. **Tables and boxes**: the site can't show a table. Turn it into one plain-text paragraph per row, using the table's own words and its column headings, e.g. `Overturning a Lenient Ruling (A second rav wants to be strict) — According to Rashi: Prohibited. It is still disrespectful… According to the Ra'avad/Ritva: Permitted. If the first rav…`. No markdown other than `## ` headings. A boxed sidebar goes where it sits in the reading order, with its heading as `## `.
6. **Hyphens and joins**: no words wrongly split (`wick ed`) or glued (`thatcauses`); words broken at line ends are rejoined (`Tal-mud` → `Talmud`), real hyphens stay (`court-mandated`).
7. **Daf**: `masechta` and `daf` must be the daf the column is about, normally the Daf Yomi of that week. `citations` lists what the text cites. Use the spelling from `app/lib/shas.js` (e.g. "Kesubos", "Bava Metzia", "Rosh Hashanah"). If the column covers a range, set `daf` to the first and add `"daf_end"`.
8. **Photo**: look at `photo.jpg`. It must be the article's own picture, cropped cleanly, not an ad or the column logo. If it's wrong or missing, set `"photo": null` and add a note (say which picture it should be). Don't try to crop images yourself.
9. **Is it his column?** The byline must be "By Rabbi Avrohom Sebrow". If it isn't, set status `rejected`.
10. **Save**: write the corrected fields back into `article.json` (keep every other field as is) and set:
    ```json
    "review": { "status": "approved" | "fixed" | "rejected", "notes": "what you changed or why", "reviewed_on": "<today's date>" }
    ```
    `approved` = nothing needed changing; `fixed` = you changed something; `rejected` = not his column, or so broken it shouldn't be published (say why). If you fixed a summary-affecting first paragraph, also update `summary` to the article's first one or two sentences (max ~280 characters, his exact words).

## When you're done

Run `npm run import:preview` and tell the user, in plain English:
- how many were approved, fixed and rejected (and why any were rejected),
- anything they should look at themselves (open `data/import/preview.html` in a browser),
- that nothing is on the site yet: publishing is a separate step (`npm run import:publish -- --dry-run`, then `npm run import:publish`), and ask before running it.
