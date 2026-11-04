"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import LoginForm from "./LoginForm";

export default function LoginDialog() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [seenPath, setSeenPath] = useState(pathname);
    if (seenPath !== pathname) {
        setSeenPath(pathname);
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm">Login</Button>} />
            <DialogContent className={"not-typeset w-[700px]"}>
                <DialogHeader>
                    <DialogTitle>Login</DialogTitle>
                    <DialogDescription>Login to your account to continue</DialogDescription>
                </DialogHeader>
                <LoginForm key={open ? "open" : "closed"} inDialog onSuccess={() => setOpen(false)} onForgot={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
