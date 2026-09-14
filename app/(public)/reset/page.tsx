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
})

type FormSchema = z.infer<typeof formSchema>;

export default function PasswordResetPage() {
    const [emailSent, setEmailSent] = useState(false);
    const form = useForm<FormSchema>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
        mode: "onBlur",
        reValidateMode: "onBlur",
    });

    async function onSubmit(values: FormSchema) {
        await authReactClient.requestPasswordReset({ email: values.email }, {
            onSuccess: () => {
                console.log("Email sent");
                setEmailSent(true);
            },
            onError: (error) => {
                console.error(error);
            },
        })
        console.log(values);
    }

    return <div className="flex justify-center items-center flex-col flex-1">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Password Reset</CardTitle>
                <CardDescription>Enter your email address to reset your password.</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="reset-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Email</FieldLabel>
                                    <Input type="email" {...field} id={field.name} aria-invalid={fieldState.invalid} placeholder="Email" autoComplete="email" />
                                    {fieldState.invalid && <FieldError errors={fieldState.error ? [{ message: fieldState.error.message }] : []} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </CardContent>
            <CardFooter>
                <Button type="submit" form="reset-form" className="w-full">Send Reset Email</Button>
            </CardFooter>
        </Card>
    </div>
}
