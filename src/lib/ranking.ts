export const SCORING_VERSION = "phase1-v1";

export type EngagementSignals = {
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
};

export type RankInput = {
  text: string;
  query: string;
  publishedAt: string | null;
  apiPosition: number;
  resultCount: number;
  engagement?: EngagementSignals;
  now?: Date;
};

export type RankResult = {
  relevance: number;
  recency: number;
  apiOrder: number;
  engagement: number | null;
  replyLike: number | null;
  total: number;
  availableSignals: string[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round(value: number) {
  return Number(clamp(value).toFixed(5));
}

function tokens(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function relevanceScore(text: string, query: string) {
  const haystack = text.toLowerCase();
  const queryTokens = [...new Set(tokens(query))];
  if (queryTokens.length === 0) return 0;

  const coverage =
    queryTokens.filter((token) => haystack.includes(token)).length / queryTokens.length;
  const exactPhrase = haystack.includes(query.trim().toLowerCase()) ? 1 : 0;
  return round(coverage * 0.75 + exactPhrase * 0.25);
}

export function recencyScore(
  publishedAt: string | null,
  now = new Date(),
  halfLifeHours = 72,
) {
  if (!publishedAt) return 0;
  const timestamp = new Date(publishedAt).getTime();
  if (Number.isNaN(timestamp)) return 0;
  const ageHours = Math.max(0, now.getTime() - timestamp) / 3_600_000;
  return round(Math.exp((-Math.log(2) * ageHours) / halfLifeHours));
}

export function engagementScores(signals: EngagementSignals) {
  const values = [signals.likes, signals.replies, signals.reposts, signals.quotes];
  if (values.every((value) => value === null)) {
    return { engagement: null, replyLike: null };
  }

  const likes = signals.likes ?? 0;
  const replies = signals.replies ?? 0;
  const reposts = signals.reposts ?? 0;
  const quotes = signals.quotes ?? 0;
  const weighted = likes + replies * 2.5 + reposts * 3 + quotes * 3;
  const engagement = round(Math.log1p(weighted) / Math.log1p(10_000));
  const replyLike =
    signals.likes === null || signals.replies === null
      ? null
      : round(Math.min(replies / Math.max(likes, 1), 0.2) / 0.2);

  return { engagement, replyLike };
}

export function rankPost(input: RankInput): RankResult {
  const relevance = relevanceScore(input.text, input.query);
  const recency = recencyScore(input.publishedAt, input.now);
  const apiOrder = round(
    1 - input.apiPosition / Math.max(1, input.resultCount - 1),
  );
  const { engagement, replyLike } = input.engagement
    ? engagementScores(input.engagement)
    : { engagement: null, replyLike: null };

  const availableSignals = ["relevance", "recency", "api_order"];
  let total: number;

  if (engagement !== null) {
    availableSignals.push("likes", "replies", "reposts", "quotes");
    if (replyLike !== null) availableSignals.push("reply_like_ratio");
    total =
      relevance * 0.35 +
      recency * 0.2 +
      engagement * 0.3 +
      (replyLike ?? 0) * 0.15;
  } else {
    total = relevance * 0.55 + recency * 0.3 + apiOrder * 0.15;
  }

  return {
    relevance,
    recency,
    apiOrder,
    engagement,
    replyLike,
    total: round(total),
    availableSignals,
  };
}
