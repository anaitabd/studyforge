import { Sparkles, MessageSquare, GraduationCap, BookOpen } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-[45%] bg-primary text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-12">
            <Sparkles className="text-accent" size={24} />
            <span className="font-sora font-bold text-xl">StudyForge</span>
          </div>
          <h1 className="font-sora font-bold text-4xl leading-tight mb-4">
            Your courses.<br />
            <span className="text-accent">Your AI tutor.</span><br />
            Your exam prep.
          </h1>
          <div className="flex flex-wrap gap-2 mt-8">
            <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur text-xs font-medium flex items-center gap-1.5"><MessageSquare size={12} /> RAG Chat</span>
            <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur text-xs font-medium flex items-center gap-1.5"><GraduationCap size={12} /> AI Exams</span>
            <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur text-xs font-medium flex items-center gap-1.5"><BookOpen size={12} /> Flashcards</span>
          </div>
        </div>
        <div className="relative rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 max-w-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center text-destructive text-xs">✕</span>
            <p className="text-sm font-medium">Q5: Adiabatic process</p>
          </div>
          <p className="text-xs text-white/70 mb-3">Found in <span className="text-accent">thermodynamics_ch3.pdf</span></p>
          <p className="text-xs italic text-white/80 leading-relaxed border-l-2 border-accent pl-3">
            &ldquo;In an adiabatic process, no heat is exchanged with the surroundings...&rdquo;
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-2 mb-8 justify-center">
            <Sparkles className="text-accent" size={22} />
            <span className="font-sora font-bold text-xl text-primary">StudyForge</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
