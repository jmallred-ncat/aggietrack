import { Skeleton } from "@/components/ui/skeleton";

export default function PlansLoading() {
    return (
        <div className="flex flex-col gap-6 py-6">
            <div className="space-y-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <Skeleton className="h-4 w-56" />
            <div className="space-y-3">
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-24 w-full" />
                ))}
            </div>
        </div>
    );
}
