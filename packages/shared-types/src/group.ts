export interface Group {
  id: string;
  name: string;
  description?: string;
  color: string;
  is_archived: boolean;
  owner_user_id: string;
  created_at: string;
  file_count?: number;
  member_count?: number;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: "owner" | "teacher" | "student";
  joined_at: string;
}
