import { redirect } from "next/navigation";

export default function ActivationStepTwoRedirectPage({
  params,
}: {
  params: { machineId: string };
}) {
  redirect(`/activate/${encodeURIComponent(params.machineId)}/step-1`);
}
