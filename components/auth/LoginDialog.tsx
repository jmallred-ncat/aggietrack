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
    email: z.email(),
    password: z.string().min(8, "Passwords must be at least 8 characters long"),
})
export default function LoginDialog() {
    const [open, setOpen] = useState(false);
    const [passwordType, setPasswordType] = useState<"password" | "text">("password");
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            password: "",
        },
        mode: "onTouched",
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
            <DialogTrigger render={<Button size="sm">Login</Button>} />
            <DialogContent className={"not-typeset w-[700px]"}>
                <DialogHeader>
                    <DialogTitle>Login</DialogTitle>
                    <DialogDescription>Login to your account to continue</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

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

                        <Controller
                            name="password"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Password</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput {...field} id={field.name} aria-invalid={fieldState.invalid} placeholder="Password" autoComplete="new-password"
                                            type={passwordType} />
                                        <InputGroupButton tabIndex={-1} onClick={() => setPasswordType(prev => prev === "password" ? "text" : "password")}>
                                            {passwordType === "text" ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
                                        </InputGroupButton>
                                    </InputGroup>

                                    {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>

                    <DialogFooter>
                        <Button type="submit" className="w-full">Login</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    )



}