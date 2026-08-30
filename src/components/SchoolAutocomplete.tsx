import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/api/client';

export type CanonicalSchool = {
  id: string;
  name: string;
  city?: string;
  state?: string;
};

type SchoolSearchResponse = CanonicalSchool[] | { schools?: CanonicalSchool[] };

const DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 1;
const LOAD_ERROR = 'Unable to load schools. Please try again.';

function parseSchools(data: SchoolSearchResponse): CanonicalSchool[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data.schools) ? data.schools : [];
}

function schoolSubtitle(school: CanonicalSchool): string {
  return [school.city, school.state].filter(Boolean).join(', ');
}

export type SchoolAutocompleteProps = {
  value: CanonicalSchool | null;
  onChange: (school: CanonicalSchool | null) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  error?: string | null;
};

type MenuPos = { top: number; left: number; width: number; maxHeight: number };

function measureMenu(anchor: HTMLElement | null): MenuPos | null {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
  const spaceBelow = viewportHeight - (rect.bottom - viewportOffsetTop) - 12;
  const spaceAbove = rect.top - viewportOffsetTop - 12;
  const placeAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
  const available = placeAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.min(280, Math.max(140, available));
  const top = placeAbove
    ? rect.top + window.scrollY - maxHeight - 6
    : rect.bottom + window.scrollY + 6;
  return {
    top,
    left: rect.left + window.scrollX,
    width: rect.width,
    maxHeight,
  };
}

export function SchoolAutocomplete({
  value,
  onChange,
  placeholder = 'Search for a school',
  disabled = false,
  id,
  required = false,
  error = null,
}: SchoolAutocompleteProps) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<CanonicalSchool[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const requestIdRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedExact = Boolean(value && query.trim() === value.name);
  const canSearch = query.trim().length >= MIN_QUERY_LEN && !selectedExact;
  const showMenu = focused && canSearch && !disabled;

  const updateMenuPos = useCallback(() => {
    setMenuPos(measureMenu(inputWrapRef.current));
  }, []);

  useEffect(() => {
    setQuery(value?.name ?? '');
  }, [value?.id, value?.name]);

  useLayoutEffect(() => {
    if (!showMenu) return;
    updateMenuPos();
  }, [showMenu, results.length, loading, updateMenuPos]);

  useEffect(() => {
    if (!showMenu) return;
    const onReposition = () => updateMenuPos();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    window.visualViewport?.addEventListener('resize', onReposition);
    window.visualViewport?.addEventListener('scroll', onReposition);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
      window.visualViewport?.removeEventListener('resize', onReposition);
      window.visualViewport?.removeEventListener('scroll', onReposition);
    };
  }, [showMenu, updateMenuPos]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById('school-autocomplete-menu');
      if (menu?.contains(target)) return;
      setFocused(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    const handle = window.setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setLoadError(null);
      void (async () => {
        try {
          const res = await apiGet('/schools/search', { q: query.trim() }, { skipAuth: true });
          if (requestId !== requestIdRef.current) return;
          if (!res.ok) {
            setResults([]);
            setLoadError(LOAD_ERROR);
            return;
          }
          const data = (await res.json()) as SchoolSearchResponse;
          if (requestId !== requestIdRef.current) return;
          setResults(parseSchools(data));
          setLoadError(null);
        } catch {
          if (requestId !== requestIdRef.current) return;
          setResults([]);
          setLoadError(LOAD_ERROR);
        } finally {
          if (requestId === requestIdRef.current) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [query, canSearch]);

  const selectSchool = (school: CanonicalSchool) => {
    onChange(school);
    setQuery(school.name);
    setResults([]);
    setLoadError(null);
    setFocused(false);
    inputRef.current?.blur();
  };

  const clearSelection = () => {
    onChange(null);
    setQuery('');
    setResults([]);
    setLoadError(null);
    setFocused(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onFocus = () => {
    setFocused(true);
    window.setTimeout(() => {
      inputWrapRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      updateMenuPos();
    }, 250);
  };

  const menu = showMenu && menuPos && typeof document !== 'undefined'
    ? createPortal(
        <div
          id="school-autocomplete-menu"
          role="listbox"
          aria-label="Matching schools"
          style={{
            position: 'absolute',
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
            zIndex: 2147483000,
          }}
          className="overflow-y-auto rounded-xl border border-white/15 bg-[#121820] shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
        >
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Searching schools…
            </div>
          ) : null}
          {loadError ? (
            <p className="px-3 py-3 text-sm text-red-400">{loadError}</p>
          ) : null}
          {!loading && !loadError && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-white/55">No schools found</p>
          ) : null}
          {results.map((school) => (
            <button
              key={school.id}
              type="button"
              role="option"
              className="w-full text-left px-3 py-2.5 border-b border-white/5 last:border-b-0 active:bg-[#1d4ed8]/40"
              onPointerDown={(event) => {
                event.preventDefault();
                selectSchool(school);
              }}
            >
              <p className="text-sm font-medium text-white leading-snug">{school.name}</p>
              {schoolSubtitle(school) ? (
                <p className="text-[11px] text-white/45 mt-0.5">{schoolSubtitle(school)}</p>
              ) : null}
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={rootRef} className="relative">
      <div ref={inputWrapRef} className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="search"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-expanded={showMenu}
          aria-controls="school-autocomplete-menu"
          aria-autocomplete="list"
          className="font-medium pr-9"
          onFocus={onFocus}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            if (value && next.trim() !== value.name) onChange(null);
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={clearSelection}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear school"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>
      {loading && !showMenu ? (
        <p className="text-[11px] text-muted-foreground mt-1">Searching schools…</p>
      ) : null}
      {loadError && !showMenu ? (
        <p className="text-[11px] text-destructive mt-1">{loadError}</p>
      ) : null}
      {error ? <p className="text-[11px] text-destructive mt-1">{error}</p> : null}
      {menu}
    </div>
  );
}
