import Image from "next/image";

export default function ComingSoonLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col justify-center items-center h-screen max-w-7xl mx-auto w-full pb-8 pt-4 px-4">
            <div className="w-full max-w-7xl mx-auto">
                <picture>
                    <source srcSet="/logo-main-white.png" media="(prefers-color-scheme: dark)" />
                    <Image src="/logo-main-blue.png" alt="AggieTrack" width={350} height={500} className="align-self-start" />
                </picture>

            </div>
            {children}
        </div>
    );
}