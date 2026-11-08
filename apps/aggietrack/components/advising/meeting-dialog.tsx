"use client";

import { AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from "@/components/ui/alert-dialog";
import { DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

export const meetingDialogClassName = "@container not-typeset w-full max-w-[calc(100%-2rem)] gap-0 overflow-hidden bg-background! p-0 text-foreground shadow-lg sm:max-w-md";

// Local to advising dialogs. The shared popup and footer use a translucent
// popover and muted wash, which lets the page show through a narrow review.
// This scrim has no backdrop blur, and the panel and footer paint solid colors.
export const advisingOverlayClassName = "fixed inset-0 isolate z-50 bg-black/70 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0";

const opaquePanel = { backgroundColor: "var(--background)", animation: "none" } as const;
const opaqueFooter = { backgroundColor: "var(--muted)" } as const;

export function MeetingAlertContent({ className, style, ...props }: ComponentProps<typeof AlertDialogContent>) {
    return <AlertDialogContent overlayClassName={advisingOverlayClassName} className={cn(meetingDialogClassName, className)} style={{ ...opaquePanel, ...style }} {...props} />;
}

export function MeetingFormContent({ className, style, ...props }: ComponentProps<typeof DialogContent>) {
    return <DialogContent showCloseButton={false} overlayClassName={advisingOverlayClassName} className={cn(meetingDialogClassName, className)} style={{ ...opaquePanel, ...style }} {...props} />;
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
        <AlertDialogFooter className="mx-0 mb-0 block rounded-b-xl border-t bg-muted! p-0 sm:flex-col" style={opaqueFooter}>
            <div className="flex flex-col gap-2 px-6 py-4 @min-[23rem]:flex-row @min-[23rem]:justify-end">
                {children}
            </div>
        </AlertDialogFooter>
    );
}

export function MeetingFormFooter({ children }: { children: ReactNode }) {
    return (
        <DialogFooter className="mx-0 mb-0 block rounded-b-xl border-t bg-muted! p-0 sm:flex-col" style={opaqueFooter}>
            <div className="flex flex-col gap-2 px-6 py-4 @min-[23rem]:flex-row @min-[23rem]:justify-end">
                {children}
            </div>
        </DialogFooter>
    );
}

export const meetingButtonClass = "h-auto min-h-11 w-full whitespace-normal @min-[23rem]:min-h-8 @min-[23rem]:w-auto @min-[23rem]:min-w-0 @min-[23rem]:shrink";
