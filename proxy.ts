import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const showCurtain = process.env.COMING_SOON === "true";

export default function proxy(request: NextRequest) {
    if (showCurtain && request.nextUrl.pathname !== "/coming-soon") {
        return NextResponse.rewrite(new URL("/coming-soon", request.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!coming-soon|_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\..*).*)",
    ],
};