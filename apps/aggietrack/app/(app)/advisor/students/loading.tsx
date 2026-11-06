import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsLoading() {
    return (
        <div className="flex flex-col gap-6 py-6">
            <div className="space-y-2">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <div className="flex flex-wrap gap-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-16 min-w-[220px] flex-1" />
                ))}
            </div>
            <div className="space-y-3">
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-24 w-full" />
                ))}
            </div>
        </div>
    );
}
