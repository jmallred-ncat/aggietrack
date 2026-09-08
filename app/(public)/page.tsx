"use server";

import { prisma } from "@/lib/prisma";


export default async function Home() {
  const version = await prisma.$queryRaw`SELECT version()` as any;
  return (
    <>
      <h1>AggieTrack</h1>
      <span>Track your Information Technology degree progress at North Carolina A&T State University</span>
      <span>{version[0].version}</span>
    </>
  );
}
