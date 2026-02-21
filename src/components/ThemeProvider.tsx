"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Available color palettes
export const PALETTES = {
    "blue-indigo": {
        label: "Blue / Indigo",
        colors: {
            50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc",
            400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca",
            800: "#3730a3", 900: "#312e81",
        },
    },
    "teal": {
        label: "Teal",
        colors: {
            50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4",
            400: "#2dd4bf", 500: "#0d9488", 600: "#0f766e", 700: "#115e59",
            800: "#134e4a", 900: "#042f2e",
        },
    },
    "blue": {
        label: "Blue",
        colors: {
            50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd",
            400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8",
            800: "#1e40af", 900: "#1e3a8a",
        },
    },
    "violet": {
        label: "Violet",
        colors: {
            50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd",
            400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9",
            800: "#5b21b6", 900: "#4c1d95",
        },
    },
    "emerald": {
        label: "Emerald",
        colors: {
            50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
            400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857",
            800: "#065f46", 900: "#064e3b",
        },
    },
    "rose": {
        label: "Rose",
        colors: {
            50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af",
            400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c",
            800: "#9f1239", 900: "#881337",
        },
    },
} as const;

export type PaletteKey = keyof typeof PALETTES;

const PaletteContext = createContext<{
    palette: PaletteKey;
    setPalette: (p: PaletteKey) => void;
}>({ palette: "blue-indigo", setPalette: () => { } });

export function usePalette() {
    return useContext(PaletteContext);
}

function applyPalette(key: PaletteKey) {
    const colors = PALETTES[key].colors;
    const root = document.documentElement;
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
    for (const shade of shades) {
        root.style.setProperty(`--color-primary-${shade}`, colors[shade]);
    }
}

export function PaletteProvider({ children }: { children: ReactNode }) {
    const [palette, setPaletteState] = useState<PaletteKey>("blue-indigo");

    useEffect(() => {
        const saved = localStorage.getItem("cpbq-palette") as PaletteKey | null;
        if (saved && saved in PALETTES) {
            setPaletteState(saved);
            applyPalette(saved);
        }
    }, []);

    const setPalette = (p: PaletteKey) => {
        setPaletteState(p);
        localStorage.setItem("cpbq-palette", p);
        applyPalette(p);
    };

    return (
        <PaletteContext.Provider value={{ palette, setPalette }}>
            {children}
        </PaletteContext.Provider>
    );
}
