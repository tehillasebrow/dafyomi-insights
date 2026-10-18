-- SEO (2026-10-18): a Google-only description per article, and which amud (a/b)
-- the article is on, so labels can read "Eruvin 65b".
-- seo_description: shown only in search results; the site keeps showing the article's opening.
-- amud / amud_end: 'a', 'b' or null (unknown, or the article covers both sides).
alter table articles add column if not exists seo_description text;
alter table articles add column if not exists amud text check (amud in ('a', 'b'));
alter table articles add column if not exists amud_end text check (amud_end in ('a', 'b'));
