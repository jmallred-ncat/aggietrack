import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "AggieTrack Test Manager", description: "Academic planning test execution and requirement coverage" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="flex min-h-screen flex-col bg-muted/30">
    <div className="flex flex-1 flex-col">{children}</div>
    <footer className="border-t">
      <p className="mx-auto max-w-[1500px] px-4 py-4 text-xs leading-5 text-muted-foreground md:px-6">Academic planning and advising · Acceptance baseline v1.0 · Workbook snapshot: October 12, 2026</p>
    </footer>
  </body></html>;
}
