import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.87"],
};

export default withSentryConfig(nextConfig, {
  org: "qrturnover",
  project: "qrturnover",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
