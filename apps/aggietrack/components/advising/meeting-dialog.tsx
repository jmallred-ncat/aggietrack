"use client";

import { AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from "@/components/ui/alert-dialog";
import { DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

export const meetingDialogClassName = "@container not-typeset w-full max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-md";

export function MeetingAlertContent({ className, ...props }: ComponentProps<typeof AlertDialogContent>) {
    return <AlertDialogContent className={cn(meetingDialogClassName, className)} {...props} />;
}

export function MeetingFormContent({ className, ...props }: ComponentProps<typeof DialogContent>) {
    return <DialogContent showCloseButton={false} className={cn(meetingDialogClassName, className)} {...props} />;
}

export function MeetingHeader({ children }: { children: ReactNode }) {
    return (
        <AlertDialogHeader className="flex flex-col place-items-start items-start gap-2 grid-rows-none p-6 pb-4 text-left">
            {children}
        </AlertDialogHeader>
    );
}

export function MeetingFormHeader({ children }: { children: ReactNode }) {
    return (
        <DialogHeader className="flex flex-col place-items-start items-start gap-2 p-6 pb-4 text-left">
            {children}
        </DialogHeader>
    );
}

export function MeetingFooter({ children }: { children: ReactNode }) {
    return (
        <AlertDialogFooter className="mx-0 mb-0 block rounded-b-xl border-t bg-muted/50 p-0 sm:flex-col">
            <div className="flex flex-col-reverse gap-2 px-6 py-4 @min-[23rem]:flex-row @min-[23rem]:justify-end">
                {children}
            </div>
        </AlertDialogFooter>
    );
}

export function MeetingFormFooter({ children }: { children: ReactNode }) {
    return (
        <DialogFooter className="mx-0 mb-0 block rounded-b-xl border-t bg-muted/50 p-0 sm:flex-col">
            <div className="flex flex-col-reverse gap-2 px-6 py-4 @min-[23rem]:flex-row @min-[23rem]:justify-end">
                {children}
            </div>
        </DialogFooter>
    );
}

export const meetingButtonClass = "h-auto min-h-11 w-full whitespace-normal @min-[23rem]:min-h-8 @min-[23rem]:w-auto @min-[23rem]:min-w-0 @min-[23rem]:shrink";
