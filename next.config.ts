import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "@neondatabase/serverless", "resend", "react-email"],
  async redirects() {
    return [
      { source: "/dashboard", destination: "/student", permanent: false },
      { source: "/dashboard/account", destination: "/account", permanent: false },
      { source: "/dashboard/account/:path*", destination: "/account/:path*", permanent: false },
      { source: "/dashboard/:path*", destination: "/student/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
