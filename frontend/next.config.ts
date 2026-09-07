import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve large enough variants for full-bleed heroes on retina displays
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    qualities: [75, 90, 95, 100],
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/workbench",
        permanent: true,
      },
      {
        source: "/admin/:path*",
        destination: "/workbench/:path*",
        permanent: true,
      },
      {
        source: "/workbench/my-pay",
        destination: "/workbench/mypay",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
