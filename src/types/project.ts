// src/lib/api/projectApi.ts

import { supabase } from '@/lib/supabaseClient';
import type { Project, Milestone, Task, Approval, Document } from '@/types/project';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ====================================================================
// STORAGE UPLOAD HELPER – Correctly scoped to project
// ====================================================================

type FolderType = 'documents' | 'photos';

// FIXED: Default bucket is correct + made required in practice via explicit calls
// src/lib/api/projectApi.ts – Update uploadFileToStorage only
export const uploadFileToStorage = async (
  file: File,
  projectId: string,
  folder: "documents" | "photos" = "documents",
  bucket: string = "documents-and-images"  // Default fallback
): Promise<{ path: string; error?: any }> => {
  try {
    let safeBucket = bucket;
    if (bucket.length === 36) {
      safeBucket = 'documents-and-images';
    }
    safeBucket = safeBucket.trim().toLowerCase();

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    const fileName = `${randomStr}_${timestamp}${fileExt ? `.${fileExt}` : ""}`;

    const filePath = `${projectId}/${folder}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(safeBucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      return { path: "", error };
    }

    if (!data?.path) {
      return { path: "", error: new Error("No path returned from upload") };
    }

    return { path: data.path };
  } catch (err) {
    return { path: "", error: err };
  }
};

// ====================================================================
// PROJECT API – Main export
// ====================================================================

export const projectApi = {
  /**
   * Fetch complete project details including all related data
   */
  async fetchProjectDetails(projectId: string) {
    try {
      // 1. Fetch main project data
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          client:profiles!projects_client_id_fkey(
            id,
            full_name,
            company_id,
            companies(name)
          ),
          manager:profiles!projects_manager_id_fkey(
            id,
            full_name
          )
        `)
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // 2. Fetch milestones
      const { data: milestones, error: milestonesError } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });


      // 3. Fetch tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });


      // 4. Enrich tasks with assigned user full_name
      let tasksWithUsers: Task[] = [];
      if (tasks && tasks.length > 0) {
        const assignedIds = [...new Set(tasks
          .map(t => t.assigned_to)
          .filter(Boolean))] as string[];

        if (assignedIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', assignedIds);

          if (profiles) {
            const profilesMap = profiles.reduce((acc, p) => {
              acc[p.id] = { full_name: p.full_name };
              return acc;
            }, {} as Record<string, { full_name: string }>);

            tasksWithUsers = tasks.map(task => ({
              ...task,
              assigned_user: task.assigned_to ? profilesMap[task.assigned_to] : null,
            })) as Task[];
          }
        } else {
          tasksWithUsers = tasks as Task[];
        }
      }

      // 5. Fetch approvals
      const { data: approvals, error: approvalsError } = await supabase
        .from('project_approvals')
        .select('*')
        .eq('project_id', projectId)
        .order('requested_at', { ascending: false });


      let approvalsWithUsers: Approval[] = [];
      if (approvals && approvals.length > 0) {
        const userIds = [...new Set([
          ...approvals.map(a => a.requested_by),
          ...approvals.map(a => a.approved_by).filter(Boolean)
        ])].filter(Boolean) as string[];

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

          if (profiles) {
            const profilesMap = profiles.reduce((acc, p) => {
              acc[p.id] = { full_name: p.full_name };
              return acc;
            }, {} as Record<string, { full_name: string }>);

            approvalsWithUsers = approvals.map(approval => ({
              ...approval,
              requested_by_user: approval.requested_by ? profilesMap[approval.requested_by] : null,
              approved_by_user: approval.approved_by ? profilesMap[approval.approved_by] : null,
            })) as Approval[];
          }
        } else {
          approvalsWithUsers = approvals as Approval[];
        }
      }

      // 6. Fetch documents (non-photos)
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .neq('folder', 'progress_photos')
        .order('uploaded_at', { ascending: false });


      let documentsWithUsers: Document[] = [];
      if (documents && documents.length > 0) {
        const uploadedByIds = [...new Set(documents
          .map(d => d.uploaded_by)
          .filter(Boolean))] as string[];

        if (uploadedByIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', uploadedByIds);

          if (profiles) {
            const profilesMap = profiles.reduce((acc, p) => {
              acc[p.id] = { full_name: p.full_name };
              return acc;
            }, {} as Record<string, { full_name: string }>);

            documentsWithUsers = documents.map(doc => ({
              ...doc,
              uploaded_by_user: doc.uploaded_by ? profilesMap[doc.uploaded_by] : null,
            })) as Document[];
          }
        } else {
          documentsWithUsers = documents as Document[];
        }
      }

      // 7. Fetch team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, user_roles(role_name), user_statuses(status_name)')
        .in('id', 
          (await supabase
            .from('project_team')
            .select('user_id')
            .eq('project_id', projectId)
          ).data?.map(row => row.user_id) || []
        );


      return {
        project: project as Project,
        milestones: (milestones || []) as Milestone[],
        tasks: tasksWithUsers,
        approvals: approvalsWithUsers,
        documents: documentsWithUsers,
        teamMembers: teamMembers || [],
      };
    } catch (error) {
      throw error;
    }
  },

  // ====================================================================
  // TASKS
  // ====================================================================

  async createTask(taskData: {
    project_id: string;
    milestone_id?: string | null;
    title: string;
    description?: string | null;
    assigned_to?: string | null;
    due_date?: string | null;
    priority?: string;
    status?: string;
  }) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create task');

      return result;
    } catch (error) {
      throw error;
    }
  },

  async updateTask(taskId: string, updates: Partial<Task>) {
    try {
      const { assigned_user, ...dbUpdates } = updates as any;

      const { data, error } = await supabase
        .from('tasks')
        .update(dbUpdates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      if (data.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.assigned_to)
          .maybeSingle();

        return {
          ...data,
          assigned_user: profile ? { full_name: profile.full_name } : null,
        };
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  async deleteTask(taskId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  // ====================================================================
  // MILESTONES
  // ====================================================================

  async createMilestone(milestoneData: Partial<Milestone>) {
    try {
      const { data, error } = await supabase
        .from('project_milestones')
        .insert(milestoneData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  async updateMilestone(milestoneId: string, updates: Partial<Milestone>) {
    try {
      const { data, error } = await supabase
        .from('project_milestones')
        .update(updates)
        .eq('id', milestoneId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  async deleteMilestone(milestoneId: string) {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', milestoneId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  // ====================================================================
  // DOCUMENTS & PHOTOS – Edge Function wrappers
  // ====================================================================

  // All Edge Function wrappers removed. Use projectApi from src/lib/api/projectApi.ts for all project-related API calls.
};