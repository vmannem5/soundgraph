import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soundgraph/database"],
  async redirects() {
    return [
      {
        source: '/specimen/:mbid',
        destination: '/artist/:mbid',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
