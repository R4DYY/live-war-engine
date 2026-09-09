import type { CommanderDefinition } from "@/domain/types";

const PLAYER_ICON_BASE = "/ui/player";

export const COMMANDERS: CommanderDefinition[] = [
  { id: "ronaldo", displayName: "Cristiano Ronaldo", shortName: "Ronaldo", iconAsset: `${PLAYER_ICON_BASE}/ronaldo.jpg` },
  { id: "messi", displayName: "Lionel Messi", shortName: "Messi", iconAsset: `${PLAYER_ICON_BASE}/messi.jpg` },
  { id: "musk", displayName: "Elon Musk", shortName: "Musk" },
  { id: "bezos", displayName: "Jeff Bezos", shortName: "Bezos" },
  { id: "mbappe", displayName: "Mbappé", shortName: "Mbappé", iconAsset: `${PLAYER_ICON_BASE}/mbappe.jpg` },
  { id: "lamine-yamal", displayName: "Lamine Yamal", shortName: "Yamal", iconAsset: `${PLAYER_ICON_BASE}/lamine.jpg` },
  { id: "haaland", displayName: "Haaland", shortName: "Haaland", iconAsset: `${PLAYER_ICON_BASE}/haaland.jpg` },
  { id: "brazil", displayName: "Brazil", shortName: "Brazil", iconAsset: `${PLAYER_ICON_BASE}/brasil.jpg` },
  { id: "argentina", displayName: "Argentina", shortName: "Argentina", iconAsset: `${PLAYER_ICON_BASE}/argentina.jpg` },
  { id: "france", displayName: "France", shortName: "France", iconAsset: `${PLAYER_ICON_BASE}/france.jpg` },
  { id: "spain", displayName: "Spain", shortName: "Spain", iconAsset: `${PLAYER_ICON_BASE}/spain.jpg` },
  { id: "england", displayName: "England", shortName: "England", iconAsset: `${PLAYER_ICON_BASE}/england.jpg` },
  { id: "usa", displayName: "USA", shortName: "USA", iconAsset: `${PLAYER_ICON_BASE}/usa.jpg` },
  { id: "kai-cenat", displayName: "Kai Cenat", shortName: "Kai", iconAsset: `${PLAYER_ICON_BASE}/kai.jpg` },
  { id: "ishowspeed", displayName: "IShowSpeed", shortName: "Speed", iconAsset: `${PLAYER_ICON_BASE}/speed.jpg` },
  { id: "iphone", displayName: "iPhone", shortName: "iPhone", iconAsset: `${PLAYER_ICON_BASE}/iphone.jpg` },
  { id: "samsung", displayName: "Samsung", shortName: "Samsung", iconAsset: `${PLAYER_ICON_BASE}/samsung.jpg` },
  { id: "playstation", displayName: "PlayStation", shortName: "PlayStation", iconAsset: `${PLAYER_ICON_BASE}/playstation.jpg` },
  { id: "xbox", displayName: "Xbox", shortName: "Xbox", iconAsset: `${PLAYER_ICON_BASE}/xbox.jpg` },
  { id: "nike", displayName: "Nike", shortName: "Nike", iconAsset: `${PLAYER_ICON_BASE}/nike.jpg` },
  { id: "adidas", displayName: "Adidas", shortName: "Adidas", iconAsset: `${PLAYER_ICON_BASE}/adidas.jpg` },
  { id: "coca-cola", displayName: "Coca-Cola", shortName: "Coke", iconAsset: `${PLAYER_ICON_BASE}/cocacola.jpg` },
  { id: "pepsi", displayName: "Pepsi", shortName: "Pepsi", iconAsset: `${PLAYER_ICON_BASE}/pepsi.jpg` },
  { id: "mcdonalds", displayName: "McDonald’s", shortName: "McDonald’s", iconAsset: `${PLAYER_ICON_BASE}/mcdo.jpg` },
  { id: "burger-king", displayName: "Burger King", shortName: "Burger King", iconAsset: `${PLAYER_ICON_BASE}/burgerking.jpg` },
  { id: "minecraft", displayName: "Minecraft", shortName: "Minecraft", iconAsset: `${PLAYER_ICON_BASE}/minecraft.jpg` },
  { id: "fortnite", displayName: "Fortnite", shortName: "Fortnite", iconAsset: `${PLAYER_ICON_BASE}/fortnite.jpg` },
  { id: "instagram", displayName: "Instagram", shortName: "Instagram", iconAsset: `${PLAYER_ICON_BASE}/instagram.jpg` },
  { id: "tiktok", displayName: "TikTok", shortName: "TikTok", iconAsset: `${PLAYER_ICON_BASE}/tiktok.jpg` },
];

export function getCommander(id: string): CommanderDefinition | undefined {
  return COMMANDERS.find((c) => c.id === id);
}
