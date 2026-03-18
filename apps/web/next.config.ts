import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@aiacp/shared-types"],
  serverExternalPackages: ["@prisma/client", "prisma"]
};

export default nextConfig;
