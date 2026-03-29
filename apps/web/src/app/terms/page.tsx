import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';

export const metadata: Metadata = {
  title: 'Terms of Service — Sit With You',
  description: 'Terms of service for using Sit With You.',
  alternates: { canonical: 'https://sitwithyou.app/terms' },
};

export default function TermsPage() {
  return (
    <ContentLayout>
      <h1 className="text-2xl font-semibold text-white mb-8">Terms of Service</h1>
      
      <p className="text-slate-300 text-sm leading-relaxed mb-6">Last updated: March 2026</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">1. What Sit With You is</h2>
      <p className="text-slate-300 leading-relaxed mb-6">Sit With You is a calm body-doubling companion service. It provides quiet audio presence to help you begin tasks. It is not a medical service, therapy, or crisis helpline.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">2. Using the service</h2>
      <p className="text-slate-300 leading-relaxed mb-6">You may use Sit With You for personal, non-commercial purposes. You must not use the service to harass, abuse, or harm others. We reserve the right to end a call if abusive language is detected.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">3. Free and paid tiers</h2>
      <p className="text-slate-300 leading-relaxed mb-4">Free users may use the service with the following limits:</p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
        <li>Sessions are limited to 10 minutes each</li>
        <li>The &quot;Quiet&quot; presence style is available</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-6">Paid subscribers (£8 per month) get:</p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Unlimited calls, up to 60 minutes each</li>
        <li>All presence styles (Quiet, Check-ins, Talk)</li>
        <li>Choice of voice</li>
        <li>Gentle support if you ask for it</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-6">Subscriptions are billed monthly through Stripe at the price shown at checkout. You can cancel anytime — access continues until the end of your billing period.</p>
      <h2 className="text-lg font-medium text-white mt-8 mb-3">4. Cancellation</h2>
      <p className="text-slate-300 leading-relaxed mb-6">You can cancel your subscription at any time. Access continues until the end of your current billing period. No refunds are given for partial months.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">5. Privacy</h2>
      <p className="text-slate-300 leading-relaxed mb-6">We take your privacy seriously. See our <a href="/privacy" className="text-white/70 hover:text-white underline underline-offset-2">Privacy Policy</a> for details on what we collect and how we use it.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">6. Safety</h2>
      <p className="text-slate-300 leading-relaxed mb-6">Sit With You is not a crisis service. If you are in crisis, please contact Samaritans on 116 123 (UK) or your local emergency services. We may provide helpline information during a call if we detect distress.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">7. Liability</h2>
      <p className="text-slate-300 leading-relaxed mb-6">Sit With You is provided as-is. We do our best to keep the service running but cannot guarantee uninterrupted availability. We are not liable for any decisions you make while using the service.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">8. Changes</h2>
      <p className="text-slate-300 leading-relaxed mb-6">We may update these terms from time to time. Continued use of the service after changes constitutes acceptance.</p>
      
      <h2 className="text-lg font-medium text-white mt-8 mb-3">9. Contact</h2>
      <p className="text-slate-300 leading-relaxed mb-6">Questions about these terms? Email us at <a href="mailto:support@sitwithyou.app" className="text-white/70 hover:text-white underline underline-offset-2">support@sitwithyou.app</a>.</p>
    </ContentLayout>
  );
}
