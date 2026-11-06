"use client";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const statuses = [
    { value: "all", label: "All statuses" },
    { value: "waiting", label: "Waiting for review" },
    { value: "returned", label: "Changes requested" },
    { value: "draft", label: "Draft" },
    { value: "approved", label: "Approved" },
    { value: "none", label: "No plan yet" },
] as const;

const sorts = [
    { value: "review", label: "Needs review first" },
    { value: "name", label: "Name: A to Z" },
    { value: "name-desc", label: "Name: Z to A" },
    { value: "submitted", label: "Recently submitted" },
] as const;

export type RosterQuery = {
    term: string;
    q: string;
    status: string;
    sort: string;
};

export function RosterControls({
    query,
    terms,
}: {
    query: RosterQuery;
    terms: Array<{ id: string; label: string }>;
}) {
    const router = useRouter();
    const [search, setSearch] = useState(query.q);
    const [syncedQuery, setSyncedQuery] = useState(query.q);
    if (syncedQuery !== query.q) {
        setSyncedQuery(query.q);
        setSearch(query.q);
    }

    function visit(next: Partial<RosterQuery>, page = 1) {
        const merged = { ...query, ...next };
        const params = new URLSearchParams();
        if (merged.term) params.set("term", merged.term);
        if (merged.q.trim()) params.set("q", merged.q.trim());
        if (merged.status !== "all") params.set("status", merged.status);
        if (merged.sort !== "review") params.set("sort", merged.sort);
        if (page > 1) params.set("page", String(page));
        const text = params.toString();
        router.replace(text ? `/advisor/students?${text}` : "/advisor/students");
    }

    useEffect(() => {
        if (search === query.q) return;
        const handle = window.setTimeout(() => visit({ q: search }), 300);
        return () => window.clearTimeout(handle);
        // visit is recreated each render; the debounce only tracks the typed search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const filtered = query.q.trim() !== "" || query.status !== "all" || query.sort !== "review";
    const statusLabel = statuses.find((item) => item.value === query.status)?.label ?? "All statuses";
    const sortLabel = sorts.find((item) => item.value === query.sort)?.label ?? "Needs review first";
    const termLabel = terms.find((term) => term.id === query.term)?.label ?? "Term";

    const triggerClass = "mt-2 w-full *:data-[slot=select-value]:line-clamp-none! *:data-[slot=select-value]:overflow-visible!";

    return (
        <div className="flex flex-wrap gap-4">
            <div className="min-w-[220px] flex-1">
                <Label htmlFor="roster-term">Term</Label>
                <Select value={query.term} onValueChange={(value) => { if (value) visit({ term: value }); }}>
                    <SelectTrigger id="roster-term" className={triggerClass}>
                        <SelectValue>{termLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {terms.map((term) => (
                                <SelectItem key={term.id} value={term.id}>{term.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="min-w-[220px] flex-1">
                <Label htmlFor="roster-search">Search students</Label>
                <InputGroup className="mt-2">
                    <InputGroupAddon>
                        <MagnifyingGlassIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                        id="roster-search"
                        value={search}
                        placeholder="Name or student ID"
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") visit({ q: search });
                        }}
                    />
                </InputGroup>
            </div>
            <div className="min-w-[220px] flex-1">
                <Label htmlFor="roster-status">Plan status</Label>
                <Select value={query.status} onValueChange={(value) => { if (value) visit({ status: value }); }}>
                    <SelectTrigger id="roster-status" className={triggerClass}>
                        <SelectValue>{statusLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {statuses.map((item) => (
                                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="min-w-[220px] flex-1">
                <Label htmlFor="roster-sort">Sort by</Label>
                <Select value={query.sort} onValueChange={(value) => { if (value) visit({ sort: value }); }}>
                    <SelectTrigger id="roster-sort" className={triggerClass}>
                        <SelectValue>{sortLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {sorts.map((item) => (
                                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            {filtered ? (
                <div className="w-full">
                    <Button type="button" variant="ghost" onClick={() => visit({ q: "", status: "all", sort: "review" })}>
                        Clear filters
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
