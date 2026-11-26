import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Pencil, Trash2, Eye, EyeOff, X, ExternalLink,
  Loader2, GripVertical, AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { renderMarkdown } from "@/lib/markdown";
import { SECTION_COLUMNS, SITE_PAGES, type SiteSection } from "@/lib/sitePages";

// Admin → Content → Pages.
//
// Edits the content blocks the public marketing pages read. The page list comes
// from SITE_PAGES in code because content cannot create a route — see the
// comment there.

type Draft = {
  id?: string;
  section_key: string;
  heading: string;
  subheading: string;
  body: string;
  image_url: string;
  cta_label: string;
  cta_href: string;
  is_published: boolean;
  sort_order: number;
};

const emptyDraft = (sortOrder: number): Draft => ({
  section_key: "",
  heading: "",
  subheading: "",
  body: "",
  image_url: "",
  cta_label: "",
  cta_href: "",
  is_published: false,
  sort_order: sortOrder,
});

const toDraft = (s: SiteSection): Draft => ({
  id: s.id,
  section_key: s.section_key,
  heading: s.heading ?? "",
  subheading: s.subheading ?? "",
  body: s.body ?? "",
  image_url: s.image_url ?? "",
  cta_label: s.cta_label ?? "",
  cta_href: s.cta_href ?? "",
  is_published: s.is_published,
  sort_order: s.sort_order,
});

