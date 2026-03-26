import Link from "next/link";
import { Users, Timer, Heart, Zap, ArrowRight } from "lucide-react";

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card p-6 animate-fade-in">
      <div className="mb-4 inline-flex rounded-xl bg-brand-600/10 p-3 text-brand-400">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-surface-100">{title}</h3>
      <p className="text-sm text-surface-400 leading-relaxed">{description}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-32">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950/20 to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-brand-600/5 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-600/20 bg-brand-600/5 px-4 py-2 text-sm text-brand-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            42 people focusing right now
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight text-surface-50 sm:text-7xl">
            You&apos;re not alone.
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-focus bg-clip-text text-transparent">
              Still here.
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-surface-400 leading-relaxed">
            Body doubling for ADHD minds. Join virtual co-working sessions,
            focus alongside others, and finally get things done &mdash; together.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/sessions" className="btn-primary gap-2 text-base">
              Start Focusing <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/register" className="btn-secondary text-base">
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-surface-100">
            Built for the ADHD brain
          </h2>
          <p className="text-surface-400">
            Every feature is designed with executive function challenges in mind.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="Body Doubling"
            description="Work alongside others in real-time. Their presence keeps you anchored and accountable."
          />
          <FeatureCard
            icon={<Timer className="h-6 w-6" />}
            title="Structured Sprints"
            description="Pomodoro-style focus blocks with built-in breaks. No decisions needed about when to stop."
          />
          <FeatureCard
            icon={<Heart className="h-6 w-6" />}
            title="Encouragement"
            description="Send and receive gentle nudges. A small 'you&apos;ve got this' goes a long way."
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Low Friction"
            description="One click to join. No video, no awkward intros. Just parallel focus energy."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-20 text-center">
        <div className="card p-12">
          <h2 className="mb-4 text-3xl font-bold text-surface-100">
            Ready to focus?
          </h2>
          <p className="mb-8 text-surface-400">
            Join a session now. No sign-up required to browse.
          </p>
          <Link href="/sessions" className="btn-primary text-base">
            Browse Sessions
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-800 px-4 py-8">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-surface-400">
            <span className="text-lg font-bold text-surface-200">Still Here</span>
          </div>
          <p className="text-sm text-surface-500">
            Made with care for ADHD minds everywhere.
          </p>
        </div>
      </footer>
    </main>
  );
}
