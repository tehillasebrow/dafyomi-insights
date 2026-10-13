-- Mailing list: subscribers, and one email per new article that the admin
-- approves before it goes out. Written only by the server with the service-role
-- key; RLS is on with no policies, so the public anon key can't read or write it.

create table if not exists public.subscribers (
    id                bigint generated always as identity primary key,
    created_at        timestamptz not null default now(),
    email             text not null unique,          -- stored lowercase
    status            text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
    source            text,                           -- popup, footer, unsubscribe_page
    unsubscribe_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    unsubscribed_at   timestamptz
);

create index if not exists subscribers_status_idx on public.subscribers (status, id);

alter table public.subscribers enable row level security;

-- pending:  preview sent to the admin, waiting for approval
-- approved: approved; sends as soon as it isn't Shabbos/Yom Tov (the hourly job retries)
-- sending:  being sent right now
-- sent / skipped: done
create table if not exists public.newsletter_sends (
    id                 bigint generated always as identity primary key,
    created_at         timestamptz not null default now(),
    status             text not null default 'pending' check (status in ('pending', 'approved', 'sending', 'sent', 'skipped')),
    preview_sent_at    timestamptz,
    reminded_at        timestamptz,
    approved_at        timestamptz,
    sending_started_at timestamptz,
    sent_at            timestamptz,
    last_subscriber_id bigint not null default 0,    -- progress, so a failed send resumes without repeats
    recipient_count    integer not null default 0,
    last_error         text
);

-- article_id must match the type of articles.id, whatever it is (as in the stories migration)
do $$
declare
    id_type text;
begin
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'newsletter_sends' and column_name = 'article_id'
    ) then
        select format_type(a.atttypid, a.atttypmod) into id_type
        from pg_attribute a
        where a.attrelid = 'public.articles'::regclass and a.attname = 'id';
        execute format(
            'alter table public.newsletter_sends add column article_id %s not null unique references public.articles(id) on delete cascade',
            id_type
        );
    end if;
end $$;

create index if not exists newsletter_sends_status_idx on public.newsletter_sends (status, created_at desc);

alter table public.newsletter_sends enable row level security;
