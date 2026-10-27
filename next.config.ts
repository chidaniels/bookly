import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so stray lockfiles in parent folders don't confuse output tracing.
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
};

export default nextConfig;
