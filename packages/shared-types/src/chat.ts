export interface Citation {
  file_name: string;
  page: number;
  excerpt: string;
  file_id: string;
  chunk_index: number;
}

export interface ChatMessage {
  id: string;
  group_id: string;
  user_id?: string;
  room_id?: string;
  content: string;
  role: "user" | "assistant";
  citations?: Citation[];
  is_pinned: boolean;
  created_at: string;
}

export interface StreamEvent {
  type: "token" | "citations" | "suggestions" | "done" | "error";
  content?: string;
  data?: Citation[] | string[];
  error?: string;
}
