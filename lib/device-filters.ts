import { Prisma } from "@prisma/client";

export type DeviceFilterRecord = {
  id: string;
  fromTime: Date;
  toTime: Date;
  deviceIds: string[];
  label: string | null;
  createdAt: Date;
};

export function buildDeviceFilterSql(filters: Pick<DeviceFilterRecord, "fromTime" | "toTime" | "deviceIds">[]): Prisma.Sql {
  if (filters.length === 0) return Prisma.sql`TRUE`;
  const clauses = filters.map((f) => {
    const ids = Prisma.join(f.deviceIds.map((id) => Prisma.sql`${id}`));
    return Prisma.sql`(
      "recordedAt" NOT BETWEEN ${f.fromTime} AND ${f.toTime}
      OR "deviceId" IS NULL
      OR "deviceId" IN (${ids})
    )`;
  });
  return clauses.reduce((acc, c) => Prisma.sql`${acc} AND ${c}`);
}
