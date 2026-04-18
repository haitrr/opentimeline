import { Badge } from "@/components/ui/badge";
import { formatCount } from "@/lib/formatCount";

type IconBadgeProps = {
  count: number;
  variant?: "default" | "warning";
};

export default function IconBadge({ count, variant = "default" }: IconBadgeProps) {
  const label = formatCount(count);
  if (label === null) return null;
  const colorClass =
    variant === "default"
      ? "bg-blue-500 text-white dark:bg-blue-600 dark:text-white"
      : "";
  return (
    <Badge
      variant={variant}
      className={`pointer-events-none absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none ${colorClass}`}
    >
      {label}
    </Badge>
  );
}
