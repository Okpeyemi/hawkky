"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/src/auth";
import { addSubscriptionInputSchema } from "@/src/domain/sources/schemas";
import { inngest } from "@/src/inngest/client";
import { addSubscription, removeSubscription } from "@/src/server/sources-service";

export async function addSourceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthenticated");

  const parsed = addSubscriptionInputSchema.parse({
    kind: formData.get("kind"),
    key: formData.get("key"),
  });
  const r = await addSubscription(session.user.id, parsed);
  await inngest.send({
    name: "source.ingest.requested",
    data: { sourceId: r.sourceId },
  });
  revalidatePath("/sources");
}

export async function removeSourceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthenticated");
  const id = formData.get("id");
  if (typeof id !== "string") throw new Error("missing id");
  await removeSubscription(session.user.id, id);
  revalidatePath("/sources");
}
