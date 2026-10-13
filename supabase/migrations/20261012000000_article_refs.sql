-- An article can be about more than one daf, or more than one masechta.
-- articles.masechta/daf stays the article's main place (its URL); refs lists the
-- other places it substantially discusses, e.g.
--   [{"masechta": "Bava Basra", "daf": 12}, {"masechta": "Pesachim", "daf": 61}]
-- Masechta names are spelled as in app/lib/shas.js. The article is then listed on
-- those masechta and daf pages too.

alter table public.articles
    add column if not exists refs jsonb not null default '[]'::jsonb;

alter table public.articles
    drop constraint if exists articles_refs_is_array;
alter table public.articles
    add constraint articles_refs_is_array check (jsonb_typeof(refs) = 'array');

-- Fast "which articles mention Bava Basra 12" lookups (refs @> '[{"masechta":"Bava Basra","daf":12}]')
create index if not exists articles_refs_idx on public.articles using gin (refs jsonb_path_ops);
