"use client";

import { useMemo } from "react";
import { format, addMinutes, differenceInMinutes } from "date-fns";
import { Slider } from "@/components/ui/slider";

type Props = {
  min: string;
  max: string;
  value: [string, string];
  onChange: (from: string, to: string) => void;
};

export default function TimeRangeSlider({ min, max, value, onChange }: Props) {
  const minDate = useMemo(() => new Date(min), [min]);
  const totalMinutes = useMemo(
    () => differenceInMinutes(new Date(max), minDate),
    [max, minDate],
  );

  const sliderValue = useMemo(
    () => [
      differenceInMinutes(new Date(value[0]), minDate),
      differenceInMinutes(new Date(value[1]), minDate),
    ],
    [value, minDate],
  );

  function handleChange(v: number | readonly number[]) {
    const arr = Array.isArray(v) ? (v as number[]) : [v as number];
    const [a, b] = arr;
    onChange(
      addMinutes(minDate, a).toISOString(),
      addMinutes(minDate, b).toISOString(),
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-gray-700">
        <span>{format(new Date(value[0]), "HH:mm")}</span>
        <span>{format(new Date(value[1]), "HH:mm")}</span>
      </div>
      <Slider
        min={0}
        max={totalMinutes}
        step={1}
        value={sliderValue}
        onValueChange={handleChange}
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{format(minDate, "HH:mm")}</span>
        <span>{format(new Date(max), "HH:mm")}</span>
      </div>
    </div>
  );
}
