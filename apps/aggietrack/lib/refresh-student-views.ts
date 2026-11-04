import { revalidatePath } from "next/cache";
import { studentViewRefreshTargets } from "./plan-view";

/** Drop cached dashboard, planner, and progress pages after a student save. */
export function refreshStudentViews() {
    for (const target of studentViewRefreshTargets()) {
        if (target.type) {
            revalidatePath(target.path, target.type);
            continue;
        }
        revalidatePath(target.path);
    }
}
