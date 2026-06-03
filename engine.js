/**
 * engine.js — DocAI NLP Core
 * Pure JavaScript. No dependencies. No network.
 * Algorithms: BM25, TF-IDF, extractive summarisation,
 * entity extraction, sentiment, readability, query expansion,
 * co-occurrence graphs, code analysis, comparison engine.
 */

"use strict";

// ═══════════════════════════════════════════════════
//  STOP WORDS — 12 languages
// ═══════════════════════════════════════════════════

const STOP_WORDS = new Set([
  // English
  "a","an","the","is","it","in","on","at","to","for","of","and","or","but","with",
  "this","that","was","are","be","been","has","have","had","do","did","will","would",
  "could","should","what","who","how","when","where","which","there","their","they",
  "we","you","i","my","your","its","by","from","as","if","then","than","so","up",
  "out","about","into","through","during","before","after","above","below","between",
  "each","both","few","more","most","other","some","such","no","nor","not","only",
  "own","same","too","very","just","because","while","although","however","therefore",
  "also","here","these","those","him","her","his","she","he","they","them","our",
  // Spanish
  "el","la","los","las","un","una","de","del","al","en","con","por","para","que","se",
  "su","sus","como","pero","más","este","esta","yo","él","ella","nos","ellos","también",
  // French
  "le","les","une","des","du","au","aux","et","ou","ne","pas","je","tu","il","elle",
  "nous","vous","ils","elles","ce","cet","cette","ces","qui","dont","où","mon","ton",
  "son","mes","tes","ses","notre","votre","leur","leurs","même","très","bien","encore",
  // German
  "der","die","das","ein","eine","und","oder","aber","nicht","ich","du","er","sie",
  "es","wir","ihr","dem","den","des","im","am","vom","beim","zur","zum","ist","sind",
  "war","hatte","wurde","werden","haben","sein","auf","mit","bei","nach","über","unter",
  // Portuguese
  "os","as","um","umas","na","no","nas","nos","da","do","das","dos","se","me","te",
  "uma","para","com","por","mais","também","mas","foi","são","tem","não","esse","essa",
  // Italian
  "il","lo","gli","della","delle","dello","degli","alla","alle","nella","nelle","sono",
  "sei","siamo","avere","essere","anche","così","però","quindi","questo","quella",
  // Dutch
  "de","het","een","van","in","op","aan","met","te","voor","door","zijn","hebben",
  "ook","als","dan","nog","wel","niet","naar","maar","over","uit","bij","kan","wordt",
  // Japanese
  "は","が","を","に","で","と","も","の","や","か","な","ね","よ","から","まで",
  "より","こと","もの","これ","それ","あれ","この","その","あの","ため","について",
  // Chinese
  "的","了","在","是","我","他","她","它","们","这","那","和","也","都","就","但",
  "而","对","从","到","有","没","不","很","会","可","要","说","一","与","被","将",
  // Korean
  "이","가","을","를","은","는","의","에","에서","로","와","과","도","만","한","하다",
  "있다","없다","되다","그","이것","저것","여기","저기","우리","나","너","그들",
  // Arabic
  "في","من","إلى","على","هذا","هذه","التي","الذي","أن","مع","كان","كانت","هو","هي",
  // Russian
  "в","на","и","с","по","за","из","что","как","это","не","но","а","то","он","она",
  "они","мы","вы","я","его","её","их","нас","вас","был","была","были","будет"
]);

// ═══════════════════════════════════════════════════
//  TOKENIZER — Unicode-aware, uses Intl.Segmenter
// ═══════════════════════════════════════════════════

const _wordSeg = (typeof Intl !== "undefined" && Intl.Segmenter)
  ? (() => { try { return new Intl.Segmenter(undefined, { granularity: "word" }); } catch(e) { return null; } })()
  : null;

const _sentSeg = (typeof Intl !== "undefined" && Intl.Segmenter)
  ? (() => { try { return new Intl.Segmenter(undefined, { granularity: "sentence" }); } catch(e) { return null; } })()
  : null;

