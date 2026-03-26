import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@still-here/shared"],
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
