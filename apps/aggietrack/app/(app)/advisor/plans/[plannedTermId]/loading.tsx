import { Skeleton } from "@/components/ui/skeleton";

export default function PlanLoading() {
    return (
        <div className="flex flex-col gap-6 py-6">
            <Skeleton className="h-8 w-36" />
            <div className="space-y-2">
                <Skeleton className="h-12 w-72 max-w-full" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    );
}
