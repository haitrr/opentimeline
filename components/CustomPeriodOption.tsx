type Props = {
  periodIndex: number;
  setPeriodIndex: (v: number) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
};

export default function CustomPeriodOption({
  periodIndex, setPeriodIndex, customStart, setCustomStart, customEnd, setCustomEnd,
}: Props) {
  return (
    <label className="flex cursor-pointer items-start gap-2 px-2.5 py-1.5 hover:bg-gray-50">
      <input type="radio" name="period" checked={periodIndex === -1} onChange={() => setPeriodIndex(-1)} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <span className="text-sm text-gray-800">Custom</span>
        {periodIndex === -1 && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">Arrival</label>
              <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">Departure</label>
              <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        )}
      </div>
    </label>
  );
}
