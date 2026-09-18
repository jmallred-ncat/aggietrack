"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CatalogYearsWithPrograms } from "@/lib/catalog";
import type { User } from "@/lib/generated/prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowCounterClockwiseIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { createStudentProfileAction } from "./actions";

const profileSchema = z.object({
    programId: z.string().min(1, { message: "Program is required" }),
    catalogYearId: z.string().min(1, { message: "Catalog year is required" }),
    userId: z.string(),
    bannerId: z.string().optional(),
    advisorId: z.string().optional(),
    expectedGradTermId: z.string().nullable(),
});

export function StudentProfileForm({ user, programs }: { user: User, programs: CatalogYearsWithPrograms }) {
    const [actionError, setActionError] = useState<string | null>(null);
    const form = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            programId: "",
            catalogYearId: "",
            userId: user.id,
            bannerId: "",
            advisorId: "",
            expectedGradTermId: null,
        },
        mode: "onChange",
        reValidateMode: "onChange",
    });

    const programId = form.watch("programId");

    const catalogYears = programs.find((program) => program.id === programId)?.catalogYears ?? [];

    const { isValid, isSubmitting, isValidating } = form.formState;
    const canSubmit =
        isValid &&
        !isSubmitting &&
        !isValidating &&
        Boolean(programId) &&
        Boolean(form.watch("catalogYearId")) &&
        catalogYears.length > 0 &&
        programs.length > 0;

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
                            <Input type="text" {...field} placeholder="Optional" />
                            <FieldDescription>
                                This can be found on Aggie Access Online.
                            </FieldDescription>
                        </Field>
                    )} />

                    <Controller control={form.control} name="advisorId" render={({ field }) => (
                        <Field orientation={"vertical"}>
                            <FieldLabel htmlFor={field.name}>
                                Advisor
                            </FieldLabel>
                            <Input type="text" {...field} placeholder="John Doe... This will be a combobox with search" />
                            <FieldDescription>
                                Your advisor is assigned by your department. It can be found on Aggie Access Online.
                            </FieldDescription>
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
                            <InputGroupInput type="text" placeholder="Search available programs.... this doesn't work yet" />
                        </InputGroup>
                    </div>
                    <Controller control={form.control} name="programId" render={({ field }) => (
                        <RadioGroup {...field} className={"grid gap-2 sm:grid-cols-2 mt-2"}>
                            {programs.map((program) => (
                                <FieldLabel htmlFor={program.id} key={program.id}>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>{program.name}</FieldTitle>
                                            <FieldDescription>
                                                Sample Description
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value={program.id} id={program.id} />
                                    </Field>
                                </FieldLabel>
                            ))}

                        </RadioGroup>
                    )} />


                </FieldSet>

                <FieldSet className="not-typeset">
                    <FieldLegend variant="label">
                        Catalog Year
                    </FieldLegend>
                    <Controller control={form.control} name="catalogYearId" render={({ field }) => (
                        <RadioGroup {...field} id={field.name} className={"grid gap-2 sm:grid-cols-2 md:grid-cols-3 mt-1"}>
                            {catalogYears.length > 0 ? catalogYears.map((catalogYear) => (
                                <FieldLabel htmlFor={catalogYear.id} key={catalogYear.id}>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>{new Date(catalogYear.effectiveFrom).getFullYear()}</FieldTitle>
                                            <FieldDescription>
                                                Effective through {catalogYear.effectiveTo ? format(catalogYear.effectiveTo, "MMMM yyyy") : "TBD"}
                                            </FieldDescription>
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