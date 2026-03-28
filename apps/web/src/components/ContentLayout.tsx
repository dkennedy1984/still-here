'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_LINKS = [
  { label: 'Body Doubling', href: '/adhd-body-doubling' },
  { label: 'Starting', href: '/cant-start-a-task' },
  { label: 'Overwhelm', href: '/feeling-overwhelmed' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Why', href: '/why' },
];

interface Source {
  title: string;
  url: string;
}

interface ContentLayoutProps {
  children: React.ReactNode;
  sources?: Source[];
  ctaButton?: string;
  ctaMicrocopy?: string;
}

export function ContentLayout({ children, sources, ctaButton = 'Call', ctaMicrocopy = "I'll just sit with you." }: ContentLayoutProps) {
  const pathname = usePathname();
  const [simplified, setSimplified] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Minimal header */}
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-white/90 font-medium text-sm tracking-tight hover:text-white transition-colors">
            Sit With You
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs transition-colors ${
                  pathname === link.href ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-12 sm:py-16">
        {/* Simplify toggle */}
        <div className="flex justify-end mb-8">
          <button
            onClick={() => setSimplified(s => !s)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-2"
          >
            <span className={`w-7 h-4 rounded-full relative transition-colors ${simplified ? 'bg-green-400/30' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${simplified ? 'left-3.5' : 'left-0.5'}`} />
            </span>
            Simplify this page
          </button>
        </div>

        <div className={simplified ? 'simplified-content' : ''}>
          {children}
        </div>

        {/* CTA */}
        <div className="mt-16 flex flex-col items-center">
          <Link
            href="/"
            className="px-12 py-4 rounded-full bg-white text-slate-900 text-lg font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150"
          >
            {ctaButton}
          </Link>
          <p className="mt-3 text-sm text-slate-400">{ctaMicrocopy}</p>
        </div>

        {/* Sources */}
        {sources && sources.length > 0 && (
          <section className="mt-20 pt-8 border-t border-white/5">
            <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-4">Sources & further reading</h2>
            <ul className="space-y-2">
              {sources.map(s => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">
                    {s.title} ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-2xl mx-auto px-6 flex flex-wrap gap-6 text-xs text-slate-600">
          <Link href="/how-it-works" className="hover:text-slate-400 transition-colors">How it works</Link>
          <Link href="/why" className="hover:text-slate-400 transition-colors">Why</Link>
          <Link href="/vs-focusmate" className="hover:text-slate-400 transition-colors">vs Focusmate</Link>
          <span className="ml-auto">© {new Date().getFullYear()} Sit With You</span>
        </div>
      </footer>
    </div>
  );
}
