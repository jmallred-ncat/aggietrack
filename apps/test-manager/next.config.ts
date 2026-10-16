import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@aggietrack/ui"],
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "@prisma/client", "resend", "react-email"],
  outputFileTracingIncludes: { "/*": ["./prisma/test-manager.db"] },
};
export default config;
