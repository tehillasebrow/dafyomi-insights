---
name: extract-stories
description: Split exported Daf Yomi articles (data/articles/*.json) into individual Gemara stories with titles, summaries, sages and tags, writing one draft per article to data/stories/. Use when asked to extract, split or find the stories in articles, or when run by scripts/story-pipeline.mjs.
argument-hint: "[masechta or file name filter]"
allowed-tools: Read, Glob, Grep, Write(data/**), Edit(data/**)
---

# Extract Gemara stories from articles

You are reading Rabbi Avrohom Sebrow's Daf Yomi articles and finding the **Gemara stories** (aggadah) in each one. Each story becomes its own page on dafyomiinsights.com, so people searching Google or asking an AI about that story find it. Accuracy matters more than quantity: never invent anything.

## Inputs

- `data/articles/*.json`: one article per file: `id`, `masechta`, `daf`, `title`, `summary`, `tags`, `content`. If the folder is empty, say so and stop. (It is filled by `npm run stories:export`.)
- `data/tag-vocabulary.json`: the topic tags already used on the site.
- `data/people-vocabulary.json`: the sages' names already used on the site (exact spellings).
- If arguments were given ($ARGUMENTS), only process article files whose name or masechta matches them.

Skip an article if `data/stories/<same file name>` already exists (also check `data/stories/published/` and `data/stories/needs-review/`), unless the user asked to redo it.

## Output

For each article, write `data/stories/<same file name as the article>` with exactly this shape:

```json
{
  "article_id": "<the article's id, copied exactly>",
  "masechta": "Bava Metzia",
  "daf": 59,
  "article_tags": ["Machlokes", "Truth"],
  "stories": [
    {
      "title": "The Oven of Achnai",
      "slug": "the-oven-of-achnai",
      "summary": "Rabbi Eliezer brings miracle after miracle to prove his ruling on an oven, but the Sages answer that the Torah 'is not in heaven.'",
      "people": ["Rabbi Eliezer", "Rabbi Yehoshua"],
      "tags": ["Machlokes", "Torah Lo Bashamayim"],
      "start_text": "exact first 8-15 words where the article starts telling this story",
      "end_text": "exact last 8-15 words where the article finishes this story"
    }
  ]
}
```

If the article has no Gemara stories, write `"stories": []`. That still counts: it marks the article as done.

## What counts as a story

A story is a **narrative**: something that happened to named people (sages, kings, ordinary people), with events or dialogue. Examples: Hillel and the convert on one foot; Choni HaMe'agel sleeping seventy years; Rabbi Akiva and the fox on the Temple Mount; Nakdimon ben Gurion and the water; Kamtza and Bar Kamtza.

These are **not** stories: a halachic discussion, a list of opinions, a single quoted statement ("Rabbi Yochanan said…"), a parable the article invents, or a story the article mentions in one passing sentence. The article must actually tell the story, normally in at least three sentences.

## Field rules

- **title**: the name people would search for. It must be recognizable, specific and under 60 characters, and must not include the masechta or daf. Good: "Hillel and the Convert on One Foot", "Rabbi Akiva Laughs at the Ruins". Bad: "A Story", "Pesachim 45 Story", "The Rabbi's Lesson".
- **slug**: lowercase words joined by hyphens, from the title.
- **summary**: 1–2 plain-English sentences, about 120–155 characters. Say who is involved and what happens. It is used as the Google description, so make someone want to read it. Paraphrase the article; do not add facts that aren't in it.
- **people**: the named individuals in the story. Use the exact spelling from `data/people-vocabulary.json` when the person is already there. Otherwise follow the site's Ashkenazi-style transliteration: Rabbi Akiva, Rabbi Yochanan, Reish Lakish, Rabban Gamliel, Rabbi Shimon bar Yochai, Choni HaMe'agel, Hillel, Shammai, Moshe Rabbeinu, Dovid HaMelech. Add any new name to `data/people-vocabulary.json`, keeping it sorted. Leave out unnamed people ("a man", "a Sadducee").
- **tags**: 1–4 themes of the story (e.g. Humility, Teshuvah, Prayer, Tzedakah, Kiddush Hashem, Patience, Churban). Reuse tags from `data/tag-vocabulary.json` whenever one fits. If a genuinely new tag is needed, use a short Title Case tag and add it to `data/tag-vocabulary.json`. **Every tag you use must be in that file**, or the draft will be rejected.
- **article_tags**: 0–5 topic tags for the whole article that it doesn't already have, from the same vocabulary. Never repeat the article's existing tags.
- **start_text / end_text**: copy these **character for character** from the article's `content`, including punctuation. Each should be 8–15 words, and long enough that it appears only once in the article. The story's page shows exactly the text from start_text through end_text, so:
  - Start where the article begins telling the story, including a short lead-in sentence if the story doesn't make sense without it.
  - End where the article finishes telling it. Include the article's explanation of the story only if it follows directly and belongs to the story.
  - Stories must not overlap, and must appear in the order they occur in the article.

## How to work

1. List the article files (respecting any filter) and skip the ones already done.
2. Read `data/tag-vocabulary.json` and `data/people-vocabulary.json` once.
3. Work through the articles one at a time: read the article, find its stories, and write its draft file. With more than about 30 articles in an interactive session, you may hand batches of files to subagents. Tell each one to read and follow this file (`.claude/skills/extract-stories/SKILL.md`), and have only one agent at a time edit the vocabulary files.
4. Before writing each draft, double-check that every start_text and end_text appears exactly once in `content`. Use Grep on the article file if unsure.
5. Write only inside `data/`. Never edit `data/articles/`, the code, or anything else.
6. Finish with one line: `Drafted N stories from M articles (K had none).`

Publishing is a separate step (`npm run stories:publish`). It re-checks every draft and cuts the story text out of the article itself.
