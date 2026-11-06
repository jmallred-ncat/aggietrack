import { Skeleton } from "@/components/ui/skeleton";

export default function PlanLoading() {
    return (
        <div className="space-y-4 py-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}
