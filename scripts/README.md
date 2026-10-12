# Gemara story pipeline

Every Gemara story in an article gets its own page (`/stories/<name>`), so people can find it on Google and AI assistants can cite it. These scripts find the stories in your articles and publish them. Claude Code reads the articles, so you don't need an API key; it uses your Claude Code plan.

## One-time setup

1. **Run the database migration.** In the Supabase dashboard, open SQL Editor, paste in `supabase/migrations/20261011020000_stories.sql`, and click Run.
2. **Create `.env.local`** in the project folder, if you don't have one, with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...            # Supabase → Project Settings → API
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # same page ("anon public")
   SUPABASE_SERVICE_ROLE_KEY=...           # same page ("service_role"); keep it secret
   REVALIDATE_SECRET=<any long random text>
   ```
3. **Add `REVALIDATE_SECRET`** with the same value in Vercel (Project → Settings → Environment Variables), then redeploy. This lets the pipeline refresh the live site the moment stories are published.

## The first big backfill (all existing articles)

```
npm run stories:export -- --all      # 1. copies every article into data/articles/ (read-only)
```
2. In Claude Code, in this project, type **`/extract-stories`**. Claude reads each article and writes a draft per article into `data/stories/`. You can do one masechta at a time, e.g. `/extract-stories Pesachim`.
3. Optionally, skim the drafts in `data/stories/`. They're plain readable files.
```
npm run stories:publish -- --dry-run # 4. checks everything, changes nothing
npm run stories:publish              # 5. publishes
```
Drafts with a problem are not published. They go to `data/stories/needs-review/`, with the reason written inside. Fix them, or delete them and re-run `/extract-stories`, then publish again.

## New articles: automatic

```
npm run stories:schedule
```
That's a one-time step. It creates a Windows task that runs every night at 2am and:
1. finds articles that haven't been processed yet. If there are none, it stops, with no Claude usage;
2. has Claude Code draft their stories;
3. checks every story really comes from the article, word for word, and publishes the good ones;
4. refreshes the live site.

Everything it does is written to `logs/story-pipeline.log`.

- Run it by hand any time: `npm run stories:pipeline`
- From your own import script, add this as the last step: `npm run stories:pipeline`
- Prefer to approve stories yourself? Put `AUTO_PUBLISH=false` in `.env.local`. The pipeline then only drafts, and you run `npm run stories:publish` when ready.
- Change the time: `powershell -ExecutionPolicy Bypass -File scripts\register-schedule.ps1 -Time 4:00am`
- Turn it off: `... register-schedule.ps1 -Remove`

The task only runs while the computer is on. If it was off at 2am, it runs as soon as it's back on.

## Good to know

- **Re-doing an article:** in Supabase, clear the article's `stories_extracted_at` (set it to empty/null). It will be picked up again, and re-publishing replaces its old stories.
- **Story text is never retyped.** Claude only marks the first and last words of each story, and the script cuts the text out of the article. So a story can't contain anything the article doesn't say.
- **Tags and sages' names** stay consistent through `data/tag-vocabulary.json` and `data/people-vocabulary.json`. Claude reuses them and adds new ones when needed.
- You can also add a single story by hand in **/admin → Add Story**.
