import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface SearchResult {
  id: string;
  name?: string;
  title?: string;
  group_id?: string;
  type: "group" | "file" | "exam" | "flashcard_set";
}

interface SearchResults {
  query: string;
  results: {
    groups: SearchResult[];
    files: SearchResult[];
    exams: SearchResult[];
    flashcard_sets: SearchResult[];
  };
  total: number;
}

export function useGlobalSearch(query: string) {
  return useQuery<SearchResults>({
    queryKey: ["search", query],
    queryFn: async () => {
      const res = await api.get<SearchResults>("/search", { params: { q: query } });
      return res.data;
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
