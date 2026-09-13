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
import { BookOpenIcon, CalendarIcon, ChartBarIcon, GearIcon, UserIcon, UserListIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

const navigation = [
    { href: "/dashboard/progress", label: "Progress", icon: <ChartBarIcon weight="duotone" /> },
    { href: "/dashboard/courses", label: "Courses", icon: <BookOpenIcon weight="duotone" /> },
    { href: "/dashboard/planner", label: "Planner", icon: <CalendarIcon weight="duotone" /> },
    { href: "/dashboard/advising", label: "Advising", icon: <UserListIcon weight="duotone" /> },
]

export default async function DashboardSidebar({ user }: { user: User }) {

    return <Sidebar variant="inset">
        <SidebarHeader>
            <div className="text-sm flex items-center gap-2 not-typeset relative">
                <Avatar>
                    <AvatarFallback>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col not-typeset text-xs">
                    <span className="font-bold">{user.name}</span>
                    <span className="text-white/50">Graduating in '{new Date().getFullYear().toString().slice(-2)}</span>
                </div>
                <Link href="/dashboard" className="not-typeset absolute inset-0 hover:pointer" />
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
                        <SidebarMenuItem className="mt-auto">
                            <SidebarMenuButton render={<Link href="/dashboard/profile">
                                <UserIcon weight="duotone" />
                                Profile
                            </Link>} />
                        </SidebarMenuItem>

                        <SidebarMenuItem className="mt-auto">
                            <SidebarMenuButton render={<Link href="/dashboard/settings">
                                <GearIcon weight="duotone" />
                                Settings
                            </Link>} />
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
            <LogOutButton />
        </SidebarFooter>
    </Sidebar >;
};
