import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const showCurtain = process.env.COMING_SOON === "true";

function withPathname(request: NextRequest) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", request.nextUrl.pathname);
    return requestHeaders;
}

export default function proxy(request: NextRequest) {
    const requestHeaders = withPathname(request);
    if (showCurtain && request.nextUrl.pathname !== "/coming-soon") {
        return NextResponse.rewrite(new URL("/coming-soon", request.url), {
            request: { headers: requestHeaders },
        });
    }
    return NextResponse.next({
        request: { headers: requestHeaders },
    });
}

export const config = {
    matcher: [
        "/((?!coming-soon|_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\..*).*)",
    ],
};