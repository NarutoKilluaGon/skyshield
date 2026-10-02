import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/common/logo'

export default function TermsPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line px-6 py-4">
        <Link to="/">
          <Wordmark />
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-lg font-semibold text-ink">Terms of Service</h1>
        <p className="mt-1 text-sm text-ink-muted">Last updated: September 2026</p>

        <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-ink-muted">
          <section>
            <h2 className="text-base font-semibold text-ink">1. Acceptance of terms</h2>
            <p className="mt-2">
              By accessing or using SkyShield, you agree to be bound by these terms. If you do not
              agree, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink">2. Use of the platform</h2>
            <p className="mt-2">
              You may use SkyShield for lawful purposes only. You are responsible for the accuracy
              and completeness of the information you submit.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink">3. Intellectual property</h2>
            <p className="mt-2">
              The platform, including its design, code, and content, is owned by SkyShield and
              protected by intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink">4. Limitation of liability</h2>
            <p className="mt-2">
              SkyShield is provided &quot;as is&quot; without warranties of any kind. We are not liable
              for any indirect, incidental, or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink">5. Changes to terms</h2>
            <p className="mt-2">
              We may update these terms from time to time. Continued use of the platform after
              changes constitutes acceptance of the new terms.
            </p>
          </section>
        </div>

        <div className="mt-8 rounded-md border border-warn/30 bg-warn-wash px-4 py-3 text-sm text-warn-ink">
          This is a template terms of service. Review with counsel before launch.
        </div>
      </main>
    </div>
  )
}