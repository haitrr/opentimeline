import { redirect } from "next/navigation";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default function TimelineIndexPage() {
  redirect(`/timeline/${format(new Date(), "yyyy-MM-dd")}`);
}
