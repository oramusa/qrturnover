import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account/",
        "/api/",
        "/auth/",
        "/cleaners/",
        "/dashboard/",
        "/forgot-password",
        "/history/",
        "/login",
        "/properties/",
        "/reset-password",
        "/scan/",
        "/signup",
      ],
    },
    sitemap: "https://www.qrturnover.com/sitemap.xml",
    host: "https://www.qrturnover.com",
  };
}
