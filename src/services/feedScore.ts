export interface ScoreOptions {
  maxPages: number;
  maxAgeDays: number;
}

export function scoreBook(pages: number, ageInDays: number, opts: ScoreOptions): number {
  const normalizedPages = Math.min(pages, opts.maxPages) / opts.maxPages;
  const normalizedAge = Math.min(ageInDays, opts.maxAgeDays) / opts.maxAgeDays;

  return 0.8 * normalizedPages + 0.2 * normalizedAge;
}
