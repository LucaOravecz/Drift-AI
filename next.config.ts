import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma must load from node_modules as-is (especially with Turbopack dev).
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
