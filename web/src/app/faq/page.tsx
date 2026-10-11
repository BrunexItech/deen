import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/components/public/content";
import { GetStarted, PageHero, PublicPage } from "@/components/public/Site";

export const metadata: Metadata = { title: "Questions", description: "Answers to common questions about DEEN." };

export default function Faq() {
  return (
    <PublicPage>
      <PageHero eyebrow="Questions" title="Common questions" intro="Can't find your answer? Contact us and we'll help." />
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[220px_1fr]">
          <nav className="hidden lg:block" aria-label="Topics">
            <div className="sticky top-24 space-y-1">
              {FAQ.map((g) => <a key={g.group} href={`#${slug(g.group)}`} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:bg-sand-100 hover:text-brand-700">{g.group}</a>)}
            </div>
          </nav>
          <div className="space-y-12">
            {FAQ.map((g) => (
              <div key={g.group} id={slug(g.group)} className="scroll-mt-24">
                <h2 className="text-2xl font-extrabold">{g.group}</h2>
                <div className="mt-4 divide-y divide-sand-200 rounded-2xl border border-sand-200">
                  {g.items.map(([q, a]) => (
                    <details key={q} className="group px-6 py-5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                        {q}<span className="text-2xl font-light text-ink-300 transition group-open:rotate-45">+</span>
                      </summary>
                      <p className="mt-3 text-ink-500">{a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-ink-500">Still have a question? <Link href="/contact" className="font-semibold text-brand-700">Contact us</Link>.</p>
          </div>
        </div>
      </section>
      <GetStarted />
    </PublicPage>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
