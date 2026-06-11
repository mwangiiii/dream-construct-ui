import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type COAFilterType = "all" | "bank" | "receivable" | "payable";
type ValueFieldType = "code" | "bank_name";

interface Account {
  id: number;
  account_code: string;
  account_name: string;
  bank_name: string;
  account_type: string;
  active: boolean;
}

interface COAAccountSelectProps {
  value: string | null;
  onChange: (value: string) => void;
  onSelect?: (account: Account | null) => void;
  filter?: COAFilterType;
  valueField?: ValueFieldType;
  placeholder?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
}

// ─── DESIGN TOKENS (match AP/AR/WIP/Invoice pages) ──────────────────────────

const selectCls =
  "w-full px-3 py-2.5 rounded-xl text-sm border text-foreground focus:outline-none " +
  "focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all " +
  "appearance-none pr-10 cursor-pointer bg-[hsl(var(--background))] border-white/10 " +
  "[&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground [color-scheme:dark]";

const SelectChevron = () => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
);

function Field({ label, hint, children, required }: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  if (!label) return <>{children}</>;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/60 italic">{hint}</span>}
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function COAAccountSelect({
  value,
  onChange,
  onSelect,
  filter = "all",
  valueField = "code",
  placeholder = "— Select account —",
  label,
  hint,
  disabled = false,
  required = false,
}: COAAccountSelectProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, bank_name, account_type, active")
          .eq("active", true)
          .order("account_code", { ascending: true });

        if (err) throw err;

        let filtered = (data ?? []) as Account[];

        // Apply filter based on type
        switch (filter) {
          case "bank":
            // Only accounts with a real bank_name (not 'N/A') — typically cash/bank accounts
            filtered = filtered.filter(a => a.bank_name && a.bank_name !== "N/A");
            break;
          case "receivable":
            // account_type = 'Receivable'
            filtered = filtered.filter(a => a.account_type === "Receivable");
            break;
          case "payable":
            // account_type = 'Payable'
            filtered = filtered.filter(a => a.account_type === "Payable");
            break;
          case "all":
          default:
            // No filter
            break;
        }

        setAccounts(filtered);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load accounts";
        setError(msg);
        console.error("COAAccountSelect error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [filter]);

  // Find the selected account for label display
  const selectedAccount = accounts.find(a => {
    if (valueField === "code") return a.account_code === value;
    if (valueField === "bank_name") return a.bank_name === value;
    return false;
  });

  const selectCurrent = selectCls + (disabled ? " opacity-50 cursor-not-allowed" : "");

  return (
    <Field label={label} hint={hint} required={required}>
      <div className="flex flex-col gap-2">
        {/* Select dropdown */}
        <div className="relative">
          <select
            value={value ?? ""}
            onChange={e => {
              onChange(e.target.value);
              if (onSelect) {
                const found = accounts.find(a =>
                  valueField === "code"
                    ? a.account_code === e.target.value
                    : a.bank_name === e.target.value
                );
                onSelect(found ?? null);
              }
            }}
            disabled={disabled || loading}
            className={selectCurrent}
          >
            <option value="">{placeholder}</option>
            {accounts.map(account => {
              const optionValue = valueField === "code" ? account.account_code : account.bank_name;
              const optionLabel = `${account.account_code} — ${account.account_name}`;
              return (
                <option key={account.id} value={optionValue}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
          <SelectChevron />
        </div>

        {/* Error state */}
        {error && (
          <div className="text-xs text-rose-400 italic">⚠️ {error}</div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-xs text-muted-foreground/60 italic">Loading accounts…</div>
        )}

        {/* Selected account info footer */}
        {selectedAccount && (
          <div className="text-xs text-muted-foreground/70">
            <span className="font-mono text-primary">{selectedAccount.account_code}</span> — {selectedAccount.account_name}
            {selectedAccount.bank_name && selectedAccount.bank_name !== "N/A" && (
              <>
                {" "}
                · <span className="text-cyan-400/70">{selectedAccount.bank_name}</span>
              </>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
