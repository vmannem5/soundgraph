class RateLimiter {
  private lastRequest = 0
  private readonly minInterval: number

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond
  }

  async wait(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequest
    if (elapsed < this.minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minInterval - elapsed)
      )
    }
    this.lastRequest = Date.now()
  }
}

export const mbRateLimiter = new RateLimiter(1) // 1 req/sec for MusicBrainz
