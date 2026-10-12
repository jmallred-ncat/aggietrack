export const sidebarStateKey = "sidebar_state"
const sidebarStateMaxAge = 60 * 60 * 24 * 365

export function sidebarStateCookie(open: boolean) {
    return `${sidebarStateKey}=${open}; path=/; max-age=${sidebarStateMaxAge}; SameSite=Lax`
}
