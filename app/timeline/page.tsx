import { redirect } from "next/navigation";
import { format } from "date-fns";

export default function TimelineIndexPage() {
  redirect(`/timeline/${format(new Date(), "yyyy-MM-dd")}`);
}
