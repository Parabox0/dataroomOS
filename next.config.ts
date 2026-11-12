import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pdfjs-dist", "@napi-rs/canvas"],
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "40mb" } },
};

export default nextConfig;
