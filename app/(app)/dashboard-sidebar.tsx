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
import { BackpackIcon, BooksIcon, CalendarIcon, ChatsTeardropIcon, CheckSquareIcon, ClipboardTextIcon, PathIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import BookAdvisingButton from "./book-advising-button";

const navigationByRole = {
    STUDENT: [
        { href: "/student", label: "Dashboard", icon: <BackpackIcon weight="duotone" /> },
        { href: "/student/progress", label: "Progress", icon: <PathIcon weight="duotone" /> },
        { href: "/student/planner", label: "Planner", icon: <CheckSquareIcon weight="duotone" /> },
        { href: "/student/courses", label: "Courses", icon: <BooksIcon weight="duotone" /> },
        { href: "/student/advising", label: "Advising", icon: <ChatsTeardropIcon weight="duotone" /> },
    ],
    ADVISOR: [
        { href: "/advisor", label: "Dashboard", icon: <BackpackIcon weight="duotone" /> },
        { href: "/advisor/students", label: "Students", icon: <UsersThreeIcon weight="duotone" /> },
        { href: "/advisor/plans", label: "Plans", icon: <ClipboardTextIcon weight="duotone" /> },
        { href: "/advisor/appointments", label: "Appointments", icon: <CalendarIcon weight="duotone" /> },
    ],
    ADMIN: [
        { href: "/admin", label: "Dashboard", icon: <BackpackIcon weight="duotone" /> },
    ],
}

export default async function DashboardSidebar({ user, profile }: { user: User, profile: StudentProfileWithCatalog | null }) {
    const navigation = navigationByRole[user.role] ?? navigationByRole.STUDENT;
    const subtitle = profile ? formatProgramName(profile.catalogYear.program) : (user.role === "ADVISOR" ? "Advisor" : user.role === "ADMIN" ? "Admin" : null);
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
                <Link href="/account" className="not-typeset absolute inset-0 hover:pointer" />
            </div>
        </SidebarHeader>
        <SidebarContent>
            <SidebarGroup className="not-typeset flex flex-col h-full">
                <SidebarMenu className="flex-1">
                    {navigation.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton render={<Link href={item.href}>{item.icon} {item.label}</Link>
                            } />
                        </SidebarMenuItem>
                    ))}

                    {user.role === "STUDENT" && (
                        <SidebarMenu className="mt-auto">
                            <BookAdvisingButton />
                        </SidebarMenu>
                    )}
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
            <LogOutButton />
        </SidebarFooter>
    </Sidebar >;
};
