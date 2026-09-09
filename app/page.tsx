import Link from "next/link";
import AuthModalProvider from "./components/AuthModal";
import AuthTriggerButton from "./components/AuthTriggerButton";

export default function Home() {
  return (
    <AuthModalProvider>
    <main>
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" aria-label="QRTurnover home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-logo-dark.png" alt="QRTurnover" className="w-44 h-11 object-contain object-left" />
        </Link>
        <nav className="flex items-center gap-4 text-sm" aria-label="Main navigation">
          <a href="#how-it-works" className="hidden sm:inline text-muted hover:underline">How it works</a>
          <a href="#pricing" className="hidden sm:inline text-muted hover:underline">Pricing</a>
          <AuthTriggerButton mode="login" className="border rounded-lg px-4 py-2">Log in</AuthTriggerButton>
          <AuthTriggerButton mode="signup" className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-4 py-2 font-medium transition-colors">
            Start free trial
          </AuthTriggerButton>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm font-medium text-emerald-700 mb-4">Cleaning verification for short-term rentals</p>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
            Know your rental is ready before the next guest arrives.
          </h1>
          <p className="text-muted mt-6 text-lg max-w-xl">
            Place a QR code in every room. Your cleaner scans, completes the checklist,
            and uploads photos. You follow the turnover live—without repeated calls or texts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <AuthTriggerButton mode="signup" className="bg-black text-white rounded-lg px-6 py-3 font-medium">
              Start free 14-day trial
            </AuthTriggerButton>
            <a href="#how-it-works" className="border rounded-lg px-6 py-3 font-medium">See how it works</a>
          </div>
          <p className="text-sm text-muted mt-4">No credit card required. Set up your first property in minutes.</p>
        </div>

        <div className="rounded-2xl border bg-gray-50 text-gray-900 p-5 shadow-sm" aria-label="Example live turnover status">
          <div className="flex items-center justify-between border-b pb-4">
            <div><p className="font-semibold">Lake House</p><p className="text-xs text-gray-500">Turnover in progress</p></div>
            <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-3 py-1">Live</span>
          </div>
          <div className="mt-4 space-y-3">
            {[['Bathroom', '8/8 items', true], ['Kitchen', '7/7 items', true], ['Bedroom', '3/5 items', false], ['Living room', 'Pending', false]].map(([name, status, done]) => (
              <div key={String(name)} className="bg-white border rounded-xl p-4 flex items-center justify-between">
                <div><p className="font-medium">{name}</p><p className="text-xs text-gray-500">{status}</p></div>
                <span className={`text-xs rounded-full px-3 py-1 ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                  {done ? 'Verified' : 'In progress'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y bg-gray-50 text-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-sm font-medium text-emerald-700">How it works</p>
          <h2 className="text-3xl font-bold mt-2">Simple for hosts. Even simpler for cleaners.</h2>
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {[
              ['1', 'Set up each zone', 'Create room checklists and print the unique QR codes for your property.'],
              ['2', 'Cleaner scans and completes', 'No app download or cleaner password—just scan, check tasks, and add proof photos.'],
              ['3', 'Watch progress live', 'See completed zones, timestamps, cleaner activity, and photos from anywhere.'],
            ].map(([number, title, body]) => (
              <div key={number} className="bg-white border rounded-xl p-6">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-black text-white text-sm">{number}</span>
                <h3 className="font-semibold text-lg mt-5">{title}</h3>
                <p className="text-gray-600 mt-2 text-sm leading-6">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center">Everything you need for a reliable turnover</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
          {[
            ['Room-by-room checklists', 'Create detailed tasks for kitchens, bathrooms, bedrooms, and more.'],
            ['Photo proof', 'Require photos in important zones before they can be marked complete.'],
            ['Live status', 'Know what is finished, what is pending, and who completed each zone.'],
            ['Turnover history', 'Review past cleanings, checklist completion, timing, and submitted photos.'],
          ].map(([title, body]) => (
            <div key={title} className="border rounded-xl p-5">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted text-sm mt-2 leading-6">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="border rounded-2xl p-8 sm:p-10">
          <p className="text-sm font-medium text-emerald-700">Simple pricing</p>
          <h2 className="text-3xl font-bold mt-2">$19 per month</h2>
          <p className="text-muted mt-3">Unlimited properties, zones, cleaners, QR codes, and turnover history.</p>
          <AuthTriggerButton mode="signup" className="inline-block bg-black text-white rounded-lg px-6 py-3 font-medium mt-6">
            Start free for 14 days
          </AuthTriggerButton>
          <p className="text-xs text-muted mt-3">No credit card required to start.</p>
        </div>
      </section>
    </main>
    </AuthModalProvider>
  );
}
