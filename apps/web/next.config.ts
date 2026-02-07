import type { NextConfig } from "next";

const API_URL = process.env.API_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: "/api/projects/:path*",
      destination: `${API_URL}/api/projects/:path*`,
    },
    {
      source: "/api/projects",
      destination: `${API_URL}/api/projects`,
    },
    {
      source: "/api/user/:path*",
      destination: `${API_URL}/api/user/:path*`,
    },
    {
      source: "/api/security/:path*",
      destination: `${API_URL}/api/security/:path*`,
    },
    {
      source: "/sandbox/:path*",
      destination: `${API_URL}/sandbox/:path*`,
    },
    {
      source: "/health",
      destination: `${API_URL}/health`,
    },
  ],
};

export default nextConfig;
