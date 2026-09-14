import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "@neondatabase/serverless", "resend", "react-email"],
};

export default nextConfig;
