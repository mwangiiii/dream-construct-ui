import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────
// Vendors are sourced from the existing `companies` master table.

export interface Vendor {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
}

interface VendorSelectProps {
  value: string | null;            // company id (UUID)
  onChange: (companyId: string) => void;
  onSelect?: (vendor: Vendor | null) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const selectCls =
  "w-full px-3 py-2 rounded-xl text-sm border text-foreground focus:outline-none " +
  "focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all " +
  "appearance-none pr-10 font-medium bg-[#111318] border-white/10 [color-scheme:dark]";

const SelectChevron = () => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
);

function Field({ label, hint, children, required }: {
  label?: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  if (!label) return <>{children}</>;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/60 italic">{hint}</span>}
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function VendorSelect({
  value,
  onChange,
  onSelect,
  placeholder = "— Select vendor —",
  label,
  hint,
  disabled = false,
  required = false,
}: VendorSelectProps) {
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("companies")
      .select("id,name,legal_name,tax_id,phone,email,city")
      .order("name", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); }
        else     { setVendors((data ?? []) as Vendor[]); }
        setLoading(false);
      });
  }, []);

  const selected = vendors.find(v => v.id === value) ?? null;

  const handleChange = (companyId: string) => {
    onChange(companyId);
    if (onSelect) {
      const v = vendors.find(v => v.id === companyId) ?? null;
      onSelect(v);
    }
  };

  return (
    <Field label={label} hint={hint} required={required}>
      <div className="flex flex-col gap-2">
        <div className="relative">
          <select
            value={value ?? ""}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled || loading}
            className={selectCls + (disabled ? " opacity-50 cursor-not-allowed" : "")}
          >
            <option value="">{loading ? "Loading vendors…" : placeholder}</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <SelectChevron />
        </div>

        {error && (
          <div className="text-xs text-rose-400 italic">⚠️ {error}</div>
        )}

        {selected && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
            {selected.legal_name && selected.legal_name !== selected.name && (
              <span className="text-foreground/70">{selected.legal_name}</span>
            )}
            {selected.tax_id && (
              <>
                <span className="text-white/15">·</span>
                <span className="font-mono text-primary/70">Tax ID: {selected.tax_id}</span>
              </>
            )}
            {selected.phone && (
              <>
                <span className="text-white/15">·</span>
                <span>{selected.phone}</span>
              </>
            )}
            {selected.city && (
              <>
                <span className="text-white/15">·</span>
                <span>{selected.city}</span>
              </>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
