import { redirect } from "next/navigation";
export default async function MachineLegacyPage({ params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;
  redirect(`/customer-portal?machineId=${encodeURIComponent(machineId)}`);
}
