import { Button } from "@/components/ui/button";
import { FormState, Trip, EMPTY_FORM } from "./types";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function TripForm({
  editingTrip,
  form,
  setForm,
  isPending,
  onSubmit,
  onCancel,
}: {
  editingTrip: Trip | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {editingTrip ? "Edit trip" : "New trip"}
      </p>
      <input
        className={inputClass}
        placeholder="Trip name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        required
        aria-label="Trip name"
      />
      <div className="flex gap-2">
        <input
          type="date"
          className={inputClass}
          value={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          required
          aria-label="Start date"
        />
        <input
          type="date"
          className={inputClass}
          value={form.endDate}
          min={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          required
          aria-label="End date"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          className="flex-1 text-xs"
          disabled={isPending}
        >
          {editingTrip ? "Save" : "Create"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export { EMPTY_FORM };
