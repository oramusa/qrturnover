import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.87"],
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/(account|auth|cleaners|dashboard|forgot-password|history|login|properties|reset-password|scan|signup)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "qrturnover",
  project: "qrturnover",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
