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
        <li>Your email address (if you register for a free account or subscribe)</li>
        <li>Call duration (how long each session lasts)</li>
        <li>Payment information (handled entirely by Stripe — we never see your card details)</li>
      </ul>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">What we don&apos;t collect</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>We do not record or store audio from your calls</li>
        <li>We do not store transcripts of what you say (unless you explicitly opt in)</li>
        <li>We do not track your browsing behaviour across other sites</li>
        <li>We do not sell or share your data with third parties</li>
        <li>We do not use invasive analytics or tracking pixels</li>
      </ul>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">Cookies and local storage</h2>
      <p className="text-slate-300 leading-relaxed mb-4">We use a single essential cookie to identify your session anonymously. We do not use advertising cookies or third-party tracking cookies. Some preferences (such as your presence style) may be stored in your browser&apos;s local storage.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">Third-party services</h2>
      <p className="text-slate-300 leading-relaxed mb-4">We use a small number of third-party services to run Sit With You. Your data is processed only as needed to provide the service, and none of these providers store your personal data beyond what&apos;s required for their function.</p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>
          <strong>Deepgram</strong> — processes voice audio during calls in real time. Audio is not stored after processing. <a href="https://deepgram.com/privacy" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline underline-offset-2">Privacy policy</a>
        </li>
        <li>
          <strong>ElevenLabs</strong> — generates the companion voice. No user data is retained. <a href="https://elevenlabs.io/privacy" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline underline-offset-2">Privacy policy</a>
        </li>
        <li>
          <strong>OpenAI</strong> — powers the companion responses. No user data is retained. <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline underline-offset-2">Privacy policy</a>
        </li>
        <li>
          <strong>Stripe</strong> — handles payments. We never see or store your card details. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline underline-offset-2">Privacy policy</a>
        </li>
        <li>
          <strong>Resend</strong> — sends transactional emails (welcome, subscription changes). <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline underline-offset-2">Privacy policy</a>
        </li>
      </ul>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">Your rights</h2>
      <p className="text-slate-300 leading-relaxed mb-4">You have the right to access, correct, or delete the personal data we hold about you. To do so, contact us at the address below. We will respond to any data request within 30 days, as required by UK GDPR.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">Contact</h2>
      <p className="text-slate-300 leading-relaxed mb-4">For any privacy questions, email us at <a href="mailto:hello@sitwithyou.app" className="text-white/70 hover:text-white underline underline-offset-2">hello@sitwithyou.app</a>.</p>
    </ContentLayout>
  );
}
