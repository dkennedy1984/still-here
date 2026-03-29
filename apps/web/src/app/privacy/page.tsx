import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy — Sit With You',
  description: 'How Sit With You handles your data and privacy.',
  alternates: { canonical: 'https://sitwithyou.app/privacy' },
};

export default function PrivacyPage() {
  return (
    <ContentLayout>
      <h1 className="text-2xl font-semibold text-white mb-8">Privacy Policy</h1>
      
      <p className="text-slate-300 text-sm leading-relaxed mb-6">Last updated: March 2026</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">What we collect</h2>
      <p className="text-slate-300 leading-relaxed mb-4">We collect as little as possible:</p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>An anonymous session identifier (stored in a cookie)</li>
        <li>Your email address (only if you subscribe)</li>
        <li>Call duration (how long each session lasts)</li>
        <li>Payment information (handled entirely by Stripe — we never see your card details)</li>
      </ul>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">What we don't collect</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>We do not record or store audio from your calls</li>
        <li>We do not store transcripts of what you say (unless you explicitly opt in)</li>
        <li>We do not track your browsing behaviour across other sites</li>
        <li>We do not sell or share your data with third parties</li>
        <li>We do not use invasive analytics or tracking pixels</li>
      </ul>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">Cookies</h2>
      <p className="text-slate-300 leading-relaxed mb-6">We use a single essential cookie to identify your session. No marketing cookies, no tracking cookies, no cookie consent banner needed.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">Third-party services</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong>Deepgram</strong> — processes your voice in real-time during calls. Audio is not stored.</li>
        <li><strong>ElevenLabs</strong> — generates the companion voice. No user data is stored.</li>
        <li><strong>OpenAI</strong> — generates the companion responses. No user data is retained.</li>
        <li><strong>Stripe</strong> — handles payment processing. See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline underline-offset-2">Stripe&apos;s privacy policy</a>.</li>
        <li><strong>Resend</strong> — sends transactional emails. See <a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline underline-offset-2">Resend&apos;s privacy policy</a>.</li>
      </ul>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">Your rights</h2>
      <p className="text-slate-300 leading-relaxed mb-6">You can request deletion of your data at any time by emailing <a href="mailto:support@sitwithyou.app" className="text-white/70 hover:text-white underline underline-offset-2">support@sitwithyou.app</a>. Under UK GDPR, you have the right to access, correct, or delete your personal data.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">Contact</h2>
      <p className="text-slate-300 leading-relaxed mb-6">For privacy questions, email <a href="mailto:support@sitwithyou.app" className="text-white/70 hover:text-white underline underline-offset-2">support@sitwithyou.app</a>.</p>
    </ContentLayout>
  );
}
