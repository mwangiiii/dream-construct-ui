import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { renderMarkdown } from "@/lib/markdown";

// Policy & legal document management.
//
// Edits both policy_categories and policies. Two things to keep in mind:
//
//  1. Writes require manager+ (RLS policy_categories_write / policies_write,
//     rewritten in 20261125090000 to use security.is_manager_or_up() — the
//     original rules checked profiles.role, a column that does not exist).
//
//  2. Public exposure is a DOUBLE gate. A section reaches anonymous visitors
//     only when the section is public AND active AND its category is public.
//     Both default to false. The UI states this plainly because publishing the
//     wrong row here puts internal content on the public internet.

interface Category {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_public: boolean;
}

interface Section {
  id: string;
  category_id: string;
  title: string;
  content: string;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
}

const inputCls =
  "w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground " +
  "placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 " +
  "focus:border-primary/40 transition-all";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function Toggle({ checked, onChange, label, hint, danger }: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; hint?: string; danger?: boolean;
}) {
  return (
    <label className={`flex items-start gap-2.5 cursor-pointer rounded-xl px-3 py-2.5 border transition-colors ${
      checked && danger
        ? "bg-amber-500/10 border-amber-500/30"
        : checked ? "bg-primary/5 border-primary/25" : "bg-white/3 border-white/10"
    }`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-primary cursor-pointer shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export default function PolicyManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [sections, setSections]     = useState<Section[]>([]);
  const [activeCat, setActiveCat]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<{ msg: string; bad?: boolean } | null>(null);

  const [catForm, setCatForm] = useState<Partial<Category> | null>(null);
  const [secForm, setSecForm] = useState<Partial<Section> | null>(null);
  const [preview, setPreview] = useState(false);

  const notify = (msg: string, bad = false) => {
    setToast({ msg, bad });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cats, error: cErr } = await supabase
        .from("policy_categories")
        .select("id,title,slug,description,icon,sort_order,is_public")
        .order("sort_order");
      if (cErr) throw new Error(cErr.message);

      const { data: secs, error: sErr } = await supabase
        .from("policies")
        .select("id,category_id,title,content,is_active,is_public,sort_order")
        .order("sort_order");
      if (sErr) throw new Error(sErr.message);

      setCategories((cats ?? []) as Category[]);
      setSections((secs ?? []) as Section[]);
      setActiveCat((prev) => prev ?? (cats?.[0]?.id ?? null));
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to load policies", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const catSections = useMemo(
    () => sections.filter((s) => s.category_id === activeCat)
                  .sort((a, b) => a.sort_order - b.sort_order),
    [sections, activeCat]
  );
  const current = categories.find((c) => c.id === activeCat) ?? null;

  // ── category CRUD ─────────────────────────────────────────────────────────
  const saveCategory = async () => {
    if (!catForm?.title?.trim()) { notify("Title is required", true); return; }
    setSaving(true);
    try {
      const payload = {
        title: catForm.title.trim(),
        slug: (catForm.slug?.trim() || slugify(catForm.title)),
        description: catForm.description?.trim() || null,
        icon: catForm.icon?.trim() || "FileText",
        sort_order: Number(catForm.sort_order) || 0,
        is_public: Boolean(catForm.is_public),
      };
      if (catForm.id) {
        const { error } = await supabase.from("policy_categories")
          .update(payload).eq("id", catForm.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("policy_categories")
          .insert([payload]).select("id").single();
        if (error) throw new Error(error.message);
        setActiveCat(data.id);
      }
      setCatForm(null);
      await load();
      notify("Category saved");
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Save failed", true);
    } finally { setSaving(false); }
  };

  const deleteCategory = async (id: string) => {
    setSaving(true);
    try {
      // policies.category_id is ON DELETE CASCADE, so its sections go too.
      const { error } = await supabase.from("policy_categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
      if (activeCat === id) setActiveCat(null);
      await load();
      notify("Category deleted");
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Delete failed", true);
    } finally { setSaving(false); }
  };

  // ── section CRUD ──────────────────────────────────────────────────────────
  const saveSection = async () => {
    if (!secForm?.title?.trim()) { notify("Section title is required", true); return; }
    if (!activeCat) { notify("Select a category first", true); return; }
    setSaving(true);
    try {
      const payload = {
        category_id: activeCat,
        title: secForm.title.trim(),
        content: secForm.content ?? "",
        is_active: secForm.is_active ?? true,
        is_public: Boolean(secForm.is_public),
        sort_order: Number(secForm.sort_order) || 0,
      };
      if (secForm.id) {
        const { error } = await supabase.from("policies")
          .update(payload).eq("id", secForm.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("policies").insert([payload]);
        if (error) throw new Error(error.message);
      }
      setSecForm(null);
      setPreview(false);
      await load();
      notify("Section saved");
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Save failed", true);
    } finally { setSaving(false); }
  };

  const deleteSection = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("policies").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await load();
      notify("Section deleted");
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Delete failed", true);
    } finally { setSaving(false); }
  };

  const publicUrl = current?.slug === "terms-of-service" ? "/terms"
                  : current?.slug === "privacy-policy"   ? "/privacy"
                  : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-[1500px]">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-[100] px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
              toast.bad
                ? "bg-rose-950/80 border-rose-500/25 text-rose-300"
                : "bg-emerald-950/80 border-emerald-500/25 text-emerald-300"
            }`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Policies &amp; Legal</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Internal staff policies and the public Terms of Service / Privacy Policy.
          A section is visible to the public only when the section <em>and</em> its
          category are both marked public, and the section is active.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-32 text-sm text-muted-foreground">
          <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

          {/* ── Categories ── */}
          <aside className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Documents
              </span>
              <button
                onClick={() => setCatForm({ is_public: false, sort_order: (categories.at(-1)?.sort_order ?? 0) + 10 })}
                className="text-xs font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10">
                + New
              </button>
            </div>

            {categories.map((c) => {
              const count = sections.filter((s) => s.category_id === c.id).length;
              return (
                <button key={c.id} onClick={() => setActiveCat(c.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                    activeCat === c.id
                      ? "bg-primary/10 border-primary/30"
                      : "bg-white/3 border-white/8 hover:border-white/15"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate flex-1">{c.title}</span>
                    {c.is_public && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded
                                       bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        Public
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                    /{c.slug} · {count} section{count === 1 ? "" : "s"}
                  </div>
                </button>
              );
            })}

            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No documents yet.
              </p>
            )}
          </aside>

          {/* ── Sections of the selected category ── */}
          <main>
            {!current ? (
              <div className="py-24 text-center text-sm text-muted-foreground">
                Select a document on the left, or create one.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b border-white/10">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-foreground">{current.title}</h2>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">/{current.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {publicUrl && current.is_public && (
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/15
                                   text-muted-foreground hover:text-foreground hover:bg-white/5">
                        View public page
                      </a>
                    )}
                    <button onClick={() => setCatForm(current)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/15
                                 text-muted-foreground hover:text-foreground hover:bg-white/5">
                      Edit document
                    </button>
                    <button
                      onClick={() => setSecForm({ is_active: true, is_public: current.is_public,
                                                  sort_order: (catSections.at(-1)?.sort_order ?? 0) + 10 })}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg text-primary-foreground"
                      style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                      + Add section
                    </button>
                  </div>
                </div>

                {!current.is_public && (
                  <div className="mb-5 rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-xs text-muted-foreground">
                    This document is <strong className="text-foreground">not public</strong>. Its
                    sections stay internal regardless of their own public flag.
                  </div>
                )}

                <div className="space-y-3">
                  {catSections.map((s) => (
                    <div key={s.id} className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/8">
                        <span className="text-sm font-semibold text-foreground">{s.title}</span>
                        {!s.is_active && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded
                                           bg-white/10 text-muted-foreground">Draft</span>
                        )}
                        {s.is_public && s.is_active && current.is_public ? (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded
                                           bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                            Live
                          </span>
                        ) : s.is_public ? (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded
                                           bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            Public, not live
                          </span>
                        ) : null}
                        <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto">
                          #{s.sort_order}
                        </span>
                        <button onClick={() => { setSecForm(s); setPreview(false); }}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-white/8">
                          Edit
                        </button>
                        <button onClick={() => deleteSection(s.id)} disabled={saving}
                          className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 disabled:opacity-40">
                          Delete
                        </button>
                      </div>
                      <div className="px-4 py-3 text-xs text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">
                        {s.content || "— empty —"}
                      </div>
                    </div>
                  ))}

                  {catSections.length === 0 && (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      No sections yet. Add one to start writing this document.
                    </p>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {/* ── Category modal ── */}
      <AnimatePresence>
        {catForm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCatForm(null)} />
            <motion.div
              className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d0d]/95 backdrop-blur-xl shadow-2xl"
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-base font-bold text-foreground">
                  {catForm.id ? "Edit Document" : "New Document"}
                </h3>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title *</label>
                  <input value={catForm.title ?? ""} className={inputCls + " mt-1.5"}
                    placeholder="e.g. Terms of Service"
                    onChange={(e) => setCatForm({ ...catForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Slug</label>
                  <input value={catForm.slug ?? ""} className={inputCls + " mt-1.5 font-mono"}
                    placeholder={catForm.title ? slugify(catForm.title) : "terms-of-service"}
                    onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Leave blank to derive from the title. <code>terms-of-service</code> serves
                    /terms and <code>privacy-policy</code> serves /privacy.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
                  <textarea value={catForm.description ?? ""} rows={2} className={inputCls + " mt-1.5 resize-none"}
                    onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort Order</label>
                  <input type="number" value={catForm.sort_order ?? 0} className={inputCls + " mt-1.5"}
                    onChange={(e) => setCatForm({ ...catForm, sort_order: Number(e.target.value) })} />
                </div>
                <Toggle
                  checked={Boolean(catForm.is_public)} danger
                  onChange={(v) => setCatForm({ ...catForm, is_public: v })}
                  label="Publish to the public website"
                  hint="Anyone on the internet, signed in or not, can read this document's public sections. Leave off for internal staff policies."
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10">
                {catForm.id ? (
                  <button onClick={() => { deleteCategory(catForm.id!); setCatForm(null); }} disabled={saving}
                    className="text-sm text-rose-400 hover:text-rose-300 px-3 py-2 rounded-xl hover:bg-rose-500/10 disabled:opacity-40">
                    Delete document
                  </button>
                ) : <span />}
                <div className="flex items-center gap-3">
                  <button onClick={() => setCatForm(null)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-white/5">
                    Cancel
                  </button>
                  <button onClick={saveCategory} disabled={saving}
                    className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Section modal — markdown + live preview ── */}
      <AnimatePresence>
        {secForm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSecForm(null); setPreview(false); }} />
            <motion.div
              className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0d0d0d]/95 backdrop-blur-xl shadow-2xl"
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h3 className="text-base font-bold text-foreground">
                  {secForm.id ? "Edit Section" : "New Section"}
                </h3>
                <button onClick={() => setPreview((p) => !p)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    preview ? "bg-primary/15 border-primary/30 text-primary"
                            : "border-white/15 text-muted-foreground hover:text-foreground"
                  }`}>
                  {preview ? "Edit" : "Preview"}
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[64vh] overflow-y-auto">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title *</label>
                  <input value={secForm.title ?? ""} className={inputCls + " mt-1.5"}
                    placeholder="e.g. Information We Collect"
                    onChange={(e) => setSecForm({ ...secForm, title: e.target.value })} />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Content {preview ? "— preview" : "— markdown"}
                  </label>
                  {preview ? (
                    <div className="mt-1.5 min-h-[260px] rounded-xl border border-white/10 bg-white/3 px-4 py-3
                                    text-sm text-muted-foreground leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(secForm.content ?? "") }} />
                  ) : (
                    <>
                      <textarea value={secForm.content ?? ""} rows={12}
                        className={inputCls + " mt-1.5 font-mono text-[13px] leading-relaxed resize-y"}
                        placeholder={"## Heading\n\nParagraph text with **bold** and *italic*.\n\n- bullet\n- bullet\n\n[link](https://example.com)"}
                        onChange={(e) => setSecForm({ ...secForm, content: e.target.value })} />
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Supports headings (<code>##</code>), <code>**bold**</code>,{" "}
                        <code>*italic*</code>, bullet and numbered lists, and{" "}
                        <code>[links](url)</code>. Raw HTML is escaped, not rendered.
                      </p>
                    </>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort Order</label>
                  <input type="number" value={secForm.sort_order ?? 0} className={inputCls + " mt-1.5"}
                    onChange={(e) => setSecForm({ ...secForm, sort_order: Number(e.target.value) })} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle
                    checked={secForm.is_active ?? true}
                    onChange={(v) => setSecForm({ ...secForm, is_active: v })}
                    label="Active"
                    hint="Inactive sections are drafts and appear nowhere."
                  />
                  <Toggle
                    checked={Boolean(secForm.is_public)} danger
                    onChange={(v) => setSecForm({ ...secForm, is_public: v })}
                    label="Public"
                    hint={current?.is_public
                      ? "Readable by anyone on the internet once active."
                      : "Has no effect until this document itself is published."}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
                <button onClick={() => { setSecForm(null); setPreview(false); }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-white/5">
                  Cancel
                </button>
                <button onClick={saveSection} disabled={saving}
                  className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                  {saving ? "Saving…" : "Save Section"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
