import Link from "next/link";

export const metadata = { title: "Blog — QRTurnover" };

const POSTS = [
  {
    slug: "airbnb-turnover-checklist",
    title: "Airbnb Turnover Checklist: How to Systemize Your Cleaning Process",
  },
];

export default function BlogIndexPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 py-12">
      <Link href="/" className="text-sm text-muted underline">
        &larr; Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-8">Blog</h1>

      <ul className="space-y-4">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="text-lg underline hover:no-underline">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
