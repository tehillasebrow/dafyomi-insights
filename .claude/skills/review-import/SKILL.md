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

**5 Towns Jewish Times articles** (`data/import/5tjt/…`) come from two places:
- **The old 5tjt.com website** (they have `archive_url`): no `page.jpg` and no column order to fix. Check them from the text itself: title (without "Daf Yomi Insights:"), paragraphs, `## ` headings, nothing from the site's menus or ads, the ending (his bio is kept apart in `bio`), the daf and the photo. `archive_url` is where the page was saved, for reference only. Pages saved before 2013 may show odd characters ("â€™" for "’"): fix them to the right punctuation.
- **The printed issue's PDF** (they have `pdf`): review them like Jewish Home articles, against `page.jpg` and `page-<n>.jpg`. The 5TJT layout puts a "DAF YOMI" box with the byline at the top left and the headline under it; the columns to the right of the box start at the top of the page. A column that jumps says "Continued on Page N"; the rest is on `page-<N>.jpg` under "Continued from Page …". Some pieces are hespedim or other writing, not a daf column: still his, so review them the same way and say so in the notes. Old columns (2010–2011) may have no bio.

**Known importer gaps to look for** (Jewish Home):
- the big first letter is sometimes a picture, so the text starts "he Gemara…" (there's a warning): add the letter from the page;
- photo captions or a short ad can slip into the text: remove them;
- a word broken at a line end may still be split ("Yisra el") or keep a stray hyphen ("por-tions"): fix it from the page.

**Reprints:** the review sheet flags articles whose text mostly matches another one ("a reprint? keep one"). Don't delete or reject either one. Review each on its own, and note the other article's title in `review.notes`. The site owner decided (2026-10-12) to publish only the **most recent** copy: after reviewing, run `npm run import:reprints` (then `-- --write`). It sets the older copy aside and moves its stories, topics and other places to the newer one. If the newer copy hasn't been reviewed yet, review it first.

## For each article

1. **Read `article.json`**, then **look at `page.jpg`** (and every `page-<n>.jpg`). Read the `warnings`: they say where the importer was unsure.
2. **Title**: must match the headline exactly, including its subtitle as "Title: Subtitle". Keep the paper's spelling and punctuation.
3. **Whole text, right order**: the first sentence and the last sentence must match the page; every column must be there in reading order (down each column, then the next column to the right; text continues below a photo or pull quote in the same column). Nothing from ads, captions, pull quotes (a sentence repeated in big type), the page header or the author bio. For a continuation page, the article picks up where the last column of the first page ends.
4. **Paragraphs and headings**: paragraphs are separated by a blank line (`\n\n`). Each subheading printed in the column (usually orange/bold) is its own paragraph starting with `## `. A bold lead-in at the start of a paragraph is not a heading.
5. **Tables and boxes**: the site can't show a table. Turn it into one plain-text paragraph per row, using the table's own words and its column headings, e.g. `Overturning a Lenient Ruling (A second rav wants to be strict) — According to Rashi: Prohibited. It is still disrespectful… According to the Ra'avad/Ritva: Permitted. If the first rav…`. No markdown other than `## ` headings. A boxed sidebar goes where it sits in the reading order, with its heading as `## `.
6. **Hyphens and joins**: no words wrongly split (`wick ed`) or glued (`thatcauses`); words broken at line ends are rejoined (`Tal-mud` → `Talmud`), real hyphens stay (`court-mandated`).
7. **Daf**: `masechta` and `daf` must be the daf the column is about, normally the Daf Yomi of that week. `citations` lists what the text cites. Use the spelling from `app/lib/shas.js` (e.g. "Kesubos", "Bava Metzia", "Rosh Hashanah"). If the column covers a range, set `daf` to the first and add `"daf_end"`.
   **Not about a daf?** Hespedim, tributes, interviews, Q&As and other writing that isn't about a particular daf go on the site under "Beyond the Daf" (`/beyond-the-daf/<slug>`). For these set `"standalone": true`, `"masechta": null`, `"daf": null`, `"daf_end": null` and `"refs": []`, and say so in the notes. Still list any Gemara stories it tells in `stories`, and still give it `tags` (the topic "Gedolim" fits tributes). Don't use `standalone` just because the daf is hard to find: a daf column always gets its daf.
8. **Photo**: look at `photo.jpg`. It must be the article's own picture, cropped cleanly, not an ad or the column logo. If it's wrong or missing, set `"photo": null` and add a note (say which picture it should be). Don't try to crop images yourself.
   **No picture printed with the column?** Every article on the site gets a real photo, so find a free-license one: `npm run -s photos:find -- <folder> "query" "query"` (2–4 short concrete queries for the column's subject: its modern hook or the halachic object, e.g. "etrog", "mezuzah", "baseball glove"), Read the contact sheet it saves (`data/photos/candidates/<folder>.jpg`), then `npm run -s photos:pick -- <folder> <number>` (add `--crop` for a tall or very wide photo). Choose a sharp, well-composed photo with no watermark or text, suitable for an Orthodox readership (nothing immodest, no other religions' symbols, nothing political). This sets `"photo": "stock.jpg"` and its credit; save your other fields without dropping those. Only if nothing suitable turns up, leave `"photo": null` (it then gets a plain title card) and say so in the notes.
9. **Is it his column?** The byline must be "By Rabbi Avrohom Sebrow". If it isn't, set status `rejected`.
10. **Save**: write the corrected fields back into `article.json` (keep every other field as is) and set:
    ```json
    "review": { "status": "approved" | "fixed" | "rejected", "notes": "what you changed or why", "reviewed_on": "<today's date>" }
    ```
    `approved` = nothing needed changing; `fixed` = you changed something; `rejected` = not his column, or so broken it shouldn't be published (say why). If you fixed a summary-affecting first paragraph, also update `summary` to the article's first one or two sentences (max ~280 characters, his exact words).
11. **Never change `published_at`** or rename a folder. The date the paper printed it is how the site orders and labels it.

## Topics, other places and stories (for every article you don't reject)

These are what make an article show up in Google and in AI answers, so do them for every approved or fixed article.

- **`tags`**: 3–6 topics: every subject a reader might browse or search for that the article really discusses (the site owner wants generous topics, since they help people find the site), using the exact topic `name` from `data/topics.json` (never an alias, a citation, a masechta or a person). If an important subject has no topic, leave it out of `tags` and add it to `review.new_topics` as `[{"name", "group", "why"}]`. The site owner adds it to the list. Check the list with `npm run topics:check`.
- **Subtopics, also in `tags`**, after the topics: add 2–4 narrower subjects the article answers, phrased the way someone would search for them, e.g. "Presidential Autopen", "Voice-Activated Devices on Shabbos" or "Salt on the Table at Hamotzi". Each one gets its own page at /topics/{topic}/{subtopic}.
  - Rules: Title Case, 2–7 words, no people, no citations, no masechtos, and no pun headlines.
  - Don't put "in the Gemara" or a question mark in the name: the page heading adds them ("Prohibition of Raising Pigs" shows as "Prohibition of Raising Pigs in the Gemara", and "Are Pets Muktzeh" as "Are Pets Muktzeh?").
  - Reuse an existing subtopic from `topics[].subtopics` in `data/topics.json` whenever one fits.
  - If none fits, add a new one to its topic's `subtopics` in `data/topics.json` as `{"name", "description"}` (no owner approval needed) and put it in `tags`. The description is one neutral sentence of 12–30 words in your own words. Only add subtopics there; don't change anything else in that file.
  - Then run `npm run topics:check`. A subtopic that isn't in `data/topics.json` is dropped when the article is published, and its page appears after the next deploy.
- **`refs`**: other places the article substantially discusses (a real part of it, not a passing citation), as `[{"masechta": "Bava Basra", "daf": 12}]`. Spell masechtos as in `app/lib/shas.js`. Don't include its own daf. Usually 0–3. Write `[]` if there are none. The article is then listed on those masechta and daf pages too.
- **`stories`**: the Gemara stories it tells, following `.claude/skills/extract-stories/SKILL.md`. Each is `{ title, slug, summary, people, tags, start_text, end_text }`, where start_text and end_text are copied exactly from the final `content` and appear once each. Use `data/people-vocabulary.json` spellings and list new names in `review.new_people`. Write `[]` if there are none. Each story becomes its own page when the article is published.

Then run `npm run import:check-seo`. It flags bad tags, bad refs, broken story anchors, and a story that already has a page from an earlier article. `-- --fix` keeps only the first page for such a story.

## When you're done

Run `npm run import:preview` and tell the user, in plain English:
- how many were approved, fixed and rejected (and why any were rejected),
- anything they should look at themselves (open `data/import/preview.html` in a browser),
- that nothing is on the site yet: publishing is a separate step (`npm run import:publish -- --dry-run`, then `npm run import:publish`), and ask before running it.
