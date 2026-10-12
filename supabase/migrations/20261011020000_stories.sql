-- Stories: individual Gemara stories pulled out of articles, each with its own
-- page (/stories/{slug}) so it can rank and be cited on its own.
-- Written only by the server / scripts with the service-role key; the public
-- anon key can read them.

create table if not exists public.stories (
    id            uuid primary key default gen_random_uuid(),
    slug          text not null unique,
    masechta      text not null,
    daf           integer not null,
    title         text not null,
    summary       text not null,
    content       text not null,
    people        text[] not null default '{}',   -- sages in the story, e.g. {'Rabbi Akiva'}
    tags          text[] not null default '{}',
    position      integer not null default 0,     -- order within its article
    start_offset  integer,                        -- where the story sits in articles.content
    end_offset    integer,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- article_id must match the type of articles.id, whatever it is
do $$
declare id_type text;
begin
    select format_type(atttypid, atttypmod) into id_type
    from pg_attribute
    where attrelid = 'public.articles'::regclass and attname = 'id';

    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'stories' and column_name = 'article_id'
    ) then
        execute format(
            'alter table public.stories add column article_id %s references public.articles(id) on delete cascade',
            id_type
        );
    end if;
end $$;

-- Set by scripts/backfill-stories.mjs once an article has been split into
-- stories (even if it had none), so the nightly pipeline skips it next time.
-- Set it back to null to have an article re-processed.
alter table public.articles
    add column if not exists stories_extracted_at timestamptz;

create index if not exists stories_article_idx on public.stories (article_id, position);
create index if not exists stories_masechta_daf_idx on public.stories (lower(masechta), daf);
create index if not exists stories_people_idx on public.stories using gin (people);
create index if not exists stories_tags_idx on public.stories using gin (tags);
create index if not exists stories_updated_at_idx on public.stories (updated_at desc);

create or replace function public.stories_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end $$;

drop trigger if exists stories_touch_updated_at on public.stories;
create trigger stories_touch_updated_at
    before update on public.stories
    for each row execute function public.stories_touch_updated_at();

alter table public.stories enable row level security;

drop policy if exists "Stories are public" on public.stories;
create policy "Stories are public"
    on public.stories for select
    using (true);