function tokenize(text, keepStopWords = false) {
  let words;
  if (_wordSeg) {
    words = Array.from(_wordSeg.segment(text))
      .filter(s => s.isWordLike)
      .map(s => s.segment.toLowerCase());
  } else {
    words = text.toLowerCase().split(/[\s\p{P}]+/u).filter(w => w.length > 0);
  }
  return keepStopWords ? words : words.filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function sentences(text) {
  if (_sentSeg) {
    return Array.from(_sentSeg.segment(text)).map(s => s.segment.trim()).filter(Boolean);
  }
  return text.split(/(?<=[.!?。！？‼⁉])\s+|(?<=\n)\n+/).map(s => s.trim()).filter(s => s.length > 5);
}

function paragraphs(text) {
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

// ═══════════════════════════════════════════════════
//  TF-IDF
// ═══════════════════════════════════════════════════

function buildTFIDF(docs) {
  const tf = docs.map(doc => {
    const words = tokenize(doc);
    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    const total = Math.max(words.length, 1);
    const result = {};
    Object.entries(freq).forEach(([w, f]) => result[w] = f / total);
    return result;
  });

  const df = {};
  tf.forEach(f => Object.keys(f).forEach(w => df[w] = (df[w] || 0) + 1));

  const N = docs.length;
  const idf = {};
  Object.entries(df).forEach(([w, d]) => idf[w] = Math.log((N + 1) / (d + 1)) + 1);

  const tfidf = tf.map(f => {
    const v = {};
    Object.entries(f).forEach(([w, tf_]) => v[w] = tf_ * (idf[w] || 1));
    return v;
  });

  return { tfidf, idf, df };
}

// ═══════════════════════════════════════════════════
//  BM25 — better than TF-IDF for retrieval
// ═══════════════════════════════════════════════════

function bm25(queryWords, docs, k1 = 1.5, b = 0.75) {
  const lengths = docs.map(d => tokenize(d).length);
  const avgLen = lengths.reduce((a, x) => a + x, 0) / Math.max(lengths.length, 1);

  const df = {};
  docs.forEach(d => {
    const seen = new Set(tokenize(d));
    seen.forEach(w => df[w] = (df[w] || 0) + 1);
  });

  const N = docs.length;

  return docs.map((doc, i) => {
    const words = tokenize(doc);
    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    const dl = lengths[i];

    return queryWords.reduce((score, w) => {
      const f = freq[w] || 0;
      if (!f) return score;
      const idf = Math.log((N - (df[w] || 0) + 0.5) / ((df[w] || 0) + 0.5) + 1);
      const tf = (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / avgLen));
      return score + idf * tf;
    }, 0);
  });
}

// ═══════════════════════════════════════════════════
//  QUERY EXPANSION via co-occurrence
// ═══════════════════════════════════════════════════

function expandQuery(queryWords, text, windowSize = 5, topN = 6) {
  const tokens = tokenize(text, false);
  const cooccur = {};

  queryWords.forEach(qw => {
    tokens.forEach((t, i) => {
      if (t === qw || t.startsWith(qw.slice(0, 4))) {
        const start = Math.max(0, i - windowSize);
        const end = Math.min(tokens.length - 1, i + windowSize);
        for (let j = start; j <= end; j++) {
          if (j !== i && !queryWords.includes(tokens[j])) {
            cooccur[tokens[j]] = (cooccur[tokens[j]] || 0) + 1;
          }
        }
      }
    });
  });

  const expansions = Object.entries(cooccur)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w);

  return [...new Set([...queryWords, ...expansions])];
}

// ═══════════════════════════════════════════════════
//  EXTRACTIVE SUMMARISER
// ═══════════════════════════════════════════════════

function summarise(text, n = 6) {
  const sents = sentences(text);
  if (sents.length <= n) return sents.join("\n\n");

  const { tfidf } = buildTFIDF(sents);
  const total = sents.length;

  const scored = sents.map((s, i) => {
    const words = tokenize(s);
    if (words.length < 4) return { s, score: 0, i };

    // TF-IDF centroid score
    const vals = Object.values(tfidf[i]);
    const tfidfScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

    // Position: intro and conclusion matter most
    const pos = i === 0 ? 2.2 : i === 1 ? 1.6 : i === total - 1 ? 1.4
      : i < total * 0.15 ? 1.3 : i > total * 0.85 ? 1.2 : 1.0;

    // Optimal length: 10–30 words
    const len = words.length < 5 ? 0.4 : words.length > 60 ? 0.7 : 1.0;

    // Factual signal: numbers, proper nouns, dates
    const factual = /\d|[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(s) ? 1.25 : 1.0;

    // Title-like previous line bonus
    const prevIsTitle = i > 0 && sents[i - 1].length < 60 && !/[.!?]$/.test(sents[i - 1]);

    return { s: s.trim(), score: tfidfScore * pos * len * factual * (prevIsTitle ? 1.1 : 1), i };
  });

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by Jaccard similarity
  const selected = [];
  const usedSets = [];
  for (const item of scored) {
    if (selected.length >= n) break;
    const ws = new Set(tokenize(item.s));
    const isDupe = usedSets.some(prev => {
      const inter = [...ws].filter(w => prev.has(w)).length;
      return inter / Math.max(ws.size + prev.size - inter, 1) > 0.55;
    });
    if (!isDupe) { selected.push(item); usedSets.push(ws); }
  }

  return selected.sort((a, b) => a.i - b.i).map(x => x.s).join("\n\n");
}

// ═══════════════════════════════════════════════════
//  SMART SEARCH — BM25 + TF-IDF + phrase bonus + expansion
// ═══════════════════════════════════════════════════

function search(text, query, topN = 7) {
  const qWords = tokenize(query);
  if (!qWords.length) return { results: [], confidence: 0, expandedWith: [] };

  const sents = sentences(text);
  if (!sents.length) return { results: [], confidence: 0, expandedWith: [] };

  const expanded = expandQuery(qWords, text);
  const newTerms = expanded.filter(w => !qWords.includes(w));

  const bm25Scores = bm25(expanded, sents);
  const { tfidf } = buildTFIDF(sents);

  const scored = sents.map((s, i) => {
    const lower = s.toLowerCase();
    let score = bm25Scores[i];

    // Exact phrase bonus
    if (lower.includes(qWords.join(" "))) score += 6;

    // Individual word bonus
    qWords.forEach(w => { if (lower.includes(w)) score += 0.5; });

    // TF-IDF boost
    qWords.forEach(w => score += (tfidf[i][w] || 0) * 2);

    return { s: s.trim(), score, i };
  }).filter(x => x.score > 0 && x.s.length > 8);

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate
  const seen = [];
  const results = [];
  for (const item of scored) {
    const ws = new Set(tokenize(item.s));
    const isDupe = seen.some(prev => {
      const inter = [...ws].filter(w => prev.has(w)).length;
      return inter / Math.max(ws.size + prev.size - inter, 1) > 0.68;
    });
    if (!isDupe) { results.push(item); seen.push(ws); }
    if (results.length >= topN) break;
  }

  const maxScore = bm25Scores.reduce((a, b) => Math.max(a, b), 0.001);
  const confidence = results.length
    ? Math.min(99, Math.round((results[0].score / maxScore) * 70 + (results.length / topN) * 30))
    : 0;

  return { results: results.map(x => x.s), confidence, expandedWith: newTerms.slice(0, 4) };
}

// ═══════════════════════════════════════════════════
//  ENTITY EXTRACTION
// ═══════════════════════════════════════════════════

const ENTITY_RE = {
  "Emails":       /[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g,
  "URLs":         /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/g,
  "Phone numbers":/(?:\+?\d[\d\s\-().]{6,}\d)/g,
  "Money":        /(?:[$€£¥₹₩₽]\s?\d[\d,. ]*|\d[\d,.]*\s?(?:USD|EUR|GBP|JPY|CNY|dollars?|euros?|pounds?))/gi,
  "Dates":        /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{1,2}(?:st|nd|rd|th)?(?:[,\s]+\d{4})?)\b/gi,
  "Times":        /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]m)?\b/gi,
  "Person names": /\b[A-Z][a-z]{1,15}(?:\s[A-Z]\.?)?\s[A-Z][a-z]{1,20}\b/g,
  "Percentages":  /\d+(?:\.\d+)?%/g,
  "IP addresses": /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  "Hashtags":     /#[\w]+/g,
  "Mentions":     /@[\w]+/g,
};

