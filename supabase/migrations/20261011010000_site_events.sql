-- Site events: visitor analytics (page views, searches) and an audit log of
-- comments and admin actions. Written only by the server with the service-role
-- key; RLS is on with no policies, so the public anon key can't read or write it.

create table if not exists public.site_events (
    id          bigint generated always as identity primary key,
    created_at  timestamptz not null default now(),
    type        text not null,      -- page_view, search, search_click, comment, comment_deleted,
                                    -- article_created, daily_created, admin_login, admin_login_failed, admin_logout
    visitor_id  text,               -- anonymous id from the "vid" cookie
    is_admin    boolean not null default false,
    path        text,
    query       text,               -- search text
    referrer    text,               -- external referrer only (first page of a visit)
    ip          text,
    country     text,
    region      text,
    city        text,
    user_agent  text,
    details     jsonb
);

create index if not exists site_events_created_at_idx on public.site_events (created_at desc);
create index if not exists site_events_type_created_at_idx on public.site_events (type, created_at desc);
create index if not exists site_events_visitor_idx on public.site_events (visitor_id, created_at desc);

alter table public.site_events enable row level security;

-- Aggregates for the admin Visitors tab. Admin traffic is excluded.
create or replace function public.site_stats(since timestamptz)
returns jsonb
language sql
stable
as $$
    with ev as (
        select * from public.site_events
        where created_at >= since and not is_admin
    ),
    views as (select * from ev where type = 'page_view')
    select jsonb_build_object(
        'page_views', (select count(*) from views),
        'visitors',   (select count(distinct visitor_id) from views),
        'searches',   (select count(*) from ev where type = 'search'),
        'comments',   (select count(*) from ev where type = 'comment'),
        'top_pages', (select coalesce(jsonb_agg(t), '[]') from (
            select path as label, count(*) as count, count(distinct visitor_id) as visitors
            from views group by path order by count desc limit 20) t),
        'top_searches', (select coalesce(jsonb_agg(t), '[]') from (
            select lower(query) as label, count(*) as count, count(distinct visitor_id) as visitors
            from ev where type = 'search' group by lower(query) order by count desc limit 20) t),
        'top_referrers', (select coalesce(jsonb_agg(t), '[]') from (
            select split_part(referrer, '/', 3) as label, count(*) as count, count(distinct visitor_id) as visitors
            from views where referrer is not null group by 1 order by count desc limit 15) t),
        'top_countries', (select coalesce(jsonb_agg(t), '[]') from (
            select coalesce(country, 'Unknown') as label, count(*) as count, count(distinct visitor_id) as visitors
            from views group by 1 order by count desc limit 15) t),
        'by_day', (select coalesce(jsonb_agg(t order by t.day), '[]') from (
            select date_trunc('day', created_at)::date as day, count(*) as count, count(distinct visitor_id) as visitors
            from views group by 1) t)
    )
$$;

revoke execute on function public.site_stats(timestamptz) from public, anon, authenticated;
