import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useState wrapper that persists to sessionStorage.
 * On mount, reads from sessionStorage. On change, writes to sessionStorage.
 * Falls back to initialValue if sessionStorage is empty or invalid.
 */
export function useSessionState<T>(
    key: string,
    initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
    // 1. Always initialize with initialValue to prevent hydration mismatch (SSR vs Client)
    const [value, setValue] = useState<T>(initialValue);
    const isMounted = useRef(false);

    // 2. Hydrate from sessionStorage on mount (client only)
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(key);
            if (stored !== null) {
                setValue(JSON.parse(stored) as T);
            }
        } catch {
            // Invalid JSON or sessionStorage error
        }
        // Mark as mounted after initial hydration
        isMounted.current = true;
    }, [key]);

    // 3. Persist to sessionStorage on subsequent changes
    useEffect(() => {
        if (!isMounted.current) return; // Skip persisting during initial render phase
        try {
            sessionStorage.setItem(key, JSON.stringify(value));
        } catch {
            // sessionStorage full or unavailable
        }
    }, [key, value]);

    return [value, setValue];
}