function extractEntities(text) {
  const result = {};
  for (const [label, re] of Object.entries(ENTITY_RE)) {
    const matches = [...new Set((text.match(new RegExp(re.source, re.flags)) || []).map(m => m.trim()))];
    if (matches.length) result[label] = matches;
  }
  return result;
}

// ═══════════════════════════════════════════════════
//  SENTIMENT ANALYSIS with negation & intensifiers
// ═══════════════════════════════════════════════════

const POS_WORDS = new Set([
  "good","great","excellent","amazing","wonderful","fantastic","happy","pleased","thank",
  "thanks","appreciate","love","best","perfect","congratulations","success","agree","helpful",
  "outstanding","impressive","positive","improve","benefit","opportunity","enjoy","clear",
  "efficient","effective","reliable","innovative","productive","successful","valuable",
  "brilliant","superb","exceptional","magnificent","delightful","enthusiastic","confident",
  "bien","bueno","excelente","merci","super","génial","gut","danke","toll","prima","bene",
  "gracias","parfait","wunderbar","ottimo","uitstekend"
]);

const NEG_WORDS = new Set([
  "bad","terrible","awful","horrible","hate","dislike","disagree","problem","issue","concern",
  "fail","failed","error","wrong","sorry","unfortunately","delay","urgent","complaint",
  "disappointed","frustrated","difficult","impossible","never","reject","refuse","poor",
  "broken","corrupt","missing","lacking","insufficient","inadequate","worse","worst",
  "critical","severe","serious","dangerous","harmful","defective","unreliable","inefficient",
  "mal","malo","terrible","désolé","schlecht","leider","problema","cattivo","problème",
  "schlimm","grave","erreur","fehler","fout"
]);

const INTENSIFIERS = new Set(["very","extremely","absolutely","completely","totally","incredibly","highly","deeply","truly"]);
const NEGATORS = new Set(["not","no","never","neither","nor","don't","doesn't","didn't","isn't","wasn't","won't","wouldn't","couldn't","shouldn't","hardly","barely","scarcely"]);

function sentiment(text) {
  const words = tokenize(text, true);
  let pos = 0, neg = 0;
  let negating = false, intensify = 1;
  let negCount = 0;

  words.forEach((w, i) => {
    if (NEGATORS.has(w)) { negating = true; negCount = 0; return; }
    if (INTENSIFIERS.has(w)) { intensify = 1.5; return; }
    if (negCount++ > 3) negating = false;

    const mult = negating ? -1 : 1;
    if (POS_WORDS.has(w)) { pos += mult * intensify; intensify = 1; }
    else if (NEG_WORDS.has(w)) { neg += mult * intensify; intensify = 1; }
    else intensify = 1;
  });

  const total = pos + neg;
  const score = total === 0 ? 0 : (pos - neg) / (pos + neg);
  const label = score > 0.2 ? "Positive" : score < -0.2 ? "Negative" : "Neutral";
  const magnitude = Math.min(Math.abs(pos - neg) / Math.max(words.length / 10, 1), 1);

  return { label, score: Math.round(score * 100) / 100, magnitude: Math.round(magnitude * 100) / 100, pos: Math.round(pos * 10) / 10, neg: Math.round(Math.abs(neg) * 10) / 10 };
}

// ═══════════════════════════════════════════════════
//  READABILITY — Flesch-Kincaid + Gunning Fog
// ═══════════════════════════════════════════════════

function syllableCount(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  const groups = word.match(/[aeiouy]{1,2}/g);
  return Math.max(groups ? groups.length : 1, 1);
}

