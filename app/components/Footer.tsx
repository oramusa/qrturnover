import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-800 py-4">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-xs text-muted">
        <span>&copy; {new Date().getFullYear()} QRTurnover</span>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:underline">
            Terms of Use
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
