-- Credit for a free-license photo (Wikimedia Commons, Openverse) shown under the
-- article's picture: { "author", "license", "license_url", "source_url" }.
-- Null for the newspaper's own photos, which need no credit line.
alter table public.articles add column if not exists image_credit jsonb;
