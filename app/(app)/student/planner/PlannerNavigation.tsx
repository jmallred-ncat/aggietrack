"use client";

import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
import Link from "next/link";

const navigation = [
    {
        name: "My Plan",
        href: "/student/planner",
    },
    {
        name: "Program Outline",
        href: "/student/planner/outline",
    },
];

export default function PlannerNavigation() {
    return (
        <NavigationMenu className="not-typeset">
            <NavigationMenuList className="gap-2">
                {navigation.map((item) => (
                    <NavigationMenuItem key={item.name}>
                        <NavigationMenuLink render={<Link href={item.href}>{item.name}</Link>} />
                    </NavigationMenuItem>
                ))}
            </NavigationMenuList>
        </NavigationMenu>
    );
}
