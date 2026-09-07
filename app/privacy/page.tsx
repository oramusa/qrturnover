import Link from "next/link";
import PublicNav from "@/app/components/PublicNav";

export const metadata = { title: "Privacy Policy — QRTurnover" };

export default function PrivacyPage() {
  return (
    <>
    <PublicNav />
    <div className="max-w-2xl mx-auto p-6 py-12">
      <Link href="/" className="text-sm text-muted underline">
        &larr; Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-1">Privacy Policy</h1>
      <p className="text-sm text-muted mb-8">Last updated: September 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-medium mb-2">1. Overview</h2>
          <p>
            QRTurnover (&quot;we&quot;, &quot;us&quot;) provides a cleaning-verification tool for
            short-term-rental hosts. This policy explains what information we collect when you use
            the service, how we use it, and the choices you have.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">2. Information we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="font-medium">Account information:</span> your email address and
              password (stored securely, hashed, by our authentication provider).
            </li>
            <li>
              <span className="font-medium">Property and zone data:</span> property names,
              addresses, cleaning checklists, and the QR zones you configure.
            </li>
            <li>
              <span className="font-medium">Scan and photo data:</span> when a cleaner scans a QR
              code, we record the time, the checklist items completed, and any photos they upload as
              proof of cleaning.
            </li>
            <li>
              <span className="font-medium">Mailing address:</span> if you provide one, so we can
              ship printed QR code sets to you.
            </li>
            <li>
              <span className="font-medium">Payment information:</span> subscription billing is
              handled entirely by Stripe. We never see or store your full card number — Stripe
              provides us only your card&apos;s brand, last 4 digits, and billing status.
            </li>
            <li>
              <span className="font-medium">Cleaner contact info:</span> if you add a cleaner to
              your roster, we store the name and contact details you provide for them.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium mb-2">3. How we use this information</h2>
          <p>We use the information above to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Operate the core service — tracking turnovers, zones, and cleaning proof.</li>
            <li>Send transactional emails (scan links, notifications, billing receipts).</li>
            <li>Process subscription payments through Stripe.</li>
            <li>Improve and troubleshoot the product.</li>
          </ul>
          <p className="mt-2">We do not sell your personal information to third parties.</p>
        </section>

        <section>
          <h2 className="font-medium mb-2">4. Third-party services</h2>
          <p>We rely on the following providers to run QRTurnover, each bound by their own privacy terms:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>
              <span className="font-medium">Supabase</span> — database, authentication, and file
              storage (photos).
            </li>
            <li>
              <span className="font-medium">Stripe</span> — subscription billing and payment
              processing.
            </li>
            <li>
              <span className="font-medium">Resend</span> — transactional email delivery.
            </li>
            <li>
              <span className="font-medium">Vercel</span> — application hosting.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium mb-2">5. Data retention</h2>
          <p>
            We retain your account and turnover data for as long as your account is active. If you
            delete a property or turnover record, it is removed from our active database. You can
            request full account deletion at any time by contacting us (below).
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">6. Your choices</h2>
          <p>
            You can access, update, or delete most of your data directly from the app (Account
            page, property settings). For anything you can&apos;t change yourself — including full
            account deletion — email us and we&apos;ll handle it promptly.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">7. Cookies</h2>
          <p>
            We use a minimal set of cookies required to keep you signed in and to remember your
            session. We do not use third-party advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">8. Children&apos;s privacy</h2>
          <p>QRTurnover is a business tool and is not directed at, or intended for use by, children.</p>
        </section>

        <section>
          <h2 className="font-medium mb-2">9. Changes to this policy</h2>
          <p>
            We may update this policy as the product evolves. We&apos;ll update the &quot;Last
            updated&quot; date above when we do.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">10. Contact</h2>
          <p>
            Questions about this policy or your data? Email{" "}
            <a href="mailto:admin@qrturnover.com" className="underline">
              admin@qrturnover.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
    </>
  );
}
