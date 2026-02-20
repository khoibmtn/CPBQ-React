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
    const [value, setValue] = useState<T>(() => {
        if (typeof window === "undefined") return initialValue;
        try {
            const stored = sessionStorage.getItem(key);
            if (stored !== null) return JSON.parse(stored) as T;
        } catch {
            // Invalid JSON or sessionStorage error
        }
        return initialValue;
    });

    // Track if this is the initial mount to avoid writing the default back
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        try {
            sessionStorage.setItem(key, JSON.stringify(value));
        } catch {
            // sessionStorage full or unavailable
        }
    }, [key, value]);

    return [value, setValue];
}
