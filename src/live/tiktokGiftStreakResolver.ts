export interface GiftStreakInput { key: string; repeatCount: number; repeatEnd?: boolean; }

export class TikTokGiftStreakResolver {
  private readonly active = new Map<string, { count: number; expiresAt: number }>();
  private readonly ttlMs = 30_000;

  resolve(input: GiftStreakInput): number {
    this.cleanup();
    const count = Math.max(0, Math.floor(input.repeatCount));
    const previous = this.active.get(input.key)?.count ?? 0;
    const delta = Math.max(0, count - previous);
    if (input.repeatEnd) this.active.delete(input.key);
    else this.active.set(input.key, { count, expiresAt: Date.now() + this.ttlMs });
    return delta;
  }

  clear(): void { this.active.clear(); }
  private cleanup(): void { const now = Date.now(); for (const [key, value] of this.active) if (value.expiresAt <= now) this.active.delete(key); }
}
