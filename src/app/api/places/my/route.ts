import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as placeModel from "@/lib/models/place";
import * as photoModel from "@/lib/models/photo";
import * as menuItemModel from "@/lib/models/menuItem";

export async function GET(request: NextRequest) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const places = placeModel.listByUser(auth.userId);

  // For each place, include photo count and menu items
  const result = places.map((place) => {
    const photos = photoModel.listPhotos(place.id);
    const menuItems = menuItemModel.listByPlace(place.id);
    return {
      ...place,
      photoCount: photos.length,
      menuItemCount: menuItems.length,
    };
  });

  return NextResponse.json({ places: result });
}
