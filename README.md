Daf Yomi Insights

DafYomiInsights.com

A modern, high-performance web application designed to provide daily insights, summaries, and educational resources for the global Daf Yomi community. Built with a focus on speed, accessibility, and clean typography to facilitate focused study.

🚀 Overview

Daf Yomi is the practice of studying one page of the Talmud every day. This platform serves as a digital companion to that journey, offering a streamlined interface for students to access daily content, search through archives, and stay on track with the global cycle.

For Recruiters

This project demonstrates proficiency in:

Frameworks: Next.js (App Router) for Server-Side Rendering (SSR) and optimized routing.

Styling: Tailwind CSS for a responsive, mobile-first UI with a focus on readability.

State Management: React hooks and URL-based state for shareable search results.

DevOps: CI/CD integration with Vercel and secure environment variable management.

Security: Implementation of a lightweight, environment-protected Admin Panel for content management.

🛠 Tech Stack

Core: Next.js 14+ (App Router)

Language: JavaScript (ES6+)

Styling: Tailwind CSS

Deployment: Vercel

Icons: Lucide React / Heroicons

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

git clone [https://github.com/your-username/dafyomi-insights.git](https://github.com/your-username/dafyomi-insights.git)
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

This is a personal project and is not open for public contributions. Pull requests and issues will not be reviewed or merged. I am maintaining this code exclusively for the operation of DafYomiInsights.com.