function readability(text) {
  const sents = sentences(text);
  const wordMatches = text.match(/\b[a-zA-Z]+\b/g) || [];
  if (!sents.length || !wordMatches.length) return null;

  const totalSyllables = wordMatches.reduce((acc, w) => acc + syllableCount(w), 0);
  const asl = wordMatches.length / sents.length;
  const asw = totalSyllables / wordMatches.length;

  // Flesch Reading Ease
  const fre = Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * asl - 84.6 * asw)));

  // Gunning Fog
  const complexWords = wordMatches.filter(w => syllableCount(w) >= 3).length;
  const fog = Math.round(0.4 * (asl + 100 * complexWords / wordMatches.length));

  const level = fre >= 90 ? "Very Easy" : fre >= 80 ? "Easy" : fre >= 70 ? "Fairly Easy"
    : fre >= 60 ? "Standard" : fre >= 50 ? "Fairly Difficult" : fre >= 30 ? "Difficult" : "Very Difficult";

  return {
    fleschScore: fre, gunningFog: fog, level,
    words: wordMatches.length, sentences: sents.length,
    avgSentenceLength: Math.round(asl * 10) / 10,
    avgSyllables: Math.round(asw * 100) / 100,
    complexWordPct: Math.round(complexWords / wordMatches.length * 100)
  };
}

// ═══════════════════════════════════════════════════
//  KEYWORD EXTRACTION — TF-IDF + RAKE hybrid
// ═══════════════════════════════════════════════════

function extractKeywords(text, n = 15) {
  const sents = sentences(text);
  if (!sents.length) return [];
  const { idf } = buildTFIDF(sents);

  const allWords = tokenize(text);
  const freq = {};
  allWords.forEach(w => freq[w] = (freq[w] || 0) + 1);

  // RAKE-style: also look for multi-word phrases
  const phrases = [];
  const rawTokens = text.toLowerCase().split(/[\s,;:!?。！？]+/);
  let current = [];
  rawTokens.forEach(t => {
    const clean = t.replace(/[^\w\u00C0-\u024F\u4e00-\u9fff]/g, "");
    if (clean && !STOP_WORDS.has(clean)) {
      current.push(clean);
    } else {
      if (current.length >= 2 && current.length <= 4) phrases.push(current.join(" "));
      current = [];
    }
  });

  const singleScores = Object.entries(freq)
    .filter(([w]) => idf[w])
    .map(([w, f]) => ({ term: w, score: f * (idf[w] || 1), type: "word" }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);

  const phraseFreq = {};
  phrases.forEach(p => phraseFreq[p] = (phraseFreq[p] || 0) + 1);
  const topPhrases = Object.entries(phraseFreq)
    .filter(([, f]) => f > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.floor(n / 3))
    .map(([p, f]) => ({ term: p, score: f * 2, type: "phrase" }));

  return [...topPhrases, ...singleScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// ═══════════════════════════════════════════════════
//  CO-OCCURRENCE GRAPH — word relationship mapping
// ═══════════════════════════════════════════════════

function buildCooccurrenceGraph(text, topN = 20, window = 4) {
  const tokens = tokenize(text);
  const freq = {};
  tokens.forEach(w => freq[w] = (freq[w] || 0) + 1);

  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w);

  const topSet = new Set(topWords);
  const edges = {};

  tokens.forEach((w, i) => {
    if (!topSet.has(w)) return;
    for (let j = i + 1; j <= Math.min(i + window, tokens.length - 1); j++) {
      if (!topSet.has(tokens[j])) continue;
      const key = [w, tokens[j]].sort().join("|||");
      edges[key] = (edges[key] || 0) + 1;
    }
  });

  return {
    nodes: topWords.map(w => ({ word: w, freq: freq[w] })),
    edges: Object.entries(edges)
      .map(([key, weight]) => { const [a, b] = key.split("|||"); return { a, b, weight }; })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, topN * 2)
  };
}

// ═══════════════════════════════════════════════════
//  DOCUMENT STRUCTURE ANALYSIS
// ═══════════════════════════════════════════════════

function analyseStructure(text) {
  const lines = text.split("\n");
  const paras = paragraphs(text);
  const sents = sentences(text);
  const words = tokenize(text, true);
  const uniqueWords = new Set(tokenize(text)).size;

  // Detect headers (short lines, possibly title-cased or ALL CAPS)
  const headers = lines.filter(l => {
    const t = l.trim();
    return t.length > 2 && t.length < 80 && (
      /^[A-Z][A-Z\s]{3,}$/.test(t) ||
      /^#{1,6}\s/.test(t) ||
      (t === t.toUpperCase() && t.length < 50) ||
      (/^[A-Z]/.test(t) && !t.endsWith(".") && t.split(" ").length < 8)
    );
  }).slice(0, 10);

  // Detect lists
  const listItems = lines.filter(l => /^\s*(?:[-*•·▸▹►]|\d+[.):])\s/.test(l));

  // Detect emails
  const isEmail = /^(?:from|to|cc|bcc|subject|date):/im.test(text);
  const isCode = !!detectCodeLanguage(text);
  const isMarkdown = /^#{1,6}\s|^\*\*|^```/m.test(text);

  // Lexical diversity (type-token ratio)
  const ttr = Math.round(uniqueWords / Math.max(words.length, 1) * 100);

  return {
    type: isCode ? "code" : isEmail ? "email" : isMarkdown ? "markdown" : "document",
    paragraphs: paras.length,
    sentences: sents.length,
    words: words.length,
    uniqueWords,
    lexicalDiversity: ttr,
    headers: headers.slice(0, 5),
    hasLists: listItems.length > 0,
    listItemCount: listItems.length,
    avgWordsPerSentence: Math.round(words.length / Math.max(sents.length, 1) * 10) / 10,
    avgSentencesPerParagraph: Math.round(sents.length / Math.max(paras.length, 1) * 10) / 10,
  };
}

// ═══════════════════════════════════════════════════
//  TIMELINE EXTRACTION
// ═══════════════════════════════════════════════════

function extractTimeline(text) {
  const sents = sentences(text);
  const dateRe = /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:[,\s]+\d{2,4})?|\b\d{4}\b)\b/gi;

  const events = [];
  sents.forEach(s => {
    const dates = s.match(dateRe);
    if (dates) events.push({ date: dates[0], sentence: s.trim() });
  });

  return events.slice(0, 15);
}

// ═══════════════════════════════════════════════════
//  DOCUMENT COMPARISON
// ═══════════════════════════════════════════════════

function compareDocuments(text) {
  const sep = text.split(/\n[-=]{3,}\n/);
  if (sep.length < 2) return null;

  const [a, b] = sep;
  const wordsA = new Set(tokenize(a));
  const wordsB = new Set(tokenize(b));

  const onlyA = [...wordsA].filter(w => !wordsB.has(w));
  const onlyB = [...wordsB].filter(w => !wordsA.has(w));
  const shared = [...wordsA].filter(w => wordsB.has(w));
  const jaccard = shared.length / Math.max(wordsA.size + wordsB.size - shared.length, 1);

  const sentA = sentiment(a);
  const sentB = sentiment(b);
  const readA = readability(a);
  const readB = readability(b);
  const kwA = extractKeywords(a, 8).map(k => k.term);
  const kwB = extractKeywords(b, 8).map(k => k.term);

  // Key differences: sentences in A not covered in B
  const sentsA = sentences(a);
  const sentsB = sentences(b);
  const bm25B = bm25(tokenize(b), sentsA);
  const uniqueToA = sentsA
    .map((s, i) => ({ s, score: bm25B[i] }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(x => x.s);

  return {
    similarity: Math.round(jaccard * 100),
    sentimentA: sentA.label, sentimentB: sentB.label,
    readabilityA: readA ? readA.level : "N/A",
    readabilityB: readB ? readB.level : "N/A",
    keywordsA: kwA, keywordsB: kwB,
    sharedTopics: shared.slice(0, 12),
    uniqueToFirst: onlyA.slice(0, 10),
    uniqueToSecond: onlyB.slice(0, 10),
    contentUniqueToFirst: uniqueToA,
    wordCountA: tokenize(a, true).length,
    wordCountB: tokenize(b, true).length,
  };
}

// ═══════════════════════════════════════════════════
//  CODE ANALYSIS ENGINE
// ═══════════════════════════════════════════════════

const CODE_SIGS = [
  { lang:"python",     pats:[/^\s*def /m,/^\s*import /m,/from .+ import/,/:\s*$/m,/class \w+:/] },
  { lang:"javascript", pats:[/function\s+\w+\s*\(/,/(?:const|let|var)\s+\w/,/=>\s*[{(]/,/require\s*\(/,/export\s+(?:default|const)/] },
  { lang:"typescript", pats:[/:\s*(?:string|number|boolean|void|any)\b/,/interface\s+\w+/,/type\s+\w+\s*=/,/<\w+>/,/as\s+\w+/] },
  { lang:"html",       pats:[/<html/i,/<div/i,/<body/i,/<script/i,/<link/i] },
  { lang:"css",        pats:[/\{[^}]*:[^}]*\}/,/^\s*[.#@]/m,/@(?:media|keyframes|import)/,/:\s*(?:flex|grid|block|none)/] },
  { lang:"java",       pats:[/public\s+class/,/public\s+static\s+void\s+main/,/System\.out/,/import\s+java\./] },
  { lang:"c",          pats:[/#include\s*</,/int\s+main\s*\(/,/printf\s*\(/,/(?:malloc|calloc|free)\s*\(/] },
  { lang:"cpp",        pats:[/#include\s*<(?:iostream|vector|string)>/,/std::/,/cout\s*<</,/cin\s*>>/] },
  { lang:"rust",       pats:[/fn\s+main\s*\(\)/,/let\s+mut\s+/,/println!\s*\(/,/use\s+std::/,/impl\s+\w+/] },
  { lang:"go",         pats:[/^package\s+\w+/m,/func\s+\w+\s*\(/,/fmt\.Print/,/^import\s+\(/m] },
  { lang:"php",        pats:[/<\?php/,/\$\w+\s*=/,/echo\s+/,->/,/::/] },
  { lang:"ruby",       pats:[/def\s+\w+/,/\bend\b/,/puts\s+/,/require\s+['"]/,/\.each\s+do\s*\|/] },
  { lang:"swift",      pats:[/func\s+\w+\s*\(/,/(?:var|let)\s+\w+\s*:\s*\w+/,/import\s+Foundation/,/guard\s+let/] },
  { lang:"kotlin",     pats:[/fun\s+\w+\s*\(/,/(?:val|var)\s+\w+/,/println\s*\(/,/import\s+kotlin\./] },
  { lang:"sql",        pats:[/SELECT\s+.+FROM/i,/INSERT\s+INTO/i,/CREATE\s+TABLE/i,/WHERE\s+\w+/i] },
  { lang:"bash",       pats:[/^#!\/(?:bin|usr)/m,/\$\(\(/,/\[\[/,/\bfi\b/,/\bdone\b/] },
  { lang:"json",       pats:[/^\s*\{[\s\S]*"[\w]+":/m,/^\s*\[[\s\S]*\{/m] },
  { lang:"yaml",       pats:[/^[\w-]+:\s*$/m,/^\s{2,}-\s+\w/m,/^---/m] },
  { lang:"markdown",   pats:[/^#{1,6}\s+\w/m,/^\s*[-*]\s+\w/m,/\[.+\]\(.+\)/,/```\w*/] },
  { lang:"r",          pats:[/<-\s*function/,/library\s*\(/,/\bdata\.frame\b/,/\bggplot\s*\(/] },
  { lang:"scala",      pats:[/\bobject\s+\w+/,/\bdef\s+\w+\s*:/,/\bval\s+\w+\s*:/,/import\s+scala\./] },
  { lang:"haskell",    pats:[/\bmodule\s+\w+/,/\bwhere\b/,/\blet\s+\w+\s*=/,/\bdo\b/] },
  { lang:"lua",        pats:[/\bfunction\s+\w+\s*\(/,/\blocal\s+\w+/,/\bthen\b/,/\bend\b/] },
  { lang:"perl",       pats:[/\buse\s+strict\b/,/\bmy\s+\$/,/\bsub\s+\w+/,/\bprint\s+/] },
];

function detectCodeLanguage(text) {
  let best = null, bestScore = 0;
  for (const { lang, pats } of CODE_SIGS) {
    const score = pats.filter(p => p.test(text)).length;
    if (score > bestScore) { bestScore = score; best = lang; }
  }
  return bestScore >= 2 ? best : null;
}

const CODE_EXTRACTORS = {
  functions: {
    python:     /^\s*(?:async\s+)?def\s+(\w+)\s*\(/gm,
    javascript: /(?:function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\())/g,
    typescript: /(?:function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\())/g,
    java:       /(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)/g,
    cpp:        /[\w:*&]+\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{/g,
    rust:       /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g,
    go:         /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/g,
    php:        /function\s+(\w+)\s*\(/g,
    ruby:       /def\s+(?:self\.)?(\w+[?!]?)/g,
    swift:      /func\s+(\w+)\s*[<(]/g,
    kotlin:     /fun\s+(\w+)\s*[<(]/g,
    lua:        /function\s+(\w+)\s*\(/g,
    r:          /(\w+)\s*<-\s*function\s*\(/g,
    scala:      /def\s+(\w+)\s*[:(]/g,
    bash:       /^\s*(\w+)\s*\(\s*\)\s*\{/gm,
  },
  classes: {
    python:     /^\s*class\s+(\w+)/gm,
    javascript: /class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g,
    typescript: /(?:export\s+)?(?:abstract\s+)?(?:class|interface|type|enum)\s+(\w+)/g,
    java:       /(?:public|private|protected|abstract|\s)*class\s+(\w+)/g,
    cpp:        /(?:class|struct|enum)\s+(\w+)/g,
    rust:       /(?:struct|impl|enum|trait)\s+(\w+)/g,
    php:        /(?:abstract\s+)?class\s+(\w+)/g,
    ruby:       /class\s+(\w+)/g,
    swift:      /(?:class|struct|enum|protocol|extension)\s+(\w+)/g,
    kotlin:     /(?:class|object|interface|data\s+class|sealed\s+class|enum\s+class)\s+(\w+)/g,
    scala:      /(?:class|object|trait|case\s+class)\s+(\w+)/g,
  },
  imports: {
    python:     /^\s*(?:import\s+\S+|from\s+\S+\s+import\s+.+)/gm,
    javascript: /^\s*(?:import\s+.+from\s+['"].+['"]|(?:const|let|var)\s+\w+\s*=\s*require\s*\(.+\))/gm,
    typescript: /^\s*import\s+(?:type\s+)?(?:.+from\s+)?['"].+['"]/gm,
    java:       /^\s*import\s+[\w.]+(?:\.\*)?;/gm,
    cpp:        /^\s*#include\s*[<"].+[>"]/gm,
    rust:       /^\s*use\s+[\w::{},\s*]+;/gm,
    go:         /^\s*import\s+(?:"[\w./]+"|\([\s\S]*?\))/gm,
    php:        /^\s*(?:use|require(?:_once)?|include(?:_once)?)\s+.+/gm,
    ruby:       /^\s*require(?:_relative)?\s+['"].+['"]/gm,
    swift:      /^\s*import\s+\w+/gm,
    kotlin:     /^\s*import\s+[\w.]+(?:\.\*)?/gm,
    r:          /^\s*library\s*\(\s*\w+\s*\)/gm,
    scala:      /^\s*import\s+[\w.{}]+/gm,
    lua:        /^\s*require\s*\(['"].+['"]\)/gm,
  }
};

function extractCodeItems(text, lang, type) {
  const re = CODE_EXTRACTORS[type]?.[lang];
  if (!re) return [];
  const r = new RegExp(re.source, re.flags);
  const matches = [];
  let m;
  while ((m = r.exec(text)) !== null) {
    const name = m[1] || m[2];
    if (name && name.length > 1 && !matches.includes(name)) matches.push(name);
  }
  return matches;
}

function codeComplexity(text) {
  const lines = text.split("\n");
  const codeLines = lines.filter(l => {
    const t = l.trim();
    return t && !t.startsWith("//") && !t.startsWith("#") && !t.startsWith("--") && !t.startsWith("/*") && !t.startsWith("*");
  }).length;

  const openers = (text.match(/[{(\[]/g) || []).length;
  const closers = (text.match(/[})\]]/g) || []).length;
  const balance = Math.abs(openers - closers);

  const conditions = (text.match(/\b(?:if|else|elif|for|while|switch|case|catch|rescue|except|&&|\|\||\?)\b/g) || []).length;
  const cyclomatic = conditions + 1;

  let maxDepth = 0, depth = 0;
  text.split("").forEach(ch => {
    if (ch === "{" || ch === "(") { depth++; if (depth > maxDepth) maxDepth = depth; }
    else if (ch === "}" || ch === ")") depth = Math.max(0, depth - 1);
  });

  const rating = cyclomatic < 5 ? "Very Low" : cyclomatic < 10 ? "Low" : cyclomatic < 20 ? "Moderate" : cyclomatic < 30 ? "High" : "Very High";

  return {
    totalLines: lines.length,
    codeLines,
    commentLines: lines.length - codeLines,
    maxNestingDepth: maxDepth,
    braceBalance: balance,
    cyclomaticComplexity: cyclomatic,
    complexityRating: rating
  };
}

function analyseCode(text, lang) {
  const fns = extractCodeItems(text, lang, "functions");
  const cls = extractCodeItems(text, lang, "classes");
  const imp = extractCodeItems(text, lang, "imports");
  const cmx = codeComplexity(text);

  return { lang, functions: fns, classes: cls, imports: imp, complexity: cmx };
}

// ═══════════════════════════════════════════════════
//  QUESTION ANSWERING — pattern-based extraction
// ═══════════════════════════════════════════════════

const FIND_PATTERNS = {
  deadline: ["deadline","due","submit","deliver","by monday","by tuesday","by wednesday","by thursday","by friday","by end","overdue","expir","urgent","asap","immediately",
             "plazo","délai","frist","締め切り","截止","마감"],
  meeting:  ["meeting","call","zoom","teams","meet","conference","schedule","appointment","agenda","standup","sync","catch up","discuss",
             "réunion","treffen","besprechung","会議","회의","会议"],
  people:   ["from:","to:","cc:","bcc:","@","regards","sincerely","yours truly","signed","dear","hi ","hello ","hey ","greetings","mr.","ms.","dr.","prof.",
             "cordialement","mit freundlichen","distinti saluti","atenciosamente"],
  action:   ["please","action required","action item","next step","follow up","todo","to do","need to","must","should","asap","kindly","requesting","required","assigned",
             "por favor","s'il vous plaît","bitte","お願い","请","부탁"],
  date:     ["2023","2024","2025","2026","monday","tuesday","wednesday","thursday","friday","saturday","sunday",
             "january","february","march","april","june","july","august","september","october","november","december",
             "lunes","martes","lundi","mardi","月","年","주","월요일"],
  risk:     ["risk","issue","concern","problem","blocker","obstacle","challenge","error","fail","failure","warning","critical","severe","breach","vulnerable","threat","bug","defect"],
  decision: ["decided","decision","agreed","approved","rejected","chosen","selected","confirmed","resolved","concluded","voted","determined"],
};

function findByPattern(text, key) {
  const patterns = FIND_PATTERNS[key];
  const sents = sentences(text);
  const matches = [];
  sents.forEach(s => {
    const lower = s.toLowerCase();
    if (patterns.some(p => lower.includes(p)) && !matches.includes(s.trim())) {
      matches.push(s.trim());
    }
  });
  return matches;
}

// ═══════════════════════════════════════════════════
//  INTENT DETECTION
// ═══════════════════════════════════════════════════

const INTENT_MAP = {
  summary:     [/\b(?:summar|overview|brief|tldr|tl.dr|main point|key point|gist|nutshell|digest|recap|outline)\b/,
                /\b(?:resumen|résumé|zusammenfassung|要約|总结|요약)\b/],
  entities:    [/\b(?:who|email|phone|url|link|name|number|contact|amount|money|price|percent|mention|hashtag|ip address|address)\b/],
  sentiment:   [/\b(?:sentiment|tone|feel|mood|positiv|negativ|angry|happy|upset|formal|opinion|attitude|emotion)\b/],
  readability: [/\b(?:readab|difficult|easy|grade|level|complex|simple|understand|clarity|flesch|fog)\b/],
  keywords:    [/\b(?:keyword|topic|theme|about|subject|tag|key word|main word|phrase|concept)\b/],
  structure:   [/\b(?:structure|format|layout|organis|organiz|section|paragraph|header|type of document)\b/],
  timeline:    [/\b(?:timeline|chronolog|when did|sequence|order of event|history|what happened)\b/],
  compare:     [/\b(?:compar|differ|versus|vs\.?|contrast|similar|same|both|between|which is better)\b/],
  deadline:    [/\b(?:deadline|due|by when|submit|finish|deliver|expir|overdue|urgent)\b/],
  meeting:     [/\b(?:meeting|call|zoom|schedule|appointment|agenda|calendar|standup|sync)\b/],
  action:      [/\b(?:action|next step|todo|follow.?up|task|assign|responsible|who should|what to do)\b/],
  people:      [/\b(?:who|person|people|contact|sender|recipient|author|from|signed|cc|participants)\b/],
  date:        [/\b(?:when|date|time|day|month|year|schedul|monday|tuesday|wednesday|thursday|friday)\b/],
  risk:        [/\b(?:risk|issue|problem|concern|blocker|obstacle|challenge|danger|threat|warning|bug)\b/],
  decision:    [/\b(?:decision|decided|agreed|approved|rejected|outcome|result|conclusion|voted)\b/],
  code:        [/\b(?:function|class|method|import|variable|const|def|struct|interface|complexity|dependency|bug|syntax)\b/],
};

function detectIntent(question) {
  const q = question.toLowerCase();
  for (const [intent, patterns] of Object.entries(INTENT_MAP)) {
    if (patterns.some(p => p.test(q))) return intent;
  }
  return "search";
}

// ═══════════════════════════════════════════════════
//  MAIN ANALYSE FUNCTION — called by worker & direct
// ═══════════════════════════════════════════════════

function analyse(text, question) {
  const lang = detectCodeLanguage(text);

  if (lang) {
    return handleCode(text, lang, question);
  }
  return handleDocument(text, question);
}

function handleCode(text, lang, question) {
  const q = question.toLowerCase();
  const qWords = tokenize(question);
  const data = analyseCode(text, lang);

  if (/\b(?:summar|overview|what does|what is this|explain|describ|analys|analyz)\b/.test(q)) {
    return { type: "code_summary", lang, data };
  }
  if (/\b(?:function|method|def|procedure|routine|subroutine)\b/.test(q)) {
    return { type: "code_functions", lang, items: data.functions };
  }
  if (/\b(?:class|struct|interface|type|object|inherit|extend)\b/.test(q)) {
    return { type: "code_classes", lang, items: data.classes };
  }
  if (/\b(?:import|require|depend|librar|package|module|use)\b/.test(q)) {
    return { type: "code_imports", lang, items: data.imports };
  }
  if (/\b(?:complex|cyclomat|nest|depth|length|line|size|metric|quality)\b/.test(q)) {
    return { type: "code_complexity", lang, data: data.complexity };
  }

  // Line search
  const lines = text.split("\n");
  const defRe = /^\s*(?:def |function |class |const |let |var |fn |func |pub |async |private |public |interface |type |struct )/;
  const hits = lines.map((line, i) => {
    const lower = line.toLowerCase();
    let score = qWords.filter(w => lower.includes(w)).length;
    if (defRe.test(line)) score += 0.5;
    return score > 0 && line.trim() ? { line: line.trim(), score, lineNum: i + 1 } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10);

  return { type: "code_search", lang, hits, summary: data };
}

function handleDocument(text, question) {
  const intent = detectIntent(question);

  switch (intent) {
    case "summary":
      return {
        type: "summary",
        text: summarise(text),
        keywords: extractKeywords(text, 10).map(k => k.term),
        structure: analyseStructure(text),
      };

    case "entities":
      return { type: "entities", data: extractEntities(text) };

    case "sentiment":
      return {
        type: "sentiment",
        data: sentiment(text),
        topSentences: search(text, "important significant key", 3).results,
      };

    case "readability":
      return { type: "readability", data: readability(text) };

    case "keywords":
      return {
        type: "keywords",
        data: extractKeywords(text, 20),
        graph: buildCooccurrenceGraph(text, 15),
      };

    case "structure":
      return { type: "structure", data: analyseStructure(text) };

    case "timeline":
      return { type: "timeline", events: extractTimeline(text) };

    case "compare": {
      const cmp = compareDocuments(text);
      return cmp
        ? { type: "compare", data: cmp }
        : { type: "compare_error" };
    }

    case "deadline":   return { type: "pattern", key: "deadline",  results: findByPattern(text, "deadline") };
    case "meeting":    return { type: "pattern", key: "meeting",   results: findByPattern(text, "meeting") };
    case "action":     return { type: "pattern", key: "action",    results: findByPattern(text, "action") };
    case "people":     return { type: "pattern", key: "people",    results: findByPattern(text, "people") };
    case "date":       return { type: "pattern", key: "date",      results: findByPattern(text, "date") };
    case "risk":       return { type: "pattern", key: "risk",      results: findByPattern(text, "risk") };
    case "decision":   return { type: "pattern", key: "decision",  results: findByPattern(text, "decision") };

    default: {
      const result = search(text, question);
      return { type: "search", ...result };
    }
  }
}

// Export for use in worker and directly
if (typeof module !== "undefined") module.exports = { analyse, detectCodeLanguage };
if (typeof self !== "undefined" && self.WorkerGlobalScope !== undefined) {
  self.onmessage = ({ data: { text, question, id } }) => {
    try {
      const result = analyse(text, question);
      self.postMessage({ id, result });
    } catch (err) {
      self.postMessage({ id, error: err.message });
    }
  };
}