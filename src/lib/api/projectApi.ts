// src/lib/api/projectApi.ts
import { supabase } from "@/lib/supabaseClient";
import { EdgeFunctionResponse } from "@/types/project";

/**
 * Centralized API client for all project-related edge functions
 * Maps to the 25 edge functions defined in the project requirements
 */

export const projectApi = {
  // ========================================
  // PROJECT MANAGEMENT (Functions #1-4, #22-24)
  // ========================================

  /**
   * #1: Update project status and/or progress percentage
   */
  updateProjectStatus: async (projectId: string, status: string, progress_percent?: number) => {
    const { data, error } = await supabase.functions.invoke("update-project-status", {
      body: { projectId, status, progress_percent },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #2: Update project dates (start, expected completion, actual completion)
   */
  updateProjectDates: async (
    projectId: string,
    dates: {
      start_date?: string | null;
      expected_completion_date?: string | null;
      actual_completion_date?: string | null;
    }
  ) => {
    const { data, error } = await supabase.functions.invoke("update-project-dates", {
      body: { projectId, ...dates },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #22: Update project manager
   */
  updateProjectManager: async (projectId: string, managerId: string) => {
    const { data, error } = await supabase.functions.invoke("update-project-manager", {
      body: { projectId, managerId },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #23: Update project client (rare, admin only)
   */
  updateProjectClient: async (projectId: string, clientId: string) => {
    const { data, error } = await supabase.functions.invoke("update-project-client", {
      body: { projectId, clientId },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #24: Archive/unarchive project
   */
  archiveProject: async (projectId: string, isArchived: boolean) => {
    const { data, error } = await supabase.functions.invoke("archive-project", {
      body: { projectId, isArchived },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  // ========================================
  // MILESTONE MANAGEMENT (Functions #3-4)
  // ========================================

  /**
   * #3: Update a single milestone
   */
  updateMilestone: async (
    milestoneId: string,
    updates: {
      title?: string;
      description?: string;
      status?: string;
      planned_start_date?: string | null;
      planned_end_date?: string | null;
      actual_start_date?: string | null;
      actual_end_date?: string | null;
      sort_order?: number;
      progress_percent?: number;
    }
  ) => {
    const { data, error } = await supabase.functions.invoke("update-milestone", {
      body: { milestoneId, ...updates },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #4: Reorder milestones (bulk update sort_order)
   */
  reorderMilestones: async (milestones: { id: string; sort_order: number }[]) => {
    const { data, error } = await supabase.functions.invoke("reorder-milestones", {
      body: { milestones },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  // ========================================
  // TASK MANAGEMENT (Functions #5-7)
  // ========================================

  /**
   * #5: Create new task
   */
  createTask: async (taskData: {
    project_id: string;
    milestone_id?: string | null;
    title: string;
    description?: string;
    assigned_to?: string | null;
    due_date?: string | null;
    priority?: string;
    status?: string;
  }) => {
    const { data, error } = await supabase.functions.invoke("create-task", {
      body: taskData,
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #6: Update existing task
   */
  updateTask: async (
    taskId: string,
    updates: {
      title?: string;
      description?: string;
      assigned_to?: string | null;
      due_date?: string | null;
      priority?: string;
      status?: string;
      completed_at?: string | null;
    }
  ) => {
    const { data, error } = await supabase.functions.invoke("update-task", {
      body: { taskId, ...updates },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #7: Delete task
   */
  deleteTask: async (taskId: string) => {
    const { data, error } = await supabase.functions.invoke("delete-task", {
      body: { taskId },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  // ========================================
  // PROJECT UPDATES / DAILY LOGS (Functions #8-9)
  // ========================================

  /**
   * #8: Create daily update/site report
   */
  createDailyUpdate: async (updateData: {
    project_id: string;
    title: string;
    body: string;
    update_type: string;
    photo_ids?: string[]; // IDs of already-uploaded photos to link
  }) => {
    const { data, error } = await supabase.functions.invoke("create-daily-update", {
      body: updateData,
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #9: Pin/unpin update
   */
  pinUpdate: async (updateId: string, isPinned: boolean) => {
    const { data, error } = await supabase.functions.invoke("pin-update", {
      body: { updateId, isPinned },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  // ========================================
  // DOCUMENT MANAGEMENT (Functions #10-13)
  // ========================================

  /**
   * #10: Upload single document
   * Note: File upload happens client-side to Supabase Storage first,
   * then this function creates the database record
   */
  uploadDocument: async (docData: {
    project_id: string;
    milestone_id?: string | null;
    task_id?: string | null;
    name: string;
    file_path: string;
    file_size?: number;
    mime_type?: string;
    folder: string;
  }) => {
    const { data, error } = await supabase.functions.invoke("upload-document", {
      body: docData,
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #11: Bulk upload photos
   */
  bulkUploadPhotos: async (photosData: {
    project_id: string;
    milestone_id?: string | null;
    photos: {
      name: string;
      file_path: string;
      file_size?: number;
    }[];
  }) => {
    const { data, error } = await supabase.functions.invoke("bulk-upload-photos", {
      body: photosData,
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #12: Delete document (removes from storage + database)
   */
  deleteDocument: async (documentId: string) => {
    const { data, error } = await supabase.functions.invoke("delete-document", {
      body: { documentId },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #13: Move document to different folder or link to different milestone/task
   */
  moveDocument: async (
    documentId: string,
    updates: {
      folder?: string;
      milestone_id?: string | null;
      task_id?: string | null;
    }
  ) => {
    const { data, error } = await supabase.functions.invoke("move-document", {
      body: { documentId, ...updates },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  // ========================================
  // CHANGE ORDERS & APPROVALS (Functions #14-15)
  // ========================================

  /**
   * #14: Create change order / approval request
   */
  createChangeOrder: async (approvalData: {
    project_id: string;
    title: string;
    description?: string;
    approval_type: string;
    amount?: number | null;
    days_requested?: number | null;
    document_ids?: string[]; // Attach existing documents
  }) => {
    const { data, error } = await supabase.functions.invoke("create-change-order", {
      body: approvalData,
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #15: Approve or reject change order
   */
  respondToApproval: async (
    approvalId: string,
    action: "approve" | "reject",
    rejectionReason?: string
  ) => {
    const { data, error } = await supabase.functions.invoke("respond-to-approval", {
      body: { approvalId, action, rejectionReason },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  // ========================================
  // TEAM MANAGEMENT (Functions #16-17)
  // ========================================

  /**
   * #16: Add team member to project
   */
  addTeamMember: async (teamData: {
    project_id: string;
    user_id: string;
    role: string;
  }) => {
    const { data, error } = await supabase.functions.invoke("add-team-member", {
      body: teamData,
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #17: Remove team member from project
   */
  removeTeamMember: async (teamMemberId: string) => {
    const { data, error } = await supabase.functions.invoke("remove-team-member", {
      body: { teamMemberId },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  // ========================================
  // FINANCIAL MANAGEMENT (Functions #18-19)
  // ========================================

  /**
   * #18: Create budget line item
   */
  createBudgetLineItem: async (budgetData: {
    project_id: string;
    category: string;
    description: string;
    budgeted_amount: number;
  }) => {
    const { data, error } = await supabase.functions.invoke("create-budget-line-item", {
      body: budgetData,
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #19: Update actual cost on budget line item
   */
  updateActualCost: async (lineItemId: string, actualAmount: number) => {
    const { data, error } = await supabase.functions.invoke("update-actual-cost", {
      body: { lineItemId, actualAmount },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  // ========================================
  // REPORTING & UTILITIES (Functions #20-21, #25)
  // ========================================

  /**
   * #20: Generate PDF progress report
   */
  generatePdfReport: async (projectId: string) => {
    const { data, error } = await supabase.functions.invoke("generate-pdf-report", {
      body: { projectId },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #21: Get project activity log (audit trail)
   */
  getProjectActivityLog: async (projectId: string, limit = 50) => {
    const { data, error } = await supabase.functions.invoke("get-project-activity-log", {
      body: { projectId, limit },
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },

  /**
   * #25: Send notification to client
   */
  sendClientNotification: async (notificationData: {
    project_id: string;
    recipient_id: string;
    type: string;
    message: string;
  }) => {
    const { data, error } = await supabase.functions.invoke("send-client-notification", {
      body: notificationData,
    });
    if (error) throw error;
    return data as EdgeFunctionResponse;
  },
};

// Helper function for file uploads to Supabase Storage
export const uploadFileToStorage = async (
  file: File,
  bucket: string = "documents",
  folder: string = "general"
): Promise<{ path: string; error: any }> => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { data, error } = await supabase.storage.from(bucket).upload(filePath, file);

  if (error) {
    return { path: "", error };
  }

  return { path: data.path, error: null };
};

// Helper function to delete file from storage
export const deleteFileFromStorage = async (
  filePath: string,
  bucket: string = "documents"
): Promise<{ error: any }> => {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  return { error };
};