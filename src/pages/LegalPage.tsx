import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { renderMarkdown } from "@/lib/markdown";

// Public Terms of Service / Privacy Policy.
//
// Reachable anonymously: policy_categories and policies both carry an
// is_public flag and the RLS added in 20261125090000_public_legal_documents
// grants anon SELECT where the category is public and the section is public
// AND active. No session is required, which is the point — Login.tsx links
// here before anyone has signed in.

interface Section {
  id: string;
  title: string;
  content: string;
  sort_order: number;
}

interface LegalDoc {
  title: string;
  description: string | null;
  updated_at: string | null;
  sections: Section[];
}

export default function LegalPage({ slug }: { slug: string }) {
  const [doc, setDoc]         = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: cat, error: catErr } = await supabase
          .from("policy_categories")
          .select("id,title,description,updated_at")
          .eq("slug", slug)
          .eq("is_public", true)
          .maybeSingle();
        if (catErr) throw new Error(catErr.message);
        if (!cat) { if (!cancelled) setDoc(null); return; }

        const { data: sections, error: secErr } = await supabase
          .from("policies")
          .select("id,title,content,sort_order,updated_at")
          .eq("category_id", cat.id)
          .eq("is_public", true)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (secErr) throw new Error(secErr.message);

        // Show the most recent edit across the document, not the category row,
        // since editing a section is what actually changes what people read.
        const stamps = [cat.updated_at, ...(sections ?? []).map((s) => s.updated_at)]
          .filter(Boolean) as string[];
        const latest = stamps.sort().at(-1) ?? null;

        if (!cancelled) {
          setDoc({
            title: cat.title,
            description: cat.description,
            updated_at: latest,
            sections: (sections ?? []) as Section[],
          });
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-32 text-sm text-muted-foreground">
          <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <div className="py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-3">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Link to="/" className="text-primary hover:underline text-sm">Back to home</Link>
        </div>
      ) : !doc ? (
        <div className="py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-3">Not published yet</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            This document has not been published. If you need it, please contact us.
          </p>
          <div className="flex items-center justify-center gap-5 text-sm">
            <Link to="/contact" className="text-primary hover:underline">Contact us</Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground">Back to home</Link>
          </div>
        </div>
      ) : (
        <article>
          <header className="mb-10 pb-6 border-b border-border">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {doc.title}
            </h1>
            {doc.description && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                {doc.description}
              </p>
            )}
            {doc.updated_at && (
              <p className="text-xs text-muted-foreground/70 mt-4">
                Last updated{" "}
                {new Date(doc.updated_at).toLocaleDateString("en-KE", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            )}
          </header>

          {doc.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sections have been published for this document yet.
            </p>
          ) : (
            <div className="space-y-10">
              {doc.sections.map((s) => (
                <section key={s.id}>
                  <h2 className="text-xl font-semibold text-foreground mb-3">{s.title}</h2>
                  {/* Safe: renderMarkdown escapes all HTML before formatting,
                      so the only tags present are ones it emitted itself. */}
                  <div
                    className="text-sm text-muted-foreground leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(s.content) }}
                  />
                </section>
              ))}
            </div>
          )}

          <footer className="mt-14 pt-6 border-t border-border flex flex-wrap items-center gap-5 text-sm">
            <Link to="/terms" className="text-muted-foreground hover:text-foreground">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/contact" className="text-primary hover:underline ml-auto">
              Questions? Contact us
            </Link>
          </footer>
        </article>
      )}
    </div>
  );
}
