"use client";

import { authReactClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "../ui/input-group";

const schema = z.object({
    firstName: z.string().min(1, "First names must be at least 1 character long"),
    lastName: z.string().min(1, "Last names must be at least 1 character long"),
    email: z.string().min(1, "Email is required").refine((value) => {
        const email = value.includes("@") ? value : `${value}@aggies.ncat.edu`;
        return /^[a-zA-Z0-9._%+-]+@aggies\.ncat\.edu$/.test(email);
    }, "Email must be a valid NCAT email address"),
    password: z.string().min(8, "Passwords must be at least 8 characters long"),
    verifyPassword: z.string().min(8, "Passwords must be at least 8 characters long"),
}).refine((data) => data.password === data.verifyPassword, {
    message: "The passwords do not match",
    path: ["verifyPassword"],
})

export default function RegisterDialog() {
    const [passwordType, setPasswordType] = useState<"password" | "text">("password");
    const [verifyPasswordType, setVerifyPasswordType] = useState<"password" | "text">("password");
    const [open, setOpen] = useState(false);
    const [checkEmail, setCheckEmail] = useState(false);
    const [submittedEmail, setSubmittedEmail] = useState("");
    const [resending, setResending] = useState(false);
    const [resendNote, setResendNote] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            verifyPassword: "",
        },
        mode: "onSubmit",
        reValidateMode: "onBlur",
    })

    async function onSubmit(data: z.infer<typeof schema>) {
        setSubmitError(null);
        const email = data.email.includes("@") ? data.email : `${data.email}@aggies.ncat.edu`;
        const { error } = await authReactClient.signUp.email({
            email,
            password: data.password,
            name: `${data.firstName} ${data.lastName}`,
            firstName: data.firstName,
            lastName: data.lastName,
            callbackURL: "/dashboard",
        }, {
            onSuccess: () => {
                setSubmittedEmail(email);
                setResendNote(null);
                setCheckEmail(true);
            },
            onError: (ctx) => {
                setSubmitError(ctx.error.message ?? "Could not create an account.");
            }
        });
        if (error) {
            setSubmitError(error.message ?? "Could not create an account.");
        }
    }

    function onDialogOpenChangeComplete(open: boolean) {
        if (!open) {
            setCheckEmail(false);
            setSubmittedEmail("");
            setResending(false);
            setResendNote(null);
            setSubmitError(null);
            form.reset();
        }
    }

    async function resendVerification() {
        if (!submittedEmail || resending) {
            return;
        }
        setResending(true);
        setResendNote(null);
        const { error } = await authReactClient.sendVerificationEmail({
            email: submittedEmail,
            callbackURL: "/dashboard",
        });
        setResending(false);
        setResendNote(error ? (error.message ?? "Could not resend.") : "Sent again. Check your Aggie inbox.");
    }

    return (
        <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={onDialogOpenChangeComplete}>
            <DialogTrigger render={<Button size="sm">Register</Button>} />
            <DialogContent className={"not-typeset w-[700px]"}>
                {checkEmail ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Check your Aggie email</DialogTitle>
                            <DialogDescription>
                                You&apos;re in — almost. Confirm the email we just sent, then you can start.
                            </DialogDescription>
                        </DialogHeader>
                        {resendNote && (
                            <p className="text-sm text-muted-foreground">{resendNote}</p>
                        )}
                        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
                            <Button type="button" className="w-full" onClick={() => setOpen(false)}>
                                Got it
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full"
                                disabled={resending}
                                onClick={resendVerification}
                            >
                                {resending ? "Sending…" : "Didn't get it? Send it again"}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                <DialogHeader>
                    <DialogTitle>Register</DialogTitle>
                    <DialogDescription>Register to create an account</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                    <FieldGroup className="grid grid-cols-2 gap-4">
                        <Controller
                            name="firstName"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>First Name</FieldLabel>
                                    <Input {...field} id={field.name} aria-invalid={fieldState.invalid} placeholder="First Name" autoComplete="given-name" />
                                    {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="lastName"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Last Name</FieldLabel>
                                    <Input {...field} id={field.name} aria-invalid={fieldState.invalid} placeholder="Last Name" autoComplete="family-name" />
                                    {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>

                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Email</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput {...field} id={field.name} aria-invalid={fieldState.invalid} placeholder="Email" autoComplete="email" />
                                        <InputGroupAddon align={"inline-end"} >
                                            <InputGroupText>@aggies.ncat.edu</InputGroupText>
                                        </InputGroupAddon>
                                    </InputGroup>

                                    {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>

                    <FieldGroup>
                        <Controller
                            name="password"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Password</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput {...field} id={field.name} aria-invalid={fieldState.invalid} placeholder="Password" autoComplete="new-password" type={passwordType} />
                                        <InputGroupButton tabIndex={-1} onClick={() => setPasswordType(prev => prev === "password" ? "text" : "password")}>
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
                                    <FieldLabel>Verify Password</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput {...field} id={field.name} aria-invalid={fieldState.invalid} placeholder="Verify Password" autoComplete="new-password" type={verifyPasswordType} />
                                        <InputGroupButton tabIndex={-1} onClick={() => setVerifyPasswordType(prev => prev === "password" ? "text" : "password")}>
                                            {verifyPasswordType === "text" ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
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

                    <DialogFooter>
                        <Button type="submit" className="w-full">Create Account</Button>
                    </DialogFooter>
                </form>
                    </>
                )}
            </DialogContent>
        </Dialog >
    )
}