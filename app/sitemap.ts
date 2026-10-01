import type { MetadataRoute } from "next";

const baseUrl = "https://www.qrturnover.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/blog`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/blog/airbnb-turnover-checklist`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/contact`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
