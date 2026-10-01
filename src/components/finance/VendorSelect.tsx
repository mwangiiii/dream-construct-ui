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
  /** project_financials.id — links the AP invoice to this PM commodity row. */
  pmFinancialId:    number;
  vendorName:       string;
  /** Amount for THIS commodity only — never the vendor's cross-commodity total. */
  totalAmount:      number;
  notes:            string;
  pricePerUnit:     number;
  commodityName:    string;
  commodityQty:     number;
  commodityUnit:    string;
}

// One PM commodity option = one project_financials row.
interface PMCommodity {
  financialId:  number;
  vendorId:     string;
  vendorName:   string;
  commodity:    string;
  qty:          number;
  unit:         string;
  pricePerUnit: number;
  totalPrice:   number;
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
  const [vendors,      setVendors]      = useState<Vendor[]>([]);
  const [pmCommodities, setPMCommodities] = useState<PMCommodity[]>([]);
  const [loading,      setLoading]      = useState(!pmOnly); // pmOnly skips companies load
  const [error,        setError]        = useState<string | null>(null);
  const [displayVal,   setDisplayVal]   = useState<string>(value ?? "");

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

  // Load PM commodities for the selected project.
  // NOTE: options are per-commodity (one project_financials row = one option).
  // We deliberately do NOT aggregate by vendor — a vendor supplying multiple
  // commodities appears once per commodity, each with its own amount. Real AP
  // invoices arrive per commodity/delivery, not as a vendor-level rollup.
  useEffect(() => {
    if (!projectId) { setPMCommodities([]); return; }

    supabase
      .from("project_financials")
      .select(`
        id,
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
      .order("tender_company_id", { ascending: true })
      .then(({ data, error: err }) => {
        if (err || !data) return;

        const rows: PMCommodity[] = [];
        for (const row of data as any[]) {
          const tc = row.tender_company;
          if (!tc || !row.material_name) continue;
          rows.push({
            financialId:  Number(row.id),
            vendorId:     tc.id,
            vendorName:   tc.name,
            commodity:    row.material_name,
            qty:          Number(row.material_quantity) || 0,
            unit:         row.material_unit || "units",
            pricePerUnit: Number(row.price_per_unit) || 0,
            totalPrice:   Number(row.total_price) || 0,
          });
        }

        setPMCommodities(rows);
      });
  }, [projectId]);

  const selectedVendor = vendors.find(v => v.id === value) ?? null;
  const selectedPM     = displayVal.startsWith(PM_PREFIX)
    ? pmCommodities.find(c => String(c.financialId) === displayVal.slice(PM_PREFIX.length)) ?? null
    : null;

  const handleChange = (val: string) => {
    setDisplayVal(val);
    if (val.startsWith(PM_PREFIX)) {
      const pmId = val.slice(PM_PREFIX.length);
      const pm   = pmCommodities.find(c => String(c.financialId) === pmId);
      if (pm && onPMVendorSelect) {
        const notes =
          `From PM · ${pm.vendorName}\n` +
          `• ${pm.qty} ${pm.unit} of ${pm.commodity} @ KES ${pm.pricePerUnit.toLocaleString("en-KE")}/unit\n` +
          `Total: KES ${pm.totalPrice.toLocaleString("en-KE")}`;
        onPMVendorSelect({
          pmFinancialId: pm.financialId,
          vendorName:    pm.vendorName,
          totalAmount:   pm.totalPrice,
          notes,
          pricePerUnit:  pm.pricePerUnit,
          commodityName: pm.commodity,
          commodityQty:  pm.qty,
          commodityUnit: pm.unit,
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
                : pmOnly && pmCommodities.length === 0 && projectId
                  ? "— No commodities found in PM $ section for this project —"
                  : placeholder}
            </option>

            {/* PM commodities — one option per (vendor + commodity) so each  */}
            {/* invoice targets a single commodity, never the vendor rollup.  */}
            {pmCommodities.length > 0 && (
              pmOnly
                ? pmCommodities.map(pm => (
                    <option key={pm.financialId} value={PM_PREFIX + pm.financialId}>
                      {pm.vendorName} — {pm.commodity} — KES {pm.totalPrice.toLocaleString("en-KE")}
                    </option>
                  ))
                : (
                  <optgroup label="── Project Commodities (from PM) ──">
                    {pmCommodities.map(pm => (
                      <option key={pm.financialId} value={PM_PREFIX + pm.financialId}>
                        {pm.vendorName} — {pm.commodity} — KES {pm.totalPrice.toLocaleString("en-KE")}
                      </option>
                    ))}
                  </optgroup>
                )
            )}

            {/* All companies — hidden when pmOnly */}
            {!pmOnly && vendors.length > 0 && (
              pmCommodities.length > 0
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

        {/* Info row for selected PM commodity */}
        {selectedPM && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[9px] uppercase tracking-widest font-semibold text-primary">From PM</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-medium text-foreground">{selectedPM.vendorName}</span>
              <span className="text-muted-foreground/40">→</span>
              <span className="font-medium text-foreground">{selectedPM.commodity}</span>
            </div>
            <div className="text-muted-foreground/80 leading-relaxed text-[11px]">
              {selectedPM.qty} {selectedPM.unit} @ KES {selectedPM.pricePerUnit.toLocaleString("en-KE")}/unit
              <span className="text-muted-foreground/40 mx-1">·</span>
              Total <span className="text-foreground font-medium">KES {selectedPM.totalPrice.toLocaleString("en-KE")}</span>
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
