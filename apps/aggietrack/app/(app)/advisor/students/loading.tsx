import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsLoading() {
    return (
        <div className="space-y-4 py-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
    );
}
