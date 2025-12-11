// src/types/project.ts

export interface Project {
  id: string;
  project_number: string;
  title: string;
  description: string | null;
  client_id: string;
  manager_id: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  budget_numeric: number | null;
  currency: string;
  site_address: string | null;
  site_city: string | null;
  site_state: string | null;
  site_zip: string | null;
  site_country: string | null;
  status: ProjectStatus;
  progress_percent: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  // Relations
  client?: {
    id: string;
    full_name: string;
    company_id: string | null;
    companies?: {
      name: string;
    } | null;
  } | null;
  manager?: {
    id: string;
    full_name: string;
  } | null;
}

export type ProjectStatus = 
  | "planning" 
  | "pre_construction" 
  | "in_construction" 
  | "inspections" 
  | "completed" 
  | "on_hold";

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  progress_percent: number;
  status: MilestoneStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type MilestoneStatus = 
  | "not_started" 
  | "in_progress" 
  | "completed" 
  | "delayed";

export interface Task {
  id: string;
  project_id: string | null;
  milestone_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Relations
  assigned_user?: {
    full_name: string;
    email: string;
  } | null;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface ProjectUpdate {
  id: string;
  project_id: string;
  title: string;
  body: string; // Note: DB uses 'body', not 'content'
  update_type: UpdateType;
  posted_by: string;
  posted_at: string;
  is_pinned: boolean;
  // Relations
  posted_by_user?: {
    full_name: string;
  } | null;
}

export type UpdateType = 
  | "general" 
  | "progress" 
  | "delay" 
  | "safety" 
  | "weather" 
  | "inspection" 
  | "change_order" 
  | "issue";

export interface Approval {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  requested_by: string;
  requested_at: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  amount: number | null;
  days_requested: number | null;
  // Relations
  requested_by_user?: {
    full_name: string;
  } | null;
  approved_by_user?: {
    full_name: string;
  } | null;
}

export type ApprovalType = 
  | "change_order" 
  | "extension" 
  | "budget_increase" 
  | "final_completion" 
  | "payment_release";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface Document {
  id: string;
  project_id: string | null;
  milestone_id: string | null;
  task_id: string | null;
  name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
  folder: string;
  is_public: boolean;
  // Relations
  uploaded_by_user?: {
    full_name: string;
  } | null;
}

export interface TeamMember {
  id: string;
  project_id: string;
  user_id: string;
  role: TeamRole;
  added_at: string;
  added_by: string;
  // Relations
  user?: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

export type TeamRole = 
  | "project_manager" 
  | "foreman" 
  | "engineer" 
  | "subcontractor" 
  | "inspector" 
  | "architect";

export interface BudgetLineItem {
  id: string;
  project_id: string;
  category: string;
  description: string;
  budgeted_amount: number;
  actual_amount: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: any;
  new_data: any;
  changed_by: string | null;
  changed_at: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface EdgeFunctionResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}