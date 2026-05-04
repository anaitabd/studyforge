"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, MessageSquare, GraduationCap, BookOpen, BarChart2, Check, ChevronDown, ArrowRight, FileText, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function LandingPage() {
  return (
    <div className="bg-white text-slate-900">
      <Navbar />
      <Hero />
      <SocialProof />
      <FeatureRAG />
      <FeatureCorrections />
      <FeatureFlashcards />
      <FeatureTeacher />
      <Pricing />
      <FAQ />
      <CTASection />
      <Footer />
    </div>
  );
}

function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="text-accent" size={22} />
          <span className="font-sora font-bold text-lg text-primary">StudyForge</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600">
          <a href="#features" className="hover:text-primary">Features</a>
          <a href="#pricing" className="hover:text-primary">Pricing</a>
          <a href="#faq" className="hover:text-primary">FAQ</a>
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/sign-in" className="text-sm font-medium text-slate-600 hover:text-primary">Sign in</Link>
          <Link href="/sign-up" className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">Start free</Link>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="md:hidden p-2 rounded hover:bg-slate-100" aria-label="Menu">
          <span className="block w-5 h-0.5 bg-current mb-1.5" />
          <span className="block w-5 h-0.5 bg-current mb-1.5" />
          <span className="block w-5 h-0.5 bg-current" />
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-3">
          <a href="#features" className="block text-sm">Features</a>
          <a href="#pricing" className="block text-sm">Pricing</a>
          <a href="#faq" className="block text-sm">FAQ</a>
          <Link href="/sign-in" className="block text-sm">Sign in</Link>
          <Link href="/sign-up" className="block px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium text-center">Start free</Link>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative bg-primary text-white overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="font-sora font-bold text-5xl md:text-7xl leading-[1.05] tracking-tight">
            Your courses.<br />
            <span className="text-accent">Your AI tutor.</span><br />
            Your exams. Aced.
          </h1>
          <p className="mt-6 text-base md:text-lg text-white/75 leading-relaxed max-w-lg">
            Upload any course file. Ask anything. Practice with exams that show you exactly why you got it wrong — with the exact passage from your course.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sign-up" className="px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 inline-flex items-center gap-2">
              Start for free <ArrowRight size={16} />
            </Link>
            <a href="#features" className="px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5">
              Watch demo
            </a>
          </div>
          <p className="mt-4 text-xs text-white/50">No credit card · Free forever</p>
        </div>

        <div className="relative">
          <div className="relative rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 p-5 max-w-md ml-auto shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center text-destructive"><XCircle size={14} /></span>
              <p className="text-sm font-medium">Q5: Adiabatic process</p>
            </div>
            <p className="text-xs text-white/60 mb-3">You answered: <span className="line-through">Isothermal</span></p>
            <div className="rounded-lg bg-accent/10 border-l-4 border-accent p-3">
              <p className="text-[10px] uppercase font-bold tracking-wider text-accent flex items-center gap-1 mb-1.5">
                <FileText size={10} /> Found in your course
              </p>
              <p className="text-xs italic text-white/80 leading-relaxed">
                &ldquo;In an adiabatic process, no heat is exchanged with the surroundings...&rdquo;
              </p>
              <p className="text-[10px] text-white/50 mt-2">thermodynamics_ch3.pdf · p. 47</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-10">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-4">Trusted by students at</p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-slate-400 font-sora font-semibold text-lg">
          <span>Univ. Mohammed V</span>
          <span>EHTP</span>
          <span>ENSIAS</span>
          <span>Polytechnique</span>
        </div>
      </div>
    </section>
  );
}

