import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/seed": ["./prisma/seed/passages/**/*"],
  },
};

export default nextConfig;
