export class TikTokEventDeduplicator {
  private readonly ids = new Map<string, number>();
  private readonly ttlMs = 5 * 60_000;
  dropped = 0;

  accept(id: string): boolean {
    this.cleanup();
    if (this.ids.has(id)) { this.dropped++; return false; }
    this.ids.set(id, Date.now() + this.ttlMs);
    return true;
  }

  clear(): void { this.ids.clear(); this.dropped = 0; }
  private cleanup(): void { const now = Date.now(); for (const [id, expiresAt] of this.ids) if (expiresAt <= now) this.ids.delete(id); }
}
