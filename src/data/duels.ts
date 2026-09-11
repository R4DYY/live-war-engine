import type { DuelDefinition } from "@/domain/types";

export const DUELS: DuelDefinition[] = [
  { id: "ronaldo-vs-messi", commanderAId: "ronaldo", commanderBId: "messi", displayName: "Ronaldo vs Messi", enabled: true },
  { id: "musk-vs-bezos", commanderAId: "musk", commanderBId: "bezos", displayName: "Musk vs Bezos", enabled: true },
  { id: "mbappe-vs-lamine-yamal", commanderAId: "mbappe", commanderBId: "lamine-yamal", displayName: "Mbappé vs Lamine Yamal", enabled: true },
  { id: "mbappe-vs-haaland", commanderAId: "mbappe", commanderBId: "haaland", displayName: "Mbappé vs Haaland", enabled: true },
  { id: "brazil-vs-argentina", commanderAId: "brazil", commanderBId: "argentina", displayName: "Brazil 🇧🇷 vs Argentina 🇦🇷", enabled: true },
  { id: "france-vs-spain", commanderAId: "france", commanderBId: "spain", displayName: "France 🇫🇷 vs Spain 🇪🇸", enabled: true },
  { id: "france-vs-england", commanderAId: "france", commanderBId: "england", displayName: "France 🇫🇷 vs England 🏴", enabled: true },
  { id: "usa-vs-france", commanderAId: "usa", commanderBId: "france", displayName: "USA 🇺🇸 vs France 🇫🇷", enabled: true },
  { id: "kai-cenat-vs-ishowspeed", commanderAId: "kai-cenat", commanderBId: "ishowspeed", displayName: "Kai Cenat vs IShowSpeed", enabled: true },
  { id: "iphone-vs-samsung", commanderAId: "iphone", commanderBId: "samsung", displayName: "iPhone vs Samsung", enabled: true },
  { id: "playstation-vs-xbox", commanderAId: "playstation", commanderBId: "xbox", displayName: "PlayStation vs Xbox", enabled: true },
  { id: "nike-vs-adidas", commanderAId: "nike", commanderBId: "adidas", displayName: "Nike vs Adidas", enabled: true },
  { id: "coca-cola-vs-pepsi", commanderAId: "coca-cola", commanderBId: "pepsi", displayName: "Coca-Cola vs Pepsi", enabled: true },
  { id: "mcdonalds-vs-burger-king", commanderAId: "mcdonalds", commanderBId: "burger-king", displayName: "McDonald’s vs Burger King", enabled: true },
  { id: "minecraft-vs-fortnite", commanderAId: "minecraft", commanderBId: "fortnite", displayName: "Minecraft vs Fortnite", enabled: true },
  { id: "instagram-vs-tiktok", commanderAId: "instagram", commanderBId: "tiktok", displayName: "Instagram vs TikTok", enabled: true },
];

export function getDuel(id: string): DuelDefinition | undefined {
  return DUELS.find((d) => d.id === id);
}
