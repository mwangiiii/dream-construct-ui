import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
}

export interface PMVendorFill {
  vendorName:       string;
  totalAmount:      number;
  notes:            string;
  pricePerUnit?:    number;   // first line item's unit price
  firstDescription?: string; // first material name
  firstQty?:        number;  // first material quantity
  firstUnit?:       string;  // first material unit
}

interface PMVendor {
  id:               string;
  name:             string;
  totalAmount:      number;
  materialsNote:    string;
  pricePerUnit:     number;
  firstDescription: string;
  firstQty:         number;
  firstUnit:        string;
}

interface VendorSelectProps {
  value: string | null;
  onChange: (companyId: string) => void;
  onSelect?: (vendor: Vendor | null) => void;
  onPMVendorSelect?: (fill: PMVendorFill) => void;
  projectId?: string | null;
  /** When true, only shows vendors from the project's PM $ section (tender_companies).
   *  The general companies master list is hidden entirely. */
  pmOnly?: boolean;
  placeholder?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const selectCls =
  "w-full px-3 py-2.5 rounded-xl text-sm border text-foreground focus:outline-none " +
  "focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all " +
  "appearance-none pr-10 bg-[hsl(var(--background))] border-white/10 " +
  "[&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground [color-scheme:dark]";

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

const PM_PREFIX = "pm::";

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function VendorSelect({
  value,
  onChange,
  onSelect,
  onPMVendorSelect,
  projectId,
  pmOnly = false,
  placeholder = "— Select vendor —",
  label,
  hint,
  disabled = false,
  required = false,
}: VendorSelectProps) {
  const [vendors,    setVendors]    = useState<Vendor[]>([]);
  const [pmVendors,  setPMVendors]  = useState<PMVendor[]>([]);
  const [loading,    setLoading]    = useState(!pmOnly); // pmOnly skips companies load
  const [error,      setError]      = useState<string | null>(null);
  const [displayVal, setDisplayVal] = useState<string>(value ?? "");

  // Sync displayVal when external value changes (unless we're showing a PM selection)
  useEffect(() => {
    if (!displayVal.startsWith(PM_PREFIX)) {
      setDisplayVal(value ?? "");
    }
  }, [value]);

  // Load companies master list — skipped entirely when pmOnly=true
  useEffect(() => {
    if (pmOnly) { setVendors([]); setLoading(false); return; }
    supabase
      .from("companies")
      .select("id,name,legal_name,tax_id,phone,email,city")
      .order("name", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else     setVendors((data ?? []) as Vendor[]);
        setLoading(false);
      });
  }, [pmOnly]);

  // Load PM vendors for the selected project
  useEffect(() => {
    if (!projectId) { setPMVendors([]); return; }

    supabase
      .from("project_financials")
      .select(`
        total_price,
        price_per_unit,
        material_name,
        material_quantity,
        material_unit,
        tender_company_id,
        tender_company:tender_companies(id, name, contact_email, contact_phone)
      `)
      .eq("project_id", projectId)
      .not("tender_company_id", "is", null)
      .then(({ data, error: err }) => {
        if (err || !data) return;

        type GroupItem = { name: string; qty: number; unit: string; total: number; pricePerUnit: number };
        const grouped: Record<string, { name: string; items: GroupItem[]; total: number }> = {};

        for (const row of data as any[]) {
          const tc = row.tender_company;
          if (!tc) continue;
          if (!grouped[tc.id]) grouped[tc.id] = { name: tc.name, items: [], total: 0 };
          grouped[tc.id].total += Number(row.total_price) || 0;
          if (row.material_name) {
            grouped[tc.id].items.push({
              name:         row.material_name,
              qty:          Number(row.material_quantity) || 0,
              unit:         row.material_unit || "units",
              total:        Number(row.total_price) || 0,
              pricePerUnit: Number(row.price_per_unit) || 0,
            });
          }
        }

        const pm: PMVendor[] = Object.entries(grouped).map(([id, g]) => {
          const first = g.items[0];
          const lines = g.items.map(
            i => `• ${i.qty} ${i.unit} of ${i.name} @ KES ${i.pricePerUnit.toLocaleString("en-KE")}/unit = KES ${i.total.toLocaleString("en-KE")}`
          );
          const notes =
            `Materials ordered from ${g.name}:\n` +
            lines.join("\n") +
            `\n\nTotal: KES ${g.total.toLocaleString("en-KE")}`;
          return {
            id,
            name:             g.name,
            totalAmount:      g.total,
            materialsNote:    notes,
            pricePerUnit:     first?.pricePerUnit ?? 0,
            firstDescription: first?.name ?? "",
            firstQty:         first?.qty ?? 0,
            firstUnit:        first?.unit ?? "units",
          };
        });

        setPMVendors(pm);
      });
  }, [projectId]);

