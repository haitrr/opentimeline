import { redirect } from "next/navigation";
import { format } from "date-fns";

export default function RootPage() {
  redirect(`/timeline/${format(new Date(), "yyyy-MM-dd")}?fit=1`);
}
