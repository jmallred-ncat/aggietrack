"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeLock({ theme }: { theme: "light" | "dark" }) {
    const { setTheme } = useTheme();
    useEffect(() => {
        setTheme(theme);
    }, [setTheme, theme]);
    return null;
}
