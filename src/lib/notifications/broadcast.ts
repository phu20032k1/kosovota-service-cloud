import { prisma } from "@/lib/prisma";
import { queueNotification } from "./enqueue";

type Audience = "CUSTOMERS" | "DEALERS" | "USERS" | "ALL";

type Recipient = { email: string; name?: string | null; source: string };

export async function queueEmailBroadcast(input: { audience: Audience; subject: string; content: string; kind?: string }) {
  const recipients = await getEmailRecipients(input.audience);
  let queued = 0;
  const skippedDuplicates = recipients.length - uniqueByEmail(recipients).length;
  for (const recipient of uniqueByEmail(recipients)) {
    await queueNotification({
      channel: "EMAIL",
      email: recipient.email,
      recipientName: recipient.name,
      subject: input.subject,
      content: input.content,
      kind: input.kind || "BROADCAST_EMAIL",
      payload: { audience: input.audience, source: recipient.source },
    });
    queued += 1;
  }
  return { queued, skippedDuplicates, recipients: recipients.length };
}

async function getEmailRecipients(audience: Audience): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  if (audience === "CUSTOMERS" || audience === "ALL") {
    const customers = await prisma.customer.findMany({ where: { email: { not: null } }, select: { email: true, name: true } });
    recipients.push(...customers.filter((x) => x.email).map((x) => ({ email: x.email!, name: x.name, source: "CUSTOMER" })));
  }
  if (audience === "DEALERS" || audience === "ALL") {
    const dealers = await prisma.dealer.findMany({ where: { email: { not: null } }, select: { email: true, name: true } });
    recipients.push(...dealers.filter((x) => x.email).map((x) => ({ email: x.email!, name: x.name, source: "DEALER" })));
  }
  if (audience === "USERS" || audience === "ALL") {
    const users = await prisma.user.findMany({ where: { email: { not: null }, active: true }, select: { email: true, name: true, role: true } });
    recipients.push(...users.filter((x) => x.email).map((x) => ({ email: x.email!, name: `${x.name} (${x.role})`, source: "USER" })));
  }
  return recipients;
}

function uniqueByEmail(recipients: Recipient[]) {
  const seen = new Set<string>();
  return recipients.filter((item) => {
    const email = item.email.trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    item.email = email;
    return true;
  });
}
