import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/common/logo'

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line px-6 py-4">
        <Link to="/">
          <Wordmark />
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-lg font-semibold text-ink">Privacy Policy</h1>
        <p className="mt-1 text-sm text-ink-muted">Last updated: September 2026</p>

        <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-ink-muted">
          <section>
            <h2 className="text-base font-semibold text-ink">1. Information we collect</h2>
            <p className="mt-2">
              SkyShield collects information you provide when creating an account, reporting
              incidents, and using the platform. This includes your name, email address, and any
              safety reports you submit.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink">2. How we use your information</h2>
            <p className="mt-2">
              We use your information to provide and improve the platform, communicate with you
              about your account, and ensure the safety and security of our services.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink">3. Data retention</h2>
            <p className="mt-2">
              We retain your data for as long as your account is active or as needed to provide
              services. You can request deletion of your data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink">4. Your rights</h2>
            <p className="mt-2">
              You have the right to access, correct, or delete your personal data. You can export
              your data at any time from the Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink">5. Contact</h2>
            <p className="mt-2">
              For privacy-related inquiries, contact us at privacy@skyshield.aero.
            </p>
          </section>
        </div>

        <div className="mt-8 rounded-md border border-warn/30 bg-warn-wash px-4 py-3 text-sm text-warn-ink">
          This is a template privacy policy. Review with counsel before launch.
        </div>
      </main>
    </div>
  )
}