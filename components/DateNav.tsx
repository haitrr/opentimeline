"use client";

import { useRouter } from "next/navigation";
import { format, addDays, subDays, parseISO } from "date-fns";

export default function DateNav({ currentDate }: { currentDate: string }) {
  const router = useRouter();
  const date = parseISO(currentDate);
  const today = format(new Date(), "yyyy-MM-dd");

  const go = (d: Date) =>
    router.push(`/timeline/${format(d, "yyyy-MM-dd")}`);

  return (
    <div className="flex items-center justify-between py-2">
      <button
        onClick={() => go(subDays(date, 1))}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        aria-label="Previous day"
      >
        &#8592;
      </button>
      <input
        type="date"
        value={currentDate}
        max={today}
        onChange={(e) => {
          if (e.target.value) go(parseISO(e.target.value));
        }}
        className="cursor-pointer rounded border-none bg-transparent text-center text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <button
        onClick={() => go(addDays(date, 1))}
        disabled={currentDate >= today}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next day"
      >
        &#8594;
      </button>
    </div>
  );
}