function FeatureBlock({ id, eyebrow, title, body, visual, reverse }: { id?: string; eyebrow: React.ReactNode; title: string; body: string; visual: React.ReactNode; reverse?: boolean }) {
  return (
    <section id={id} className="max-w-6xl mx-auto px-6 py-24">
      <div className={cn("grid md:grid-cols-2 gap-12 items-center", reverse && "md:[direction:rtl] [&>*]:[direction:ltr]")}>
        <div>
          <p className="text-xs uppercase font-bold tracking-wider text-accent mb-3">{eyebrow}</p>
          <h2 className="font-sora font-bold text-3xl md:text-4xl text-primary leading-tight">{title}</h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">{body}</p>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}

function FeatureRAG() {
  return (
    <FeatureBlock
      id="features"
      eyebrow={<span className="inline-flex items-center gap-1.5"><MessageSquare size={11} /> RAG Chat</span>}
      title="AI that only knows your course"
      body="Upload your lectures and textbooks. Ask anything. The AI answers only from your files — never from the internet. No hallucinations. No generic answers."
      visual={
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm ml-auto max-w-[80%]">What is the second law of thermodynamics?</div>
          <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[85%] border border-slate-100">
            The second law states that the total entropy of an isolated system can only increase over time...
          </div>
          <div className="rounded-lg border-l-4 border-accent bg-accent/5 px-3 py-2 max-w-[85%]">
            <p className="text-[10px] uppercase font-bold tracking-wider text-accent flex items-center gap-1"><FileText size={10} /> thermodynamics_ch3.pdf, p. 48</p>
          </div>
        </div>
      }
    />
  );
}

function FeatureCorrections() {
  return (
    <FeatureBlock
      reverse
      eyebrow={<span className="inline-flex items-center gap-1.5"><GraduationCap size={11} /> AI Exams</span>}
      title="Know exactly why you were wrong."
      body="Most quiz apps say 'incorrect.' StudyForge shows you the exact passage in your course that contains the right answer."
      visual={
        <div className="rounded-2xl border-l-4 border-destructive bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-2"><XCircle size={16} className="text-destructive" /><p className="font-sora font-semibold text-primary text-sm">Q5: Adiabatic process</p></div>
          <p className="text-xs text-destructive line-through mb-1">A. Isothermal process</p>
          <p className="text-xs text-teal font-medium mb-3">✓ B. Adiabatic process</p>
          <div className="rounded-lg border-l-4 border-accent bg-white p-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-accent mb-1">From your course</p>
            <p className="text-xs italic text-slate-600 leading-relaxed">&ldquo;In an adiabatic process, no heat is exchanged...&rdquo;</p>
          </div>
        </div>
      }
    />
  );
}

function FeatureFlashcards() {
  return (
    <FeatureBlock
      eyebrow={<span className="inline-flex items-center gap-1.5"><BookOpen size={11} /> Flashcards</span>}
      title="Spaced repetition built in"
      body="AI extracts every key definition and formula from your notes. SM-2 algorithm schedules reviews so you remember at exam time."
      visual={
        <div className="relative h-64">
          <div className="absolute inset-0 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center p-8 transform rotate-2">
            <p className="font-sora font-semibold text-primary text-lg text-center">What is enthalpy?</p>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-accent/5 border border-accent/30 shadow-sm flex items-center justify-center p-8 transform -rotate-3 translate-y-4 translate-x-4">
            <p className="text-sm text-slate-700 text-center leading-relaxed">A thermodynamic quantity equivalent to the total heat content of a system.</p>
          </div>
        </div>
      }
    />
  );
}

function FeatureTeacher() {
  return (
    <FeatureBlock
      reverse
      eyebrow={<span className="inline-flex items-center gap-1.5"><BarChart2 size={11} /> For Teachers</span>}
      title="From course material to exam in 2 minutes"
      body="Upload your lecture notes. Generate 20 AI-written questions. Review and publish. Track which concepts your students struggle with."
      visual={
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Class performance</p>
          <div className="space-y-2">
            {[{ n: "Sara M.", s: 92 }, { n: "Yusuf K.", s: 78 }, { n: "Aya B.", s: 56 }, { n: "Imran T.", s: 38 }].map((s) => (
              <div key={s.n} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-slate-700">{s.n}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={cn("h-full rounded-full", s.s >= 70 ? "bg-teal" : s.s >= 50 ? "bg-amber" : "bg-destructive")} style={{ width: `${s.s}%` }} />
                </div>
                <span className="font-medium w-8 text-right">{s.s}%</span>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(false);
  const tiers = [
    { name: "Free", price: 0, sub: "/forever", features: ["1 group", "5 files per group", "20 AI messages/day", "5 exams/month"], cta: "Start free", featured: false },
    { name: "Personal", price: annual ? 6.4 : 8, sub: "/month", features: ["Unlimited groups & files", "500 AI messages/day", "Flashcards (SM-2)", "Study rooms"], cta: "Get Personal", featured: true },
    { name: "School", price: annual ? 5.1 : 6, sub: "/student/mo", features: ["Everything in Personal", "Teacher dashboard", "WhatsApp notifications", "Class analytics"], cta: "Contact us", featured: false },
  ];
  return (
    <section id="pricing" className="bg-slate-50 border-y border-slate-200 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="font-sora font-bold text-3xl md:text-4xl text-primary">Simple pricing</h2>
          <p className="text-slate-500 mt-2">Free forever for the first group. Upgrade when you grow.</p>
          <div className="inline-flex items-center gap-2 mt-6 p-1 rounded-full bg-slate-200">
            <button type="button" onClick={() => setAnnual(false)} className={cn("px-4 py-1.5 rounded-full text-xs font-medium", !annual && "bg-white shadow-sm")}>Monthly</button>
            <button type="button" onClick={() => setAnnual(true)} className={cn("px-4 py-1.5 rounded-full text-xs font-medium", annual && "bg-white shadow-sm")}>Annual <span className="ml-1 text-teal text-[10px]">−20%</span></button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {tiers.map((t) => (
            <div key={t.name} className={cn("rounded-2xl p-7 transition-all", t.featured ? "bg-primary text-white scale-[1.02] shadow-xl" : "bg-white border border-slate-200")}>
              <p className={cn("text-xs uppercase font-bold tracking-wider mb-2", t.featured ? "text-accent" : "text-slate-400")}>{t.name}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="font-sora text-4xl font-bold">${t.price}</span>
                <span className={cn("text-sm", t.featured ? "text-white/60" : "text-slate-500")}>{t.sub}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check size={14} className={t.featured ? "text-accent" : "text-teal"} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={cn("block text-center px-4 py-2.5 rounded-lg font-medium text-sm", t.featured ? "bg-accent text-white hover:bg-accent/90" : "border border-slate-300 text-primary hover:bg-slate-50")}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    { q: "What file types can I upload?", a: "PDF, DOCX, PPTX, and TXT — up to 50 MB per file. Scanned PDFs need OCR (coming soon)." },
    { q: "Does the AI answer from the internet or my files only?", a: "Only your files. Every answer is grounded in passages from your uploaded documents and includes citations." },
    { q: "Can multiple students study together?", a: "Yes — create a Study Room and share the invite code. Real-time presence is in active development." },
    { q: "What languages are supported?", a: "English, French, Arabic, and Spanish. Auto-detection from source material works well." },
    { q: "How is this different from ChatGPT?", a: "ChatGPT answers from the internet and may hallucinate. StudyForge only knows what you upload, with verifiable citations." },
    { q: "Is there a free plan?", a: "Yes — 1 group, 5 files, 20 AI messages a day. Forever free, no credit card." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="max-w-3xl mx-auto px-6 py-24">
      <h2 className="font-sora font-bold text-3xl md:text-4xl text-primary text-center mb-10">Frequently asked</h2>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white">
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
              <span className="font-sora font-medium text-primary">{it.q}</span>
              <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition-transform", open === i && "rotate-180")} />
            </button>
            {open === i && <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{it.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="bg-primary text-white py-20 text-center">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="font-sora font-bold text-3xl md:text-4xl">Start studying smarter today</h2>
        <p className="text-white/70 mt-3">Free forever. No credit card required.</p>
        <Link href="/sign-up" className="inline-flex items-center gap-2 mt-6 px-7 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90">
          Create free account <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <span className="font-sora font-semibold text-primary text-sm">StudyForge</span>
          <span className="text-xs text-slate-400">· Your courses, your AI tutor.</span>
        </div>
        <div className="flex gap-5 text-xs text-slate-500">
          <a href="#" className="hover:text-primary">Privacy</a>
          <a href="#" className="hover:text-primary">Terms</a>
          <a href="#" className="hover:text-primary">Contact</a>
          <span className="text-slate-300">·</span>
          <span>EN · FR · AR</span>
        </div>
      </div>
    </footer>
  );
}
