import React, { useState, useRef, useEffect } from "react";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function Combobox({
  value,
  options,
  onChange,
  placeholder = "Select...",
}: ComboboxProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? placeholder;

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  function selectOption(optValue: string): void {
    onChange(optValue);
    setOpen(false);
    setSearch("");
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        e.preventDefault();
        break;
      case "ArrowUp":
        setHighlightIndex((i) => Math.max(i - 1, 0));
        e.preventDefault();
        break;
      case "Enter":
        if (filtered[highlightIndex]) {
          selectOption(filtered[highlightIndex].value);
        }
        e.preventDefault();
        break;
      case "Escape":
        setOpen(false);
        setSearch("");
        e.preventDefault();
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5
          text-sm text-white focus-within:border-accent transition-colors cursor-pointer
          flex items-center gap-2"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={open}
      >
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={selectedLabel}
            className="bg-transparent border-none outline-none text-white placeholder-surface-500 w-full p-0"
          />
        ) : (
          <span className="text-white flex-1">{selectedLabel}</span>
        )}
        <svg
          className={`w-4 h-4 text-surface-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-800 border border-surface-700 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-surface-500">No matches</div>
          ) : (
            filtered.map((opt, i) => (
              <div
                key={opt.value}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors
                  ${i === highlightIndex ? "bg-accent text-white" : "text-surface-300 hover:bg-surface-700 hover:text-white"}
                  ${opt.value === value ? "font-semibold" : ""}`}
                onClick={() => selectOption(opt.value)}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
