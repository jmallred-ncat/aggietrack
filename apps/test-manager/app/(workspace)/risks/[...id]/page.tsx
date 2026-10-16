import { RecordScreen } from "@/components/section-screens";
import { idFromParams } from "@/lib/sections";
export default async function Page({ params }: { params: Promise<{ id: string[] }> }) {
  const { id } = await params;
  return <RecordScreen name="Risks & Decisions" id={idFromParams(id)}/>;
}
