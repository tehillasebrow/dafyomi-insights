import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel's free plan caps image resizing; past the cap it answers 402 and
    // pictures break. Originals are small (median ~120KB), so serve them as-is.
    unoptimized: true,
    // Article images uploaded through the admin live in Supabase storage.
    // Images from other hosts are rendered unoptimized (see components/ArticleImage.js).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  experimental: {
    serverActions: {
      // Article images are uploaded through a server action (default limit is 1MB)
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
