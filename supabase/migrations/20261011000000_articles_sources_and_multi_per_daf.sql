-- Articles: track where each article came from, its original publish date,
-- and optional multi-daf coverage. Also prepares for more than one article per daf.

alter table public.articles
    add column if not exists source       text        not null default 'manual',
    add column if not exists source_url   text,
    add column if not exists published_at timestamptz,
    add column if not exists daf_end      integer;

alter table public.articles
    drop constraint if exists articles_source_check;
alter table public.articles
    add constraint articles_source_check
    check (source in ('5tjt', 'jewishhome', 'manual'));

-- Unique, but NULLs are allowed (manual articles have no source_url).
alter table public.articles
    drop constraint if exists articles_source_url_key;
alter table public.articles
    add constraint articles_source_url_key unique (source_url);

alter table public.articles
    drop constraint if exists articles_daf_end_check;
alter table public.articles
    add constraint articles_daf_end_check
    check (daf_end is null or daf_end >= daf);

-- Existing rows were published when they were created. Backfilling keeps
-- "order by published_at" correct for old and new rows alike; the app still
-- falls back to created_at if published_at is ever null.
update public.articles
set published_at = created_at
where published_at is null;

-- Lookups by daf (/daf/{masechta}/{daf}) and by slug within a daf.
create index if not exists articles_masechta_daf_idx
    on public.articles (lower(masechta), daf);

create index if not exists articles_masechta_slug_idx
    on public.articles (lower(masechta), slug);

create index if not exists articles_published_at_idx
    on public.articles (published_at desc nulls last, created_at desc);
