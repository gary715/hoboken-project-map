"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type HobokenAddress = { a: string; lat: number; lng: number };

let CACHE: HobokenAddress[] | null = null;

async function loadAddresses(): Promise<HobokenAddress[]> {
  if (CACHE) return CACHE;
  const res = await fetch("/hoboken-addresses.json", { cache: "force-cache" });
  CACHE = (await res.json()) as HobokenAddress[];
  return CACHE;
}

export type AutocompleteValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing a Hoboken address…",
  className = "",
  required = false,
}: {
  value: string;
  onChange: (v: AutocompleteValue) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const [all, setAll] = useState<HobokenAddress[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAddresses().then(setAll);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    // Prefix scoring: address starting with q beats containing q
    const starts: HobokenAddress[] = [];
    const contains: HobokenAddress[] = [];
    for (const a of all) {
      const lc = a.a.toLowerCase();
      if (lc.startsWith(q)) starts.push(a);
      else if (lc.includes(q)) contains.push(a);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [value, all]);

  function pick(s: HobokenAddress) {
    onChange({ address: s.a, lat: s.lat, lng: s.lng });
    setOpen(false);
    setHighlight(0);
    inputRef.current?.blur();
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        className="w-full border rounded px-2 py-1.5 text-sm"
        placeholder={placeholder}
        value={value}
        required={required}
        autoComplete="off"
        onChange={(e) => {
          onChange({ address: e.target.value, lat: null, lng: null });
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded shadow-lg max-h-72 overflow-auto text-sm">
          {suggestions.map((s, i) => (
            <li
              key={s.a}
              className={`px-2 py-1.5 cursor-pointer ${
                i === highlight ? "bg-blue-100" : "hover:bg-gray-100"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {s.a}
            </li>
          ))}
        </ul>
      )}
      {all.length === 0 && (
        <div className="text-[10px] text-gray-400 mt-0.5">Loading address book…</div>
      )}
    </div>
  );
}
