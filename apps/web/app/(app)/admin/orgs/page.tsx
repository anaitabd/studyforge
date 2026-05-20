"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Calendar } from "lucide-react";
import { apiGet } from "@/lib/api";

interface School {
  id: string;
  name: string;
  created_at: string;
}

function useSchools() {
  return useQuery<School[]>({
    queryKey: ["admin-schools"],
    queryFn: async () => {
      const data = await apiGet<{ schools: School[] }>("/api/v1/admin/schools");
      return data.schools ?? [];
    },
  });
}

export default function AdminOrgsPage() {
  const { data: schools, isLoading } = useSchools();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sora text-2xl font-bold text-primary">Organisations</h1>
        <p className="text-slate-500 text-sm mt-1">All schools registered on StudyForge.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (schools ?? []).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
          No organisations yet.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {(schools ?? []).map((school) => (
            <div key={school.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
                  <Building2 size={16} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">{school.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{school.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar size={12} />
                {new Date(school.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
