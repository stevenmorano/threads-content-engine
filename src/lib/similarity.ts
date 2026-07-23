export type SimilarityResult = {
  score: number;
  wordBigram: number;
  characterTrigram: number;
  phrasePressure: number;
};

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ngrams(value: string, size: number) {
  const result = new Set<string>();
  for (let index = 0; index <= value.length - size; index += 1) {
    result.add(value.slice(index, index + size));
  }
  return result;
}

function wordNgrams(value: string, size: number) {
  const words = normalize(value).split(" ").filter(Boolean);
  const result = new Set<string>();
  for (let index = 0; index <= words.length - size; index += 1) {
    result.add(words.slice(index, index + size).join(" "));
  }
  return result;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (left.size === 0 && right.size === 0) return 1;
  const intersection = [...left].filter((value) => right.has(value)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function longestSharedPhrase(left: string, right: string) {
  const a = normalize(left).split(" ").filter(Boolean);
  const b = normalize(right).split(" ").filter(Boolean);
  if (a.length === 0 || b.length === 0) return 0;

  const row = new Array<number>(b.length + 1).fill(0);
  let longest = 0;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = b.length; j >= 1; j -= 1) {
      row[j] = a[i - 1] === b[j - 1] ? row[j - 1] + 1 : 0;
      longest = Math.max(longest, row[j]);
    }
  }
  return longest / Math.max(1, Math.min(a.length, b.length));
}

export function calculateSimilarity(draft: string, source: string): SimilarityResult {
  const normalizedDraft = normalize(draft);
  const normalizedSource = normalize(source);
  const wordBigram = jaccard(wordNgrams(draft, 2), wordNgrams(source, 2));
  const characterTrigram = jaccard(
    ngrams(normalizedDraft, 3),
    ngrams(normalizedSource, 3),
  );
  const phrasePressure = longestSharedPhrase(draft, source);
  const score = Math.max(
    wordBigram * 0.45 + characterTrigram * 0.35 + phrasePressure * 0.2,
    phrasePressure >= 0.65 ? phrasePressure : 0,
  );

  return {
    score: Number(Math.min(1, score).toFixed(5)),
    wordBigram: Number(wordBigram.toFixed(5)),
    characterTrigram: Number(characterTrigram.toFixed(5)),
    phrasePressure: Number(phrasePressure.toFixed(5)),
  };
}

export function compareAgainstSources(draft: string, sources: string[]) {
  const comparisons = sources.map((source) => calculateSimilarity(draft, source));
  return {
    comparisons,
    maxScore: comparisons.reduce((max, item) => Math.max(max, item.score), 0),
  };
}
