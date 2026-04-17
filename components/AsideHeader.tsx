import { Button } from "@/components/ui/button";

interface AsideHeaderProps {
  onDetect: () => void;
  detecting: boolean;
}

export default function AsideHeader({ onDetect, detecting }: AsideHeaderProps) {
  return (
    <header className="px-4 pt-3 pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <h1 className="text-base font-semibold text-foreground">OpenTimeline</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDetect}
          disabled={detecting}
          aria-label="Detect visits"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
          </svg>
          <span className="w-16 text-center">{detecting ? "Detecting…" : "Detect"}</span>
        </Button>
      </div>
    </header>
  );
}
