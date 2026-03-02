"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/timeline/${format(new Date(), "yyyy-MM-dd")}?fit=1`);
  }, [router]);

  return null;
}
