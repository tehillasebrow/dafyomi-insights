# Daf Yomi Insights

**Live site: [dafyomiinsights.com](https://dafyomiinsights.com)**

Daf Yomi articles, Gemara stories and topic guides by Rabbi Avrohom Sebrow, organized by masechta and daf.

🚀 Overview

Daf Yomi is the practice of studying one page of the Talmud every day. [Daf Yomi Insights](https://dafyomiinsights.com) collects more than 450 of Rabbi Sebrow's weekly newspaper columns on the daf. Readers can:

- open [today's daf](https://dafyomiinsights.com/daily)
- browse every [masechta](https://dafyomiinsights.com/masechtos) daf by daf
- explore [topics](https://dafyomiinsights.com/topics), from what the Gemara says about anger to tzedakah
- read the famous Gemara stories inside the articles where they appear

For Recruiters

This project demonstrates proficiency in:

Frameworks: Next.js (App Router) for Server-Side Rendering (SSR) and optimized routing.

Styling: Tailwind CSS for a responsive, mobile-first UI with a focus on readability.

State Management: React hooks and URL-based state for shareable search results.

DevOps: CI/CD integration with Vercel and secure environment variable management.

Security: Implementation of a lightweight, environment-protected Admin Panel for content management.

🛠 Tech Stack

Core: Next.js 16 (App Router), React 19

Language: JavaScript (ES6+)

Styling: Tailwind CSS 4

Database: Supabase (Postgres)

Deployment: Vercel

✨ Key Features

Daily Dashboard: Automatically surfaces the current day's Daf and relevant insights.

Smart Search: Real-time filtering of historical insights to help users find specific topics across the Talmud.

Responsive Design: Optimized for mobile "on-the-go" learning and desktop deep-study sessions.

Admin CMS: A custom-built, password-protected interface for creators to upload and manage content without needing to touch the database directly.

Performance Optimized: Achieves high Core Web Vitals scores through Next.js Image optimization and static generation where applicable.

📂 Project Structure

├── app/               # Next.js App Router (Pages, Layouts, API)
│   ├── admin/         # Protected content management interface
│   ├── insights/      # Dynamic routes for daily content
│   └── layout.js      # Global providers and metadata
├── components/        # Reusable UI components (Buttons, Cards, Search)
├── lib/               # Utility functions and data fetching logic
├── public/            # Static assets (Logos, Favicons)
└── styles/            # Global CSS and Tailwind configurations


⚙️ Installation & Setup (Local Development)

Note: This repository is intended for showcase purposes. 

Clone the repository:

git clone https://github.com/tehillasebrow/dafyomi-insights.git
cd dafyomi-insights


Install dependencies:

npm install


Configure Environment Variables:
Create a .env.local file in the root directory and add the following:

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-only, never prefix with NEXT_PUBLIC_
ADMIN_PASSWORD=your_secure_password               # server-only
ADMIN_SESSION_SECRET=long_random_string           # optional, signs the admin cookie (defaults to ADMIN_PASSWORD)


Apply database migrations (Supabase CLI, or paste into the SQL editor):

supabase db push


Run the development server:

npm run dev


🛑 Contributions

This is a personal project and is not open for public contributions. Pull requests and issues will not be reviewed or merged. I am maintaining this code exclusively for the operation of [DafYomiInsights.com](https://dafyomiinsights.com).
