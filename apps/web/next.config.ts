import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soundgraph/database"],
};

export default nextConfig;
