"use client";

import { DismissibleAlert } from "@/components/dismissible-alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runAfterConfirmCloses } from "@/lib/completion-menu";
import { checkedNoteBody, NOTE_MAX_LENGTH } from "@/lib/plan-notes";
import { planTimestamp } from "@/lib/plan-status";
import { reviewCopy } from "@/lib/plan-review";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { approvePlannedTerm, returnPlannedTerm } from "../actions";

const pinPattern = /^[A-Za-z0-9]{4,12}$/;

export function ReviewPanel({
    plannedTermId,
    status,
    revision,
    studentName,
    termLabel,
    registrationPin,
    reviewedAt,
    registeredAt,
    canDecide,
    courseCount,
}: {
    plannedTermId: string;
    status: string;
    revision: number;
    studentName: string;
    termLabel: string;
    registrationPin: string | null;
    reviewedAt: string | null;
    registeredAt: string | null;
    canDecide: boolean;
    courseCount: number;
}) {
    const router = useRouter();
    const [pin, setPin] = useState("");
    const [comment, setComment] = useState("");
    const [approveOpen, setApproveOpen] = useState(false);
    const [returnOpen, setReturnOpen] = useState(false);
    const [busy, setBusy] = useState<"approve" | "return" | null>(null);
    const [alert, setAlert] = useState<{ title: string; description: string; refresh?: boolean } | null>(null);
    const [returnAlert, setReturnAlert] = useState<{ title: string; description: string } | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [pending, startTransition] = useTransition();
    const requestId = useRef<string | null>(null);

    function finish(result: { success: boolean; error?: string; code?: string }, success: string) {
        if (result.success) {
            requestId.current = null;
            setAlert(null);
            setComment("");
            toast.success(success);
            router.refresh();
            return;
        }
        if (result.code === "forbidden") {
            toast.error(reviewCopy.forbidden);
            setUnavailable(true);
            return;
        }
        if (result.code === "not-waiting") {
            toast.error(reviewCopy.notWaiting);
            router.refresh();
            return;
        }
        if (result.code === "stale") {
            setAlert({
                title: reviewCopy.stale,
                description: "Refresh the plan before making a decision. Your comment has been kept.",
                refresh: true,
            });
            return;
        }
        if (result.code === "rules") {
            setAlert({ title: "This plan cannot be approved", description: result.error ?? reviewCopy.approveFailed });
            return;
        }
        const kept = success === "Plan returned for changes";
        setAlert({
            title: kept ? "Plan could not be returned" : "Plan could not be approved",
            description: result.error ?? (kept ? reviewCopy.returnFailed : reviewCopy.approveFailed),
        });
        toast.error(result.error ?? "Decision could not be confirmed");
    }

    function openApprove() {
        if (!pinPattern.test(pin.trim())) {
            setAlert({ title: "Check the registration pin", description: reviewCopy.pin });
            return;
        }
        if (courseCount === 0) {
            setAlert({ title: "This plan cannot be approved", description: reviewCopy.empty });
            return;
        }
        requestId.current ??= crypto.randomUUID();
        setAlert(null);
        setApproveOpen(true);
    }

    function confirmApprove() {
        const id = requestId.current ?? crypto.randomUUID();
        requestId.current = id;
        runAfterConfirmCloses(
            () => setApproveOpen(false),
            () => {
                setBusy("approve");
                startTransition(async () => {
                    const result = await approvePlannedTerm(plannedTermId, pin.trim(), revision, id);
                    setBusy(null);
                    finish(result, "Plan approved");
                });
            },
            (save) => window.setTimeout(save, 0),
        );
    }

    function confirmReturn() {
        const checked = checkedNoteBody(comment, "comment");
        if (!checked.ok) {
            setReturnAlert({
                title: comment.trim() ? "Comment is too long" : "Add a return comment",
                description: checked.error,
            });
            return;
        }
        requestId.current ??= crypto.randomUUID();
        const id = requestId.current;
        setReturnAlert(null);
        runAfterConfirmCloses(
            () => setReturnOpen(false),
            () => {
                setBusy("return");
                startTransition(async () => {
                    const result = await returnPlannedTerm(plannedTermId, checked.body, revision, id);
                    setBusy(null);
                    finish(result, "Plan returned for changes");
                });
            },
            (save) => window.setTimeout(save, 0),
        );
    }

    if (unavailable) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Plan unavailable</CardTitle>
                    <CardDescription>This plan does not exist or you do not have access to it.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const reviewed = planTimestamp(reviewedAt);
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Review</CardTitle>
                    {status === "SUBMITTED" ? (
                        <CardDescription>Approve this term plan or return it with the changes the student needs to make.</CardDescription>
                    ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                    {status === "DRAFT" ? (
                        <p className="text-sm text-muted-foreground">This plan has not been submitted. You can review the courses and leave a note, but you cannot approve or return it yet.</p>
                    ) : null}
                    {status === "RETURNED" ? (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">Changes requested. The student can update this plan and send it back for review.</p>
                            <Button type="button" variant="outline" nativeButton={false} render={<a href="#latest-return-note">Read return comment</a>} />
                        </div>
                    ) : null}
                    {status === "APPROVED" ? (
                        <div className="space-y-3">
                            <p className="text-sm">Approved {reviewed}</p>
                            {registrationPin ? (
                                <p className="inline-flex items-center gap-3 rounded-lg bg-muted px-4 py-3 not-typeset">
                                    <span className="text-sm text-muted-foreground">Registration pin</span>
                                    <span className="font-mono text-lg font-semibold tracking-wide">{registrationPin}</span>
                                </p>
                            ) : null}
                            <p className="text-sm text-muted-foreground">
                                {registeredAt ? "Registration confirmed." : "Waiting for the student to confirm registration."}
                            </p>
                        </div>
                    ) : null}
                    {status === "SUBMITTED" && canDecide ? (
                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="registration-pin">Registration pin</Label>
                                <Input
                                    id="registration-pin"
                                    className="mt-2"
                                    value={pin}
                                    autoComplete="off"
                                    onChange={(event) => setPin(event.target.value)}
                                />
                                <p className="mt-2 text-sm text-muted-foreground">4–12 letters or numbers. Shared with the student after approval.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" disabled={pending} onClick={openApprove}>
                                    {busy === "approve" ? "Approving plan…" : "Approve plan"}
                                </Button>
                                <Button type="button" variant="outline" disabled={pending} onClick={() => { requestId.current ??= crypto.randomUUID(); setReturnOpen(true); }}>
                                    {busy === "return" ? "Returning plan…" : "Return for changes"}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {alert ? (
                        <DismissibleAlert
                            title={alert.title}
                            description={alert.description}
                            action={alert.refresh ? (
                                <Button type="button" size="sm" onClick={() => router.refresh()}>Refresh plan</Button>
                            ) : null}
                        />
                    ) : null}
                </CardContent>
            </Card>

            <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve this plan?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Approve {studentName}’s {termLabel} plan and share the registration pin. The courses will be marked as in progress.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button" autoFocus>Cancel</AlertDialogCancel>
                        <AlertDialogAction type="button" onClick={confirmApprove}>Approve plan</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Return this plan?</DialogTitle>
                        <DialogDescription>
                            Tell {studentName} what to change. Your comment will appear in Plan notes, and the student can edit and submit the plan again.
                        </DialogDescription>
                    </DialogHeader>
                    {returnAlert ? <DismissibleAlert title={returnAlert.title} description={returnAlert.description} /> : null}
                    <div>
                        <Label htmlFor="return-comment">What needs to change?</Label>
                        <Textarea
                            id="return-comment"
                            className="mt-2 min-h-[120px]"
                            rows={4}
                            autoFocus
                            value={comment}
                            placeholder="Explain what the student should change before submitting again."
                            onChange={(event) => setComment(event.target.value)}
                        />
                        <p className="mt-2 text-sm text-muted-foreground">Required. Your comment is shared with the student.</p>
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">{[...comment].length}/{NOTE_MAX_LENGTH} characters</p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={confirmReturn}>Return plan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
