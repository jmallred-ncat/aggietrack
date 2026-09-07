import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from "@/components/ui/sidebar";
import { CalendarIcon, ChartBarIcon, SignInIcon, UserListIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

const navigation = [
    { href: "/dashboard/progress", label: "Progress", icon: <ChartBarIcon weight="duotone" /> },
    { href: "/dashboard/planner", label: "Planner", icon: <CalendarIcon weight="duotone" /> },
    { href: "/dashboard/advising", label: "Advising", icon: <UserListIcon weight="duotone" /> },
]

export default function DashboardSidebar() {
    return <Sidebar variant="inset">
        <SidebarHeader>
            <div className="text-sm flex items-center gap-2 not-typeset relative">
                <Avatar>
                    <AvatarFallback>SN</AvatarFallback>
                </Avatar>
                <div className="flex flex-col -space-y-0.5 text-xs">
                    <span className="font-bold">Student Name</span>
                    <span className="text-white/50">Graduating in '{new Date().getFullYear().toString().slice(-2)}</span>
                </div>
                <Link href="/dashboard" className="not-typeset absolute inset-0 hover:pointer" />
            </div>
        </SidebarHeader>
        <SidebarContent>
            {/* STUDENT NAVIGATION */}
            <SidebarGroup className="not-typeset">
                <SidebarMenu>
                    {navigation.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton render={<Link href={item.href}>{item.icon} {item.label}</Link>
                            } />
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
            <Button nativeButton={false} variant="destructive" render={<Link href="/login" className="not-typeset">
                <SignInIcon weight="duotone" />
                Log Out
            </Link>} />
        </SidebarFooter>
    </Sidebar >;
}