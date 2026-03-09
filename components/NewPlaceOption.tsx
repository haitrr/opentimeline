type Props = {
  isNewPlace: boolean;
  setIsNewPlace: (v: boolean) => void;
  newPlaceName: string;
  setNewPlaceName: (v: string) => void;
  newPlaceRadius: number;
  setNewPlaceRadius: (v: number) => void;
};

export default function NewPlaceOption({
  isNewPlace, setIsNewPlace, newPlaceName, setNewPlaceName, newPlaceRadius, setNewPlaceRadius,
}: Props) {
  return (
    <label className="flex cursor-pointer items-start gap-2 px-2.5 py-1.5 hover:bg-gray-50">
      <input type="radio" name="place" checked={isNewPlace} onChange={() => setIsNewPlace(true)} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <span className="text-sm text-gray-800">Create new place here</span>
        {isNewPlace && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">Name</label>
              <input type="text" value={newPlaceName} onChange={(e) => setNewPlaceName(e.target.value)} placeholder="e.g. Home, Work, Gym" autoFocus className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">Radius (m)</label>
              <input type="number" value={newPlaceRadius} onChange={(e) => setNewPlaceRadius(Number(e.target.value))} min={10} max={5000} className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        )}
      </div>
    </label>
  );
}
