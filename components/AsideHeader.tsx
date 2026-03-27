function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

interface AsideHeaderProps {
  onClose: () => void;
  onDetect: () => void;
  detecting: boolean;
}

export default function AsideHeader({ onClose, onDetect, detecting }: AsideHeaderProps) {
  return (
    <header className="px-4 pt-3 pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <h1 className="text-base font-semibold text-gray-900">OpenTimeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDetect}
            disabled={detecting}
            className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50"
            aria-label="Detect visits"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
            </svg>
            <span className="w-16 text-center">{detecting ? "Detecting…" : "Detect"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-200 bg-white p-1.5 text-gray-400 shadow-sm hover:bg-gray-50 hover:text-gray-600 md:hidden"
            aria-label="Close panel"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
