'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, createContext, useContext } from 'react';

export const SimplifyContext = createContext(false);
export function useSimplified() { return useContext(SimplifyContext); }

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

export function ContentLayout({ children, sources, ctaButton = "I'm ready", ctaMicrocopy = "No pressure. No signup." }: ContentLayoutProps) {
  const pathname = usePathname();
  const [simplified, setSimplified] = useState(false);

  return (
    <SimplifyContext.Provider value={simplified}>
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
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                simplified
                  ? 'border-white/20 text-white bg-white/5'
                  : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
              }`}
            >
              {simplified ? 'Full version' : 'Simplify this page'}
            </button>
          </div>

          {children}

          {/* CTA */}
          <div className="mt-16 pt-8 border-t border-white/5">
            <Link
              href="/"
              className="inline-block px-16 py-5 rounded-full bg-white text-slate-900 text-xl font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150"
            >
              {ctaButton}
            </Link>
            {ctaMicrocopy && (
              <p className="mt-4 text-base text-slate-400">{ctaMicrocopy}</p>
            )}
          </div>

          {/* Sources */}
          {sources && sources.length > 0 && (
            <div className="mt-16 pt-8 border-t border-white/5">
              <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-4">Sources</h2>
              <ul className="space-y-2">
                {sources.map((source, i) => (
                  <li key={i}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-white/5 text-xs text-slate-600">
            <p>© 2025 Sit With You. Made for the hard days.</p>
          </footer>
        </main>
      </div>
    </SimplifyContext.Provider>
  );
}
