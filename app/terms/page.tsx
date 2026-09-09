import Link from "next/link";
import PublicNav from "@/app/components/PublicNav";

export const metadata = { title: "Terms of Use — QRTurnover" };

export default function TermsPage() {
  return (
    <>
    <PublicNav />
    <div className="max-w-2xl mx-auto p-6 py-12">
      <Link href="/" className="text-sm text-muted underline">
        &larr; Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-1">Terms of Use</h1>
      <p className="text-sm text-muted mb-8">Last updated: September 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-medium mb-2">1. Acceptance of terms</h2>
          <p>
            By creating an account or using QRTurnover (&quot;the Service&quot;), you agree to
            these Terms of Use. If you don&apos;t agree, please don&apos;t use the Service.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">2. What QRTurnover does</h2>
          <p>
            QRTurnover lets short-term-rental hosts generate QR codes for each zone of a property,
            track when a cleaner scans each zone, collect photo proof,
            and review turnover history. It is a verification and record-keeping tool, not a
            cleaning service itself.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">3. Your account</h2>
          <p>
            You&apos;re responsible for the accuracy of the information you provide and for keeping
            your login credentials secure. You&apos;re responsible for activity that happens under
            your account.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">4. Cleaners and third parties</h2>
          <p>
            If you invite a cleaner or other third party to use the scan links or QR codes tied to
            your account, you&apos;re responsible for obtaining any consent needed from them (e.g.
            to store their name, scan timestamps, or photos they submit) and for how you use their
            information.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">5. Subscriptions and billing</h2>
          <p>
            Paid plans are billed on a recurring basis through Stripe. By subscribing, you authorize
            us to charge your payment method until you cancel. You can cancel anytime from your
            Account page — cancellation stops future billing but doesn&apos;t refund the current
            billing period unless required by law.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">6. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Use the Service for anything unlawful or to violate anyone else&apos;s rights.</li>
            <li>Attempt to disrupt, reverse-engineer, or gain unauthorized access to the Service.</li>
            <li>Upload content you don&apos;t have the right to upload.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium mb-2">7. Availability and changes</h2>
          <p>
            We aim to keep the Service reliable but don&apos;t guarantee it will be uninterrupted or
            error-free. We may update, change, or discontinue features over time.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">8. Termination</h2>
          <p>
            You can stop using the Service and delete your account at any time. We may suspend or
            terminate accounts that violate these terms.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">9. Disclaimer and limitation of liability</h2>
          <p>
            The Service is provided &quot;as is&quot;, without warranties of any kind. To the
            fullest extent permitted by law, QRTurnover is not liable for indirect, incidental, or
            consequential damages arising from your use of the Service, including reliance on scan
            records or photo proof for property-management decisions.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">10. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. We&apos;ll update the &quot;Last
            updated&quot; date above when we do. Continued use of the Service after a change means
            you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="font-medium mb-2">11. Contact</h2>
          <p>
            Questions about these terms? Email{" "}
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
