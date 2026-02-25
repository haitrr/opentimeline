export type ImmichPhoto = {
  id: string;
  lat: number | null;
  lon: number | null;
  takenAt: string;
};

export function isImmichConfigured(): boolean {
  return !!(process.env.IMMICH_BASE_URL && process.env.IMMICH_API_KEY);
}

export async function getImmichPhotos(start: Date, end: Date): Promise<ImmichPhoto[]> {
  const baseUrl = process.env.IMMICH_BASE_URL!.replace(/\/$/, "");
  const apiKey = process.env.IMMICH_API_KEY!;

  const photos: ImmichPhoto[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${baseUrl}/api/search/metadata`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        takenAfter: start.toISOString(),
        takenBefore: end.toISOString(),
        page,
        size: 500,
        withExif: true,
      }),
    });

    if (!res.ok) break;

    const data = await res.json() as {
      assets?: {
        items?: Array<{
          id: string;
          fileCreatedAt: string;
          exifInfo?: { latitude?: number | null; longitude?: number | null };
        }>;
        nextPage?: number | null;
      };
    };

    const items = data.assets?.items ?? [];
    for (const item of items) {
      photos.push({
        id: item.id,
        lat: item.exifInfo?.latitude ?? null,
        lon: item.exifInfo?.longitude ?? null,
        takenAt: item.fileCreatedAt,
      });
    }

    if (!data.assets?.nextPage) break;
    page++;
  }

  return photos;
}
