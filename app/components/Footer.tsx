import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-800 py-4">
      <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
        <span>&copy; {new Date().getFullYear()} QRTurnover</span>
        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-4">
          <Link href="/blog" className="min-h-11 inline-flex items-center hover:underline">
            Blog
          </Link>
          <Link href="/contact" className="min-h-11 inline-flex items-center hover:underline">
            Contact
          </Link>
          <Link href="/terms" className="min-h-11 inline-flex items-center hover:underline">
            Terms of Use
          </Link>
          <Link href="/privacy" className="min-h-11 inline-flex items-center hover:underline">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
