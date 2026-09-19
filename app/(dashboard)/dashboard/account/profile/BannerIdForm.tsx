"use client";

import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { toast } from "@/components/ui/toast";
import type { User } from "@/lib/generated/prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { updateBannerId } from "./actions";

const schema = z.object({
    bannerId: z.string().min(1),
});

export default function BannerIdForm({ user, bannerId = "" }: { user: User, bannerId: string }) {
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            bannerId: bannerId,
        },
    });

    async function onSubmit(data: z.infer<typeof schema>) {
        const { success, error } = await updateBannerId(user.id, data.bannerId);
        if (!success) {
            toast.add({
                title: "Error updating banner ID",
                description: error,
            });
        } else {
            toast.add({
                title: "Banner ID updated successfully",
                description: "Your banner ID has been updated successfully",
            });
            form.reset({ bannerId: data.bannerId });
        }
    }

    const { isSubmitting, isDirty } = form.formState;
    const bannerIdValue = form.watch("bannerId");
    const canSubmit = !isSubmitting && isDirty && bannerIdValue.trim().length > 0;;



    return (
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup className="flex items-start gap-x-2 flex-row">
                <Controller
                    control={form.control}
                    name="bannerId"
                    render={({ field }) => (
                        <Field className="w-auto">
                            <InputGroup className="max-w-xs">
                                <InputGroupInput {...field} />

                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton type="submit" disabled={!canSubmit}>Save</InputGroupButton>
                                </InputGroupAddon>
                            </InputGroup>
                            <FieldDescription className="max-w-prose text-balance leading-tight text-xs">Please be sure to use your correct banner ID. This could prevent other students from creating an account.</FieldDescription>
                        </Field>
                    )}
                />
            </FieldGroup>
        </form>
    );
}