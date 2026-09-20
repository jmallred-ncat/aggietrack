import LogOutButton from "@/components/auth/LogOutButton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { User } from "@/lib/generated/prisma/client";
import { formatProgramName } from "@/lib/program";
import type { StudentProfileWithCatalog } from "@/lib/student";
import { BookOpenIcon, CalendarIcon, ChartBarIcon, HouseIcon, UserListIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import BookAdvisingButton from "./book-advising-button";

const navigation = [
    { href: "/dashboard/", label: "Dashboard", icon: <HouseIcon weight="duotone" /> },
    { href: "/dashboard/progress", label: "Progress", icon: <ChartBarIcon weight="duotone" /> },
    { href: "/dashboard/courses", label: "Courses", icon: <BookOpenIcon weight="duotone" /> },
    { href: "/dashboard/planner", label: "Planner", icon: <CalendarIcon weight="duotone" /> },
    { href: "/dashboard/advising", label: "Advising", icon: <UserListIcon weight="duotone" /> },
]

export default async function DashboardSidebar({ user, profile }: { user: User, profile: StudentProfileWithCatalog | null }) {
    const subtitle = profile ? formatProgramName(profile.catalogYear.program) : (user.role === "ADVISOR" ? "advisor" : user.role === "ADMIN" ? "Admin" : null);
    return <Sidebar variant="inset">
        <SidebarHeader>
            <div className="text-sm flex items-center gap-2 not-typeset relative">
                <Avatar>
                    <AvatarFallback>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col not-typeset text-xs">
                    <span className="font-bold">{user.name}</span>
                    <span className="text-muted-foreground">{subtitle}</span>
                </div>
                <Link href="/dashboard/account" className="not-typeset absolute inset-0 hover:pointer" />
            </div>
        </SidebarHeader>
        <SidebarContent>
            {/* STUDENT NAVIGATION */}
            <SidebarGroup className="not-typeset flex flex-col h-full">
                <SidebarMenu className="flex-1">
                    {navigation.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton render={<Link href={item.href}>{item.icon} {item.label}</Link>
                            } />
                        </SidebarMenuItem>
                    ))}

                    <SidebarMenu className="mt-auto">
                        <BookAdvisingButton />
                    </SidebarMenu>
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
            <LogOutButton />
        </SidebarFooter>
    </Sidebar >;
};
