"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { authReactClient } from "@/lib/auth-client";
import { cn } from "cn";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    password: z.string().min(8, "Passwords must be at least 8 characters long"),
    verifyPassword: z.string().min(8, "Passwords must be at least 8 characters long"),
}).refine((data) => data.password === data.verifyPassword, {
    message: "The passwords do not match",
    path: ["verifyPassword"],
});

type FormSchema = z.infer<typeof formSchema>;

export default function ResetPasswordForm({
    token,
    error,
}: {
    token?: string;
    error?: string;
}) {
    const [passwordType, setPasswordType] = useState<"password" | "text">("password");
    const [verifyPasswordType, setVerifyPasswordType] = useState<"password" | "text">("password");
    const [updated, setUpdated] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const form = useForm<FormSchema>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            password: "",
            verifyPassword: "",
        },
        mode: "onSubmit",
        reValidateMode: "onBlur",
    });

    const linkInvalid = Boolean(error) || !token;

    async function onSubmit(values: FormSchema) {
        if (!token) {
            return;
        }

        setSubmitError(null);
        const { error: resetError } = await authReactClient.resetPassword({
            newPassword: values.password,
            token,
        });

        if (resetError) {
            setSubmitError(resetError.message ?? "That link is dead. Request a new one.");
            return;
        }

        setUpdated(true);
    }

    if (updated) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>You&apos;re set.</CardTitle>
                        <CardDescription>
                            The new password is live. Log in up top.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Link href="/" className={cn(buttonVariants(), "w-full")}>
                            Back home
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (linkInvalid) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>That link is dead.</CardTitle>
                        <CardDescription>
                            It expired, or it was already used. Request a new one.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Link href="/reset" className={cn(buttonVariants(), "w-full")}>
                            Request a new link
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Set a new password</CardTitle>
                    <CardDescription>
                        Eight characters at least. Then you&apos;re back in.
                    </CardDescription>
                </CardHeader>
                <form id="new-password-form" onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent>
                        <FieldGroup>
                            <Controller
                                name="password"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>New password</FieldLabel>
                                        <InputGroup>
                                            <InputGroupInput
                                                {...field}
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="New password"
                                                autoComplete="new-password"
                                                type={passwordType}
                                            />
                                            <InputGroupButton tabIndex={-1} onClick={() => setPasswordType((prev) => prev === "password" ? "text" : "password")}>
                                                {passwordType === "text" ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
                                            </InputGroupButton>
                                        </InputGroup>
                                        {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="verifyPassword"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>Verify password</FieldLabel>
                                        <InputGroup>
                                            <InputGroupInput
                                                {...field}
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="Verify password"
                                                autoComplete="new-password"
                                                type={verifyPasswordType}
                                            />
                                            <InputGroupButton tabIndex={-1} onClick={() => setVerifyPasswordType((prev) => prev === "password" ? "text" : "password")}>
                                                {verifyPasswordType === "text" ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
                                            </InputGroupButton>
                                        </InputGroup>
                                        {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                                    </Field>
                                )}
                            />
                            {submitError && <FieldError errors={[{ message: submitError }]} />}
                        </FieldGroup>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" form="new-password-form" className="w-full" disabled={form.formState.isSubmitting}>
                            Update password
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