  const selectedVendor = vendors.find(v => v.id === value) ?? null;
  const selectedPM     = displayVal.startsWith(PM_PREFIX)
    ? pmVendors.find(v => v.id === displayVal.slice(PM_PREFIX.length)) ?? null
    : null;

  const handleChange = (val: string) => {
    setDisplayVal(val);
    if (val.startsWith(PM_PREFIX)) {
      const pmId = val.slice(PM_PREFIX.length);
      const pm   = pmVendors.find(v => v.id === pmId);
      if (pm && onPMVendorSelect) {
        onPMVendorSelect({
          vendorName:       pm.name,
          totalAmount:      pm.totalAmount,
          notes:            pm.materialsNote,
          pricePerUnit:     pm.pricePerUnit,
          firstDescription: pm.firstDescription,
          firstQty:         pm.firstQty,
          firstUnit:        pm.firstUnit,
        });
      }
      onChange(""); // clear vendor_id — PM vendors are not in companies table
      if (onSelect) onSelect(null);
    } else {
      onChange(val);
      if (onSelect) {
        const v = vendors.find(v => v.id === val) ?? null;
        onSelect(v);
      }
    }
  };

  return (
    <Field label={label} hint={hint} required={required}>
      <div className="flex flex-col gap-2">
        <div className="relative">
          <select
            value={displayVal}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled || loading}
            className={selectCls + (disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer")}
          >
            <option value="">
              {loading
                ? "Loading vendors…"
                : pmOnly && pmVendors.length === 0 && projectId
                  ? "— No vendors found in PM $ section for this project —"
                  : placeholder}
            </option>

            {/* PM vendors — always shown when available */}
            {pmVendors.length > 0 && (
              pmOnly
                ? pmVendors.map(pm => (
                    <option key={pm.id} value={PM_PREFIX + pm.id}>
                      {pm.name} — KES {pm.totalAmount.toLocaleString("en-KE")}
                    </option>
                  ))
                : (
                  <optgroup label="── Project Vendors (from PM) ──">
                    {pmVendors.map(pm => (
                      <option key={pm.id} value={PM_PREFIX + pm.id}>
                        {pm.name} — KES {pm.totalAmount.toLocaleString("en-KE")}
                      </option>
                    ))}
                  </optgroup>
                )
            )}

            {/* All companies — hidden when pmOnly */}
            {!pmOnly && vendors.length > 0 && (
              pmVendors.length > 0
                ? (
                  <optgroup label="── All Vendors ──">
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </optgroup>
                )
                : vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))
            )}
          </select>
          <SelectChevron />
        </div>

        {error && (
          <div className="text-xs text-rose-400 italic">⚠️ {error}</div>
        )}

        {/* Info row for selected PM vendor */}
        {selectedPM && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] uppercase tracking-widest font-semibold text-primary">From PM</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-medium text-foreground">{selectedPM.name}</span>
            </div>
            <div className="text-muted-foreground/80 leading-relaxed whitespace-pre-line text-[11px]">
              {selectedPM.materialsNote}
            </div>
          </div>
        )}

        {/* Info row for selected company vendor */}
        {selectedVendor && !selectedPM && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
            {selectedVendor.legal_name && selectedVendor.legal_name !== selectedVendor.name && (
              <span className="text-foreground/70">{selectedVendor.legal_name}</span>
            )}
            {selectedVendor.tax_id && (
              <>
                <span className="text-white/15">·</span>
                <span className="font-mono text-primary/70">Tax ID: {selectedVendor.tax_id}</span>
              </>
            )}
            {selectedVendor.phone && (
              <>
                <span className="text-white/15">·</span>
                <span>{selectedVendor.phone}</span>
              </>
            )}
            {selectedVendor.city && (
              <>
                <span className="text-white/15">·</span>
                <span>{selectedVendor.city}</span>
              </>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
