import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface SearchBoxProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Debounce delay before propagating to onChange. */
  debounceMs?: number;
}

/**
 * Self-contained search input that buffers keystrokes locally and only
 * notifies the parent after a short debounce. Keeps the input snappy
 * even when the parent triggers expensive filtering on every change.
 */
export function SearchBox({
  value,
  onChange,
  placeholder = "Search…",
  debounceMs = 250,
}: SearchBoxProps) {
  const [local, setLocal] = useState(value);
  const debounced = useDebouncedValue(local, debounceMs);

  // Sync external resets (e.g., "Clear filters") down into local state.
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Push debounced value up.
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="relative w-full sm:w-72">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 3.42 9.84l3.12 3.12a.75.75 0 0 0 1.06-1.06l-3.12-3.12A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label="Search leads by name or email"
        className="input pl-9"
      />
    </div>
  );
}
