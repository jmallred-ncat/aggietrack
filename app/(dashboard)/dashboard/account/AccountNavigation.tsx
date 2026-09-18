'use client';

import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
import Link from "next/link";

const navigation = [
    {
        name: 'Account',
        href: '/dashboard/account',
        icon: 'gear',
    },
    {
        name: 'Profile',
        href: '/dashboard/account/profile',
        icon: 'user',
    },
    {
        name: 'Security',
        href: '/dashboard/account/security',
        icon: 'bell',
    },
    {
        name: 'Notifications',
        href: '/dashboard/account/notifications',
        icon: 'bell',
    },
]

export default function AccountNavigation() {
    return (
        <NavigationMenu className={"not-typeset pt-8"}>
            <NavigationMenuList className={"gap-2"}>
                {navigation.map((item) => (
                    <NavigationMenuItem key={item.name}>
                        <NavigationMenuLink render={
                            <Link href={item.href}>{item.name}</Link>
                        } />
                    </NavigationMenuItem>
                ))}
            </NavigationMenuList>
        </NavigationMenu>
    )
}