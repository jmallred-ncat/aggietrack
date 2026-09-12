"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { InputGroup, InputGroupButton, InputGroupInput } from "../ui/input-group";

const schema = z.object({
    firstName: z.string().min(1, "First names must be at least 1 character long"),
    lastName: z.string().min(1, "Last names must be at least 1 character long"),
    email: z.email(),
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
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            verifyPassword: "",
        },
        mode: "onBlur",
        reValidateMode: "onBlur",
    })

    function onSubmit(data: z.infer<typeof schema>) {
        console.log(data);
    }

    function onDialogOpenChangeComplete(open: boolean) {
        if (!open) return form.reset();
    }

    return (
        <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={onDialogOpenChangeComplete}>
            <DialogTrigger render={<Button size="sm">Register</Button>} />
            <DialogContent className={"not-typeset w-[700px]"}>
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
                                    <Input {...field} id={field.name} aria-invalid={fieldState.invalid} placeholder="Email" autoComplete="email" />
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

                    <DialogFooter>
                        <Button type="submit" className="w-full">Create Account</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    )



}