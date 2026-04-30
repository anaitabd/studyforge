export type UserRole = "student" | "teacher" | "school_admin" | "super_admin";
export type UserPlan = "free" | "personal" | "school";

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: UserPlan;
  school_id?: string;
  avatar_url?: string;
  created_at: string;
}
