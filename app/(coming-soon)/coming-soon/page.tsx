import { Badge } from "@/components/ui/badge";

export default function ComingSoon() {
    return (
        <div className="flex flex-col flex-1 text-left max-w-7xl w-full mx-auto justify-center">
            <div className="flex flex-col justify-center mt-auto not-typeset">
                <Badge>Coming Soon</Badge>
                <h1 className="text-4xl font-bold mt-2 whitespace-nowrap">AggieTrack<sup>1</sup></h1>
                <p className="text-sm text-muted-foreground max-w-prose mt-2 text-balance">A platform for tracking and managing your Information Technology degree progress at North Carolina Agricultural and Technical State University.</p>
                <ul className=" mt-6 leading-5">
                    <li className="font-bold">Professor Kareem Hogan</li>
                    <li>CST 499 Senior Capstone Project II</li>
                    <li>Fall 2026 Semester</li>
                </ul>

                <div>
                    <h2 className="text-xl font-bold mt-6">Contributors</h2>
                    <ul className="mt-2 leading-5">
                        <li>James Allred</li>
                        <li>Mellonie Evans</li>
                        <li>Ivy Mitchell</li>
                        <li>LaDarius Taylor</li>
                    </ul>
                </div>
            </div>

            <p className="text-sm text-muted-foreground max-w-prose mt-auto"><sup>1</sup> This is not an official North Carolina A&T State University product. AggieTrack is a student-run capstone project and is not affiliated with the university in an official capacity.</p>
        </div>
    );
}