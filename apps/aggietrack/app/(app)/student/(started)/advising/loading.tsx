import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdvisingLoading() {
    return (
        <div className="not-typeset flex flex-col gap-6 py-6" aria-busy="true">
            <span className="sr-only">Loading advising…</span>
            <div className="space-y-2">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-72" />
            </div>
            <Card>
                <CardHeader className="gap-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full max-w-sm" />
                    <Skeleton className="h-11 w-full" />
                </CardHeader>
            </Card>
        </div>
    );
}
