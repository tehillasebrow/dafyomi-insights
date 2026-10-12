# To-do

- [ ] **Mailing list for new Daf Yomi articles**
  - Add a sign-up form on the website so visitors can subscribe with their email.
  - When a new Daf Yomi article is published, offer the option to email it to subscribers.

- [ ] **Better search bar**
  - Make search easy to find on every screen, including a full-width search on phones.
  - Search by masechta and daf (e.g. "Bechoros 23" or "בכורות כג"), and by title, summary, topic and article text.
  - Show results as you type, with the matching words highlighted and the masechta/daf on each result.
  - Keyboard support: open with `/`, arrow through results, Enter to open, Escape to close.
  - A full results page (`/search?q=…`) for when the dropdown isn't enough, filterable by masechta and topic.
  - Handle spelling variants (Shabbos/Shabbat, Kesubos/Ketubot, Bava Basra/Bava Batra).

- [ ] **AI in search (maybe)**
  - Search by meaning, not just exact words, e.g. "is a doubtful firstborn exempt?" finds the right article even if it uses different words. Could use embeddings stored in Supabase (pgvector).
  - Optional "Ask" mode: answer a question in a few sentences using only Rabbi Sebrow's articles, always linking to the articles it drew on, and saying so plainly when the articles don't cover it.
  - Decide on cost limits and rate limiting before turning it on for everyone.
