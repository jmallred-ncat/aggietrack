"use client";

import { authReactClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { InputGroup, InputGroupButton, InputGroupInput } from "../ui/input-group";

const schema = z.object({
    email: z.email(),
    password: z.string().min(8, "Passwords must be at least 8 characters long"),
});

export default function LoginForm({
    onSuccess,
    onForgot,
    submitLabel = "Login",
    inDialog = false,
}: {
    onSuccess?: () => void;
    onForgot?: () => void;
    submitLabel?: string;
    inDialog?: boolean;
}) {
    const router = useRouter();
    const emailId = useId();
    const passwordId = useId();
    const [passwordType, setPasswordType] = useState<"password" | "text">("password");
    const [submitError, setSubmitError] = useState<string | null>(null);
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            password: "",
        },
        mode: "onSubmit",
        reValidateMode: "onBlur",
    });

    async function onSubmit(data: z.infer<typeof schema>) {
        setSubmitError(null);
        const { error } = await authReactClient.signIn.email({
            email: data.email,
            password: data.password,
            callbackURL: "/enter",
        }, {
            onSuccess: () => {
                onSuccess?.();
                router.push("/enter");
            },
            onError: (ctx) => {
                if (ctx.error.status === 403) {
                    setSubmitError("Confirm the email we sent you first. We just sent another one.");
                    return;
                }
                setSubmitError(ctx.error.message ?? "Could not sign in.");
            }
        });
        if (error && error.status === 403) {
            setSubmitError("Confirm the email we sent you first. We just sent another one.");
        } else if (error) {
            setSubmitError(error.message ?? "Could not sign in.");
        }
    }

    const submit = <Button type="submit" className="w-full">{submitLabel}</Button>;

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FieldGroup>
                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={emailId}>Email</FieldLabel>
                            <Input {...field} id={emailId} aria-invalid={fieldState.invalid} placeholder="Email" autoComplete="email" />
                            {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                        </Field>
                    )}
                />

                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={passwordId} className="flex items-center justify-between">
                                <span>Password</span>
                                <Link href="/reset" className="text-sm text-muted-foreground" onClick={onForgot} tabIndex={-1}>Forgot password?</Link>
                            </FieldLabel>
                            <InputGroup>
                                <InputGroupInput {...field} id={passwordId} aria-invalid={fieldState.invalid} placeholder="Password" autoComplete="current-password"
                                    type={passwordType} />
                                <InputGroupButton type="button" tabIndex={-1} onClick={() => setPasswordType(prev => prev === "password" ? "text" : "password")}>
                                    {passwordType === "text" ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
                                </InputGroupButton>
                            </InputGroup>

                            {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                        </Field>
                    )}
                />
            </FieldGroup>

            {submitError && (
                <FieldError errors={[{ message: submitError }]} />
            )}

            {inDialog ? <DialogFooter>{submit}</DialogFooter> : submit}
        </form>
    );
}
