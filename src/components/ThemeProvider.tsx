"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
    theme: Theme;
    toggle: () => void;
}>({ theme: "dark", toggle: () => { } });

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>("dark");

    useEffect(() => {
        const saved = localStorage.getItem("cpbq-theme") as Theme | null;
        if (saved) setTheme(saved);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("cpbq-theme", theme);
    }, [theme]);

    const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    return (
        <ThemeContext.Provider value={{ theme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}
