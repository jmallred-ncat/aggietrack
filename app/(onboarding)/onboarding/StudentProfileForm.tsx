"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { type CatalogYearsWithPrograms } from "@/lib/catalog";
import { formatProgramName } from "@/lib/program";
import type { User } from "@/lib/generated/prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowCounterClockwiseIcon, MagnifyingGlassIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { createStudentProfileAction, searchProgramsAction } from "./actions";

const profileSchema = z.object({
    programId: z.string().min(1, { message: "Program is required" }),
    catalogYearId: z.string().min(1, { message: "Catalog year is required" }),
    bannerId: z.string().optional(),
});

export function StudentProfileForm({ user }: { user: User }) {
    const [actionError, setActionError] = useState<string | null>(null);
    const form = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            programId: "",
            catalogYearId: "",
            bannerId: "",
        },
        mode: "onChange",
        reValidateMode: "onChange",
    });

    const programId = form.watch("programId");

    const [searchQuery, setSearchQuery] = useState<string>("");
    const [programs, setPrograms] = useState<CatalogYearsWithPrograms>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    const catalogYears = programs.find((program) => program.id === programId)?.catalogYears ?? [];

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsSearching(true);
            const hits = await searchProgramsAction(debouncedSearchQuery);
            if (!cancelled) {
                setPrograms(hits);
            }
            setIsSearching(false);
        })();
        return () => { cancelled = true; };
    }, [debouncedSearchQuery]);

    const showSearching =
        Boolean(searchQuery.trim()) &&
        (searchQuery !== debouncedSearchQuery || isSearching);

    const { isSubmitting } = form.formState;
    const catalogYearId = form.watch("catalogYearId");
    const canSubmit =
        !isSubmitting &&
        Boolean(programId) &&
        Boolean(catalogYearId) &&
        catalogYears.length > 0;

    const onSubmit = async (data: z.infer<typeof profileSchema>) => {
        const { error } = await createStudentProfileAction({
            catalogYearId: data.catalogYearId,
            bannerId: data.bannerId,
        });

        if (error) {
            setActionError(error);
        }
    };

    const resetProgram = () => {
        form.resetField("programId", { keepDirty: false, keepError: false, keepTouched: false, defaultValue: "" });
        form.resetField("catalogYearId", { keepDirty: false, keepError: false, keepTouched: false, defaultValue: "" });
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-screen-lg space-y-12 mx-auto flex-1 flex flex-col w-full">
            {actionError && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionError}</AlertDescription>
                    <AlertAction>
                        <Button variant="outline" size="sm" onClick={() => setActionError(null)}>Dismiss</Button>
                    </AlertAction>
                </Alert>
            )}
            <FieldSet>
                <FieldGroup className="not-typeset grid sm:grid-cols-2">
                    <Controller control={form.control} name="bannerId" render={({ field }) => (
                        <Field orientation={"vertical"}>
                            <FieldLabel htmlFor={field.name}>
                                Banner ID
                            </FieldLabel>
                            <FieldDescription>
                                This can be found on Aggie Access Online.
                            </FieldDescription>
                            <Input type="text" {...field} placeholder="Optional" />

                        </Field>
                    )} />
                </FieldGroup>
            </FieldSet>
            <FieldGroup className="space-y-12">
                <FieldSet className="not-typeset">
                    <div className="flex-col flex">
                        <div className="flex items-center justify-between gap-4 !mb-2">
                            <div>
                                <FieldLegend variant="label" className="not-typeset mb-0">
                                    Program
                                </FieldLegend>
                            </div>
                            {programId && (
                                <Button type="button" variant="ghost" size={"icon-sm"} onClick={resetProgram}>
                                    <ArrowCounterClockwiseIcon className="text-xs" />
                                </Button>
                            )}
                        </div>
                        <InputGroup className="flex-1 w-full">
                            <InputGroupAddon>
                                <MagnifyingGlassIcon size={16} />
                            </InputGroupAddon>
                            <InputGroupInput type="text" placeholder="Search available programs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </InputGroup>
                    </div>

                    {programs.length > 0 ? (
                        <Controller control={form.control} name="programId" render={({ field }) => (
                            <RadioGroup {...field} className={"grid gap-2 sm:grid-cols-2 mt-2"}>
                                {programs.map((program) => (
                                    <FieldLabel htmlFor={program.id} key={program.id}>
                                        <Field orientation="horizontal">
                                            <FieldContent>
                                                <FieldTitle>{formatProgramName(program)}</FieldTitle>
                                                <FieldDescription>
                                                    {program.department.abbreviation} · {program.totalCredits} Credits
                                                </FieldDescription>
                                            </FieldContent>
                                            <RadioGroupItem value={program.id} id={program.id} />
                                        </Field>
                                    </FieldLabel>
                                ))}

                            </RadioGroup>
                        )} />
                    ) : (
                        <Empty className="col-span-full border border-dashed">
                            <EmptyHeader>
                                {showSearching && (
                                    <EmptyMedia variant="icon">
                                        <SpinnerIcon className="animate-spin" aria-hidden="true" />
                                    </EmptyMedia>
                                )}
                                <EmptyTitle>{isSearching ? "Searching" : "No Programs"}</EmptyTitle>
                                <EmptyDescription>
                                    {!searchQuery.trim()
                                        ? "Try searching for a program."
                                        : isSearching
                                            ? `Searching for “${searchQuery.trim()}”...`
                                            : `No programs found for “${searchQuery.trim()}”.`}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}


                </FieldSet>

                <FieldSet className="not-typeset">
                    <FieldLegend variant="label">
                        Catalog Year
                    </FieldLegend>
                    <FieldDescription>
                        The catalog year will be used to calculate your progress towards your degree.
                    </FieldDescription>
                    <Controller control={form.control} name="catalogYearId" render={({ field }) => (
                        <RadioGroup {...field} id={field.name} className={"grid gap-2 sm:grid-cols-2 md:grid-cols-3 mt-1"}>
                            {catalogYears.length > 0 ? catalogYears.map((catalogYear) => (
                                <FieldLabel htmlFor={catalogYear.id} key={catalogYear.id}>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>{catalogYear.year}</FieldTitle>
                                        </FieldContent>
                                        <RadioGroupItem value={catalogYear.id} id={catalogYear.id} />
                                    </Field>
                                </FieldLabel>
                            )) : (
                                <Empty className="col-span-full border border-dashed">
                                    <EmptyHeader>
                                        <EmptyTitle>Select A Program</EmptyTitle>
                                        <EmptyDescription>Available catalog years will be shown here once a program is selected.</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </RadioGroup>
                    )} />
                </FieldSet>
            </FieldGroup>

            <FieldGroup className="mt-auto w-full items-center flex justify-end">
                <Button type="submit" className={"w-full md:w-auto"} disabled={!canSubmit}>Create Student Profile</Button>
            </FieldGroup>
        </form >
    )
}