/**
 * Core NLP engine – pure JavaScript TextRank implementation.
 * Shared between main thread and Web Worker.
 */
const TextRankEngine = (() => {
  // Tokenisation & preprocessing
  function tokenize(text) {
    return text.toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
  }

  function sentenceSplit(text) {
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  }

  // Build similarity matrix
  function buildSimilarity(sentences) {
    const n = sentences.length;  // ← FIXED: was sentenceslength
    const sim = Array.from({ length: n }, () => Array(n).fill(0));

    const tfidf = sentences.map(s => {
      const tokens = tokenize(s);
      const freq = {};
      tokens.forEach(t => freq[t] = (freq[t] || 0) + 1);
      return freq;
    });

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const overlap = Object.keys(tfidf[i]).filter(t => tfidf[j][t]).length;
        const denom = Math.log(Object.keys(tfidf[i]).length) + Math.log(Object.keys(tfidf[j]).length);
        sim[i][j] = sim[j][i] = denom > 0 ? overlap / denom : 0;
      }
      sim[i][i] = 1; // self-similarity (optional but often set)
    }
    return sim;
  }

  // Power iteration for PageRank
  function powerIteration(sim, maxIter = 100, damping = 0.85) {
    const n = sim.length;
    let scores = new Array(n).fill(1 / n);

    for (let iter = 0; iter < maxIter; iter++) {
      let newScores = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          const rowSum = sim[j].reduce((a, b) => a + b, 0);
          sum += (rowSum > 0 ? sim[j][i] / rowSum : 0) * scores[j];
        }
        newScores[i] = (1 - damping) / n + damping * sum;
      }
      // Check convergence
      let diff = 0;
      for (let i = 0; i < n; i++) diff += Math.abs(scores[i] - newScores[i]);
      scores = newScores;
      if (diff < 1e-6) break;
    }
    return scores;
  }

  // Main summarization function
  function summarize(text, ratio = 0.3, language = 'english') {
    const sentences = sentenceSplit(text);
    if (sentences.length <= 2) return text; // short text

    const sim = buildSimilarity(sentences);
    const scores = powerIteration(sim);

    // Pick top sentences by score
    const indexed = sentences.map((s, i) => ({ sentence: s, score: scores[i], idx: i }));
    indexed.sort((a, b) => b.score - a.score);
    const numSentences = Math.max(1, Math.floor(sentences.length * ratio));
    const selected = indexed.slice(0, numSentences);

    // Return in original order
    selected.sort((a, b) => a.idx - b.idx);
    return selected.map(s => s.sentence.trim()).join(' ');
  }

  // Return public API
  return {
    summarize,
    tokenize,
    sentenceSplit,
    buildSimilarity,
    powerIteration
  };
})();

// CommonJS / ES module export for worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TextRankEngine };
}
