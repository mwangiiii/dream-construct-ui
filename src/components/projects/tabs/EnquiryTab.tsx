// Admin-only tab on the project detail page. Admin composes a short message
// against a project; submitting calls the `send-project-enquiry` edge function
// which re-reads the project and its PM server-side and emails the PM.
//
// This tab is deliberately simple — no history view, no attachments, no
// threading. If a persistent audit trail is wanted later, add a
// `project_enquiries` table and the edge function can insert into it.

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, MailCheck, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface EnquiryTabProps {
  projectId: string;
  projectTitle: string;
  projectNumber: string | null;
  manager: { id: string; full_name: string } | null;
}

const MAX_SUBJECT_LEN = 180;
const MAX_MESSAGE_LEN = 8000;

export default function EnquiryTab({
  projectId,
  projectTitle,
  projectNumber,
  manager,
}: EnquiryTabProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [sentAt,  setSentAt]  = useState<Date | null>(null);

  const hasManager = Boolean(manager?.id);
  const trimmedMessage = message.trim();
  const canSend = hasManager && trimmedMessage.length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "send-project-enquiry",
        {
          body: {
            projectId,
            subject: subject.trim(),
            message: trimmedMessage,
          },
        },
      );
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setSentAt(new Date());
      setSubject("");
      setMessage("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send enquiry.");
    } finally {
      setSending(false);
    }
  };

  const projectLabel = projectNumber
    ? `${projectNumber} · ${projectTitle}`
    : projectTitle;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Enquiry</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Send a note to this project's manager by email. They receive your
          message against the project context; replying goes to your inbox.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 max-w-2xl">
        <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-background/40 px-3 py-2.5 text-xs">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-muted-foreground">
              <span className="text-foreground font-semibold">Project:</span>{" "}
              {projectLabel}
            </p>
            <p className="text-muted-foreground">
              <span className="text-foreground font-semibold">To:</span>{" "}
              {manager?.full_name ?? (
                <span className="text-amber-300">
                  No project manager assigned
                </span>
              )}
            </p>
          </div>
        </div>

        {!hasManager && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              This project has no assigned manager yet. Assign one from
              /admin/assignments, then come back here to send the enquiry.
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="enquiry-subject" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Subject <span className="normal-case text-muted-foreground/60">(optional)</span>
          </label>
          <input
            id="enquiry-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT_LEN))}
            placeholder="e.g. Clarification on this week's site photos"
            disabled={sending || !hasManager}
            maxLength={MAX_SUBJECT_LEN}
            className="w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="enquiry-message" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Message
          </label>
          <textarea
            id="enquiry-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LEN))}
            placeholder="Write what you'd like the project manager to address…"
            disabled={sending || !hasManager}
            rows={8}
            maxLength={MAX_MESSAGE_LEN}
            className="w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 resize-y"
          />
          <p className="text-[11px] text-muted-foreground/70 text-right">
            {message.length} / {MAX_MESSAGE_LEN}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {sentAt && !error && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-xs text-green-200 flex items-start gap-2">
            <MailCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Sent to {manager?.full_name ?? "the project manager"} at{" "}
              {sentAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end">
          <motion.button
            whileHover={canSend ? { scale: 1.02 } : {}}
            whileTap={canSend ? { scale: 0.98 } : {}}
            onClick={handleSend}
            disabled={!canSend}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-background font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              : <><Send className="w-4 h-4" /> Send enquiry</>}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