export default function PagesContent() {
  const [activePage, setActivePage] = useState(SITE_PAGES[0].slug);
  const [sections, setSections] = useState<SiteSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SiteSection | null>(null);

  const page = useMemo(
    () => SITE_PAGES.find((p) => p.slug === activePage) ?? SITE_PAGES[0],
    [activePage],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("site_page_sections")
      .select(SECTION_COLUMNS)
      .eq("page_slug", activePage)
      .order("sort_order");

    if (error) setLoadError(error.message);
    else setSections((data ?? []) as unknown as SiteSection[]);
    setLoading(false);
  }, [activePage]);

  useEffect(() => { load(); }, [load]);

  const nextSortOrder = () =>
    sections.reduce((max, s) => Math.max(max, s.sort_order), 0) + 10;

  const save = async () => {
    if (!draft) return;

    const key = draft.section_key.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) {
      setFormError("Section key must be lowercase letters, numbers, hyphen or underscore.");
      return;
    }
    if (!draft.heading.trim() && !draft.body.trim()) {
      setFormError("Give the section a heading or some body text.");
      return;
    }
    // Mirrors the site_page_sections_cta_complete CHECK, so the user gets a
    // readable message instead of a constraint violation.
    const hasLabel = !!draft.cta_label.trim();
    const hasHref = !!draft.cta_href.trim();
    if (hasLabel !== hasHref) {
      setFormError("A call to action needs both a label and a link.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload = {
      page_slug: activePage,
      section_key: key,
      heading: draft.heading.trim() || null,
      subheading: draft.subheading.trim() || null,
      body: draft.body.trim() || null,
      image_url: draft.image_url.trim() || null,
      cta_label: draft.cta_label.trim() || null,
      cta_href: draft.cta_href.trim() || null,
      is_published: draft.is_published,
      sort_order: draft.sort_order,
    };

    const { error } = draft.id
      ? await supabase.from("site_page_sections").update(payload).eq("id", draft.id)
      : await supabase.from("site_page_sections").insert(payload);

    setSaving(false);

    if (error) {
      setFormError(
        error.code === "23505" || error.message.includes("site_page_sections_page_section_key")
          ? `"${key}" already exists on this page. Pick another key.`
          : error.message,
      );
      return;
    }

    toast({ title: draft.id ? "Section updated" : "Section created" });
    setDraft(null);
    setShowPreview(false);
    load();
  };

  const togglePublished = async (s: SiteSection) => {
    const { error } = await supabase
      .from("site_page_sections")
      .update({ is_published: !s.is_published })
      .eq("id", s.id);

    if (error) {
      toast({ title: error.message, variant: "destructive" });
      return;
    }
    setSections((prev) =>
      prev.map((row) => (row.id === s.id ? { ...row, is_published: !row.is_published } : row)));
    toast({ title: s.is_published ? "Section unpublished" : "Section published" });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase
      .from("site_page_sections").delete().eq("id", pendingDelete.id);

    if (error) {
      toast({ title: error.message, variant: "destructive" });
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== pendingDelete.id));
    setPendingDelete(null);
    toast({ title: "Section deleted" });
  };

  const publishedCount = sections.filter((s) => s.is_published).length;

  return (
    <div className="space-y-6">
      {/* ── Page picker ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {SITE_PAGES.map((p) => {
          const active = p.slug === activePage;
          return (
            <button
              key={p.slug}
              onClick={() => { setActivePage(p.slug); setDraft(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "glass border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FileText className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{page.label}</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">{page.description}</p>
            <p className="text-xs text-muted-foreground/70 mt-1.5">
              {loading ? "Loading…" : `${sections.length} section${sections.length === 1 ? "" : "s"} · ${publishedCount} published`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={page.route}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-white/15 text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View page
            </a>
            <Button
              size="sm"
              onClick={() => { setDraft(emptyDraft(nextSortOrder())); setFormError(""); }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New section
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ── Sections ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          Loading sections…
        </div>
      ) : loadError ? (
        <GlassCard className="text-center py-16">
          <AlertCircle className="w-10 h-10 text-destructive/70 mx-auto mb-3" />
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={load}>Try again</Button>
        </GlassCard>
      ) : sections.length === 0 ? (
        <GlassCard className="text-center py-16">
          <FileText className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No sections yet</h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
            Add a section to make this page's copy editable without a code change.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <motion.div key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <GlassCard className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-1 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-primary">
                        {s.section_key}
                      </code>
                      {s.is_published ? (
                        <Badge className="bg-green-500/15 text-green-300 border-green-500/25 hover:bg-green-500/15">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                      <span className="text-xs text-muted-foreground/60">#{s.sort_order}</span>
                    </div>

                    {s.heading && (
                      <p className="font-semibold text-foreground mt-2 truncate">{s.heading}</p>
                    )}
                    {s.subheading && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{s.subheading}</p>
                    )}
                    {s.body && (
                      <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{s.body}</p>
                    )}
                    {s.cta_label && (
                      <p className="text-xs text-primary/80 mt-2">
                        {s.cta_label} → {s.cta_href}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => togglePublished(s)}
                      title={s.is_published ? "Unpublish" : "Publish"}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
                    >
                      {s.is_published
                        ? <Eye className="w-4 h-4" />
                        : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => { setDraft(toDraft(s)); setFormError(""); }}
                      title="Edit"
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(s)}
                      title="Delete"
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Editor ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {draft && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm overflow-y-auto p-4 sm:p-6"
            onClick={() => { if (!saving) { setDraft(null); setShowPreview(false); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl my-auto bg-card border border-border rounded-xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="font-semibold">
                  {draft.id ? "Edit section" : "New section"}
                  <span className="text-muted-foreground font-normal"> · {page.label}</span>
                </h3>
                <button
                  onClick={() => { setDraft(null); setShowPreview(false); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {formError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="section-key">Section key</Label>
                    <Input
                      id="section-key"
                      value={draft.section_key}
                      disabled={!!draft.id}
                      onChange={(e) => setDraft({ ...draft, section_key: e.target.value })}
                      placeholder="hero"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {draft.id
                        ? "The key is read by code and cannot be renamed here."
                        : "Lowercase handle the page looks up, e.g. hero or intro."}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="section-order">Order</Label>
                    <Input
                      id="section-order"
                      type="number"
                      value={draft.sort_order}
                      onChange={(e) =>
                        setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="section-heading">Heading</Label>
                  <Input
                    id="section-heading"
                    value={draft.heading}
                    onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                    placeholder="Our Work in Focus"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="section-subheading">Subheading</Label>
                  <Input
                    id="section-subheading"
                    value={draft.subheading}
                    onChange={(e) => setDraft({ ...draft, subheading: e.target.value })}
                    placeholder="One supporting line beneath the heading"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="section-body">Body</Label>
                    <button
                      type="button"
                      onClick={() => setShowPreview((v) => !v)}
                      className="text-xs text-primary hover:underline"
                    >
                      {showPreview ? "Edit" : "Preview"}
                    </button>
                  </div>
                  {showPreview ? (
                    <div
                      className="min-h-[120px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm prose-sm max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.body) }}
                    />
                  ) : (
                    <Textarea
                      id="section-body"
                      value={draft.body}
                      onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                      rows={6}
                      placeholder="Markdown supported — **bold**, *italic*, [links](/contact), lists."
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="section-image">Image URL</Label>
                  <Input
                    id="section-image"
                    value={draft.image_url}
                    onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                    placeholder="https://… (optional)"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="section-cta-label">Button label</Label>
                    <Input
                      id="section-cta-label"
                      value={draft.cta_label}
                      onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })}
                      placeholder="Contact us"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="section-cta-href">Button link</Label>
                    <Input
                      id="section-cta-href"
                      value={draft.cta_href}
                      onChange={(e) => setDraft({ ...draft, cta_href: e.target.value })}
                      placeholder="/contact"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.is_published}
                    onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })}
                    className="w-4 h-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm">
                    Published
                    <span className="text-muted-foreground"> — visible to the public</span>
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={() => { setDraft(null); setShowPreview(false); }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : draft.id ? "Save changes" : "Create section"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>
              <code className="font-mono">{pendingDelete?.section_key}</code> will be
              removed from {page.label}. If the page has no fallback copy for this
              key, that part of the page will be empty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
