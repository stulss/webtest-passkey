import * as items from "@/lib/repository/item";
import { publicItem, type PublicItem } from "@/lib/dto/records";
import { checkItemContent } from "@/lib/domain/rules";

export async function list(spaceId: string): Promise<PublicItem[]> {
  return (await items.list(spaceId)).map(publicItem);
}

export async function add(
  spaceId: string,
  rawContent: unknown
): Promise<{ items: PublicItem[] } | { error: string; status: number }> {
  const check = checkItemContent(rawContent);
  if (!check.ok) return { error: check.error, status: 400 };
  await items.add(spaceId, check.value);
  return { items: await list(spaceId) };
}

export async function remove(
  spaceId: string,
  itemId: string
): Promise<{ items: PublicItem[] } | { error: string; status: number }> {
  const removed = await items.remove(spaceId, itemId);
  if (!removed) return { error: "찾지 못했습니다.", status: 404 };
  return { items: await list(spaceId) };
}
