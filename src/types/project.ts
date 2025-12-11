// src/lib/api/projectApi.ts

import { supabase } from '@/lib/supabase';
import type { Project, Milestone, Task, ProjectUpdate, Approval, Document } from '@/types/project';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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

      if (milestonesError) console.error('Milestones error:', milestonesError);

      // 3. Fetch tasks (without foreign key hint)
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (tasksError) console.error('Tasks error:', tasksError);

      // 4. If we have tasks with assigned users, fetch those profiles
      let tasksWithUsers: Task[] = [];
      if (tasks && tasks.length > 0) {
        const assignedIds = [...new Set(tasks
          .map(t => t.assigned_to)
          .filter(Boolean))] as string[];

        if (assignedIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', assignedIds);

          if (profiles) {
            const profilesMap = profiles.reduce((acc, p) => {
              acc[p.id] = { full_name: p.full_name, email: p.email };
              return acc;
            }, {} as Record<string, { full_name: string; email: string }>);

            tasksWithUsers = tasks.map(task => ({
              ...task,
              assigned_user: task.assigned_to ? profilesMap[task.assigned_to] : null,
            })) as Task[];
          }
        } else {
          tasksWithUsers = tasks as Task[];
        }
      }

      // 5. Fetch project updates (without foreign key hint)
      const { data: updates, error: updatesError } = await supabase
        .from('project_updates')
        .select('*')
        .eq('project_id', projectId)
        .order('posted_at', { ascending: false });

      if (updatesError) console.error('Updates error:', updatesError);

      // 6. Fetch profiles for updates
      let updatesWithUsers: ProjectUpdate[] = [];
      if (updates && updates.length > 0) {
        const postedByIds = [...new Set(updates
          .map(u => u.posted_by)
          .filter(Boolean))] as string[];

        if (postedByIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', postedByIds);

          if (profiles) {
            const profilesMap = profiles.reduce((acc, p) => {
              acc[p.id] = { full_name: p.full_name };
              return acc;
            }, {} as Record<string, { full_name: string }>);

            updatesWithUsers = updates.map(update => ({
              ...update,
              posted_by_user: update.posted_by ? profilesMap[update.posted_by] : null,
            })) as ProjectUpdate[];
          }
        } else {
          updatesWithUsers = updates as ProjectUpdate[];
        }
      }

      // 7. Fetch approvals (without foreign key hints)
      const { data: approvals, error: approvalsError } = await supabase
        .from('project_approvals')
        .select('*')
        .eq('project_id', projectId)
        .order('requested_at', { ascending: false });

      if (approvalsError) console.error('Approvals error:', approvalsError);

      // 8. Fetch profiles for approvals
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

      // 9. Fetch documents (without foreign key hint)
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .neq('folder', 'progress_photos')
        .order('uploaded_at', { ascending: false });

      if (documentsError) console.error('Documents error:', documentsError);

      // 10. Fetch profiles for documents
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

      // 11. Fetch team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, user_roles(role_name), user_statuses(status_name)')
        .in('id', 
          supabase
            .from('project_team')
            .select('user_id')
            .eq('project_id', projectId)
        );

      if (teamError) console.error('Team error:', teamError);

      return {
        project: project as Project,
        milestones: (milestones || []) as Milestone[],
        tasks: tasksWithUsers,
        updates: updatesWithUsers,
        approvals: approvalsWithUsers,
        documents: documentsWithUsers,
        teamMembers: teamMembers || [],
      };
    } catch (error) {
      console.error('[projectApi] Error fetching project details:', error);
      throw error;
    }
  },

  /**
   * Create a new task
   */
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
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create task');
      }

      return result;
    } catch (error) {
      console.error('[projectApi] Error creating task:', error);
      throw error;
    }
  },

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: Partial<Task>) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      // Fetch the assigned user profile if needed
      if (data.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', data.assigned_to)
          .single();

        return {
          ...data,
          assigned_user: profile,
        };
      }

      return data;
    } catch (error) {
      console.error('[projectApi] Error updating task:', error);
      throw error;
    }
  },

  /**
   * Delete a task
   */
  async deleteTask(taskId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('[projectApi] Error deleting task:', error);
      throw error;
    }
  },

  /**
   * Create a new milestone
   */
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
      console.error('[projectApi] Error creating milestone:', error);
      throw error;
    }
  },

  /**
   * Update a milestone
   */
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
      console.error('[projectApi] Error updating milestone:', error);
      throw error;
    }
  },

  /**
   * Delete a milestone
   */
  async deleteMilestone(milestoneId: string) {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', milestoneId);

      if (error) throw error;
    } catch (error) {
      console.error('[projectApi] Error deleting milestone:', error);
      throw error;
    }
  },
};