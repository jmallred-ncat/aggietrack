"use client";

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

const PlanCrumbContext = createContext<string | null>(null);
const SetPlanCrumbContext = createContext<(label: string | null) => void>(() => {});

export function PlanCrumbProvider({
    initialLabel,
    children,
}: {
    initialLabel: string | null;
    children: ReactNode;
}) {
    const [label, setLabel] = useState(initialLabel);
    return (
        <SetPlanCrumbContext.Provider value={setLabel}>
            <PlanCrumbContext.Provider value={label}>
                {children}
            </PlanCrumbContext.Provider>
        </SetPlanCrumbContext.Provider>
    );
}

export function usePlanCrumb() {
    return useContext(PlanCrumbContext);
}

export function SetPlanCrumb({ label }: { label: string }) {
    const setLabel = useContext(SetPlanCrumbContext);
    useLayoutEffect(() => {
        setLabel(label);
        return () => setLabel(null);
    }, [label, setLabel]);
    return null;
}
