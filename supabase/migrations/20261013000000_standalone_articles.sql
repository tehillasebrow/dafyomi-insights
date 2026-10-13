-- "Beyond the Daf": articles that aren't about a daf (tributes, Q&As, magazine
-- pieces). Such an article has masechta, daf and daf_end all null and lives at
-- /beyond-the-daf/{slug}. Daf articles are unchanged: they still need both a
-- masechta and a daf. Stories pulled from a standalone article have no
-- masechta/daf either.
--
-- BEFORE RUNNING: check how search_vector is built. If it joins masechta
-- without coalesce(), a null masechta makes the whole search_vector null and
-- standalone articles won't show up in search. Run:
--
--   select column_name, generation_expression
--   from information_schema.columns
--   where table_name = 'articles' and column_name = 'search_vector';
--
--   -- and, if it is filled by a trigger instead of a generated column:
--   select tgname, pg_get_triggerdef(oid)
--   from pg_trigger
--   where tgrelid = 'public.articles'::regclass and not tgisinternal;
--
-- If masechta appears there without coalesce(masechta, ''), that expression
-- needs rewriting with coalesce before standalone articles are added.

alter table public.articles alter column masechta drop not null;
alter table public.articles alter column daf drop not null;

-- Either a standalone article (no place at all) or a daf article (masechta and daf)
alter table public.articles
    drop constraint if exists articles_place_check;
alter table public.articles
    add constraint articles_place_check
    check ((masechta is null and daf is null and daf_end is null)
        or (masechta is not null and daf is not null));

-- Standalone article slugs are unique among themselves (daf article slugs are
-- only unique within their daf)
create unique index if not exists articles_standalone_slug_key
    on public.articles (slug) where masechta is null;

-- Keeps the earlier values and adds Mishpacha
alter table public.articles
    drop constraint if exists articles_source_check;
alter table public.articles
    add constraint articles_source_check
    check (source in ('5tjt', 'jewishhome', 'mishpacha', 'manual'));

-- Stories: masechta and daf are both set or both null
alter table public.stories alter column masechta drop not null;
alter table public.stories alter column daf drop not null;

alter table public.stories
    drop constraint if exists stories_place_check;
alter table public.stories
    add constraint stories_place_check
    check ((masechta is null) = (daf is null));
