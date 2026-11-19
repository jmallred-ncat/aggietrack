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
            <div className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-56" />
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
