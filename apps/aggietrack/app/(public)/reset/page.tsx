"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authReactClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    email: z.email(),
});

type FormSchema = z.infer<typeof formSchema>;

export default function PasswordResetPage() {
    const [emailSent, setEmailSent] = useState(false);
    const form = useForm<FormSchema>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
        mode: "onSubmit",
        reValidateMode: "onBlur",
    });

    async function onSubmit(values: FormSchema) {
        await authReactClient.requestPasswordReset({
            email: values.email,
            redirectTo: `${window.location.origin}/reset/password`,
        });
        setEmailSent(true);
    }

    return (
        <div className="flex flex-1 flex-col items-center justify-center">
            <Card className="w-full max-w-md">
                {emailSent ? (
                    <>
                        <CardHeader>
                            <CardTitle>Check your email</CardTitle>
                            <CardDescription>
                                If that address has an account, a reset link is on the way. It expires in an hour.
                            </CardDescription>
                        </CardHeader>
                    </>
                ) : (
                    <>
                        <CardHeader>
                            <CardTitle>Forgot it. Fine.</CardTitle>
                            <CardDescription>
                                We&apos;ll send a link if this email has an AggieTrack account.
                            </CardDescription>
                        </CardHeader>
                        <form id="reset-form" onSubmit={form.handleSubmit(onSubmit)}>
                            <CardContent>
                                <FieldGroup>
                                    <Controller
                                        name="email"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel>Email</FieldLabel>
                                                <Input
                                                    type="email"
                                                    {...field}
                                                    id={field.name}
                                                    aria-invalid={fieldState.invalid}
                                                    placeholder="Email"
                                                    autoComplete="email"
                                                />
                                                {fieldState.invalid && (
                                                    <FieldError errors={fieldState.error ? [{ message: fieldState.error.message }] : []} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                </FieldGroup>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" form="reset-form" className="w-full" disabled={form.formState.isSubmitting}>
                                    Send the link
                                </Button>
                            </CardFooter>
                        </form>
                    </>
                )}
            </Card>
        </div>
    );
}
