const STOP_WORDS = new Set([
  "a","an","the","is","it","in","on","at","to","for","of","and","or",
  "but","with","this","that","was","are","be","been","has","have","had",
  "do","did","will","would","could","should","what","who","how","when",
  "where","which","there","their","they","we","you","i","my","your","its"
]);

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function computeTFIDF(sentences) {
  const tf = sentences.map(s => {
    const words = tokenize(s);
    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    const total = words.length || 1;
    Object.keys(freq).forEach(w => freq[w] /= total);
    return freq;
  });

  const df = {};
  tf.forEach(freq => {
    Object.keys(freq).forEach(w => df[w] = (df[w] || 0) + 1);
  });

  const n = sentences.length;
  return tf.map(freq => {
    const tfidf = {};
    Object.keys(freq).forEach(w => {
      tfidf[w] = freq[w] * Math.log((n + 1) / (df[w] + 1));
    });
    return tfidf;
  });
}

function sentenceScore(tfidf) {
  const vals = Object.values(tfidf);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function summarize(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || text.split("\n").filter(Boolean);
  if (sentences.length <= 5) return sentences.join("\n\n");
  const tfidf = computeTFIDF(sentences);
  const scored = sentences.map((s, i) => ({ s, score: sentenceScore(tfidf[i]), i }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5).sort((a, b) => a.i - b.i);
  return top.map(x => x.s.trim()).join("\n\n");
}

function smartSearch(text, question) {
  const qWords = tokenize(question);
  if (!qWords.length) return "Could not understand the question.";

  const sentences = text.match(/[^.!?]+[.!?]+/g) || text.split("\n").filter(Boolean);
  const tfidf = computeTFIDF(sentences);

  const scored = sentences.map((s, i) => {
    let score = 0;
    qWords.forEach(w => { if (tfidf[i][w]) score += tfidf[i][w] * 3; });
    const sWords = tokenize(s);
    qWords.forEach(w => { if (sWords.includes(w)) score += 1; });
    return { s: s.trim(), score };
  }).filter(x => x.score > 0);

  if (!scored.length) return "No relevant content found for that question.";

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate near-identical results
  const seen = [];
  const results = [];
  for (const item of scored) {
    const isDupe = seen.some(prev => {
      const a = tokenize(item.s), b = tokenize(prev);
      const shared = a.filter(w => b.includes(w)).length;
      return shared / Math.max(a.length, b.length) > 0.7;
    });
    if (!isDupe) { results.push(item.s); seen.push(item.s); }
    if (results.length >= 5) break;
  }

  return results.join("\n\n");
}

function detectIntent(question) {
  const q = question.toLowerCase();
  if (/summar|overview|brief|tldr|main point/.test(q)) return "summary";
  if (/deadline|due|by when|submit|finish|deliver/.test(q)) return "deadline";
  if (/meeting|call|zoom|schedule|appointment/.test(q)) return "meeting";
  if (/who|person|people|contact|sender|recipient/.test(q)) return "people";
  if (/action|next step|todo|follow.?up|task/.test(q)) return "action";
  if (/date|when|time/.test(q)) return "date";
  return "search";
}

function findPattern(text, patterns) {
  const lines = text.split("\n");
  const matches = [];
  lines.forEach(line => {
    if (patterns.some(p => line.toLowerCase().includes(p))) {
      if (!matches.includes(line.trim()) && line.trim()) matches.push(line.trim());
    }
  });
  return matches.length ? matches.join("\n\n") : "Nothing found for that topic.";
}

document.getElementById("askButton").addEventListener("click", runAI);

function runAI() {
  const memory = document.getElementById("memory").value;
  const question = document.getElementById("question").value;

  if (!memory.trim()) { show("Please paste email or document text."); return; }
  if (!question.trim()) { show("Please enter a question."); return; }

  const intent = detectIntent(question);
  let output = "";

  if (intent === "summary") {
    output = summarize(memory);
  } else if (intent === "deadline") {
    output = findPattern(memory, ["deadline","due","submit","by monday","by friday","deliver","finish","complete"]);
  } else if (intent === "meeting") {
    output = findPattern(memory, ["meeting","call","zoom","teams","schedule","appointment","agenda"]);
  } else if (intent === "people") {
    output = findPattern(memory, ["from:","to:","cc:","regards","sincerely","signed","contact","@"]);
  } else if (intent === "action") {
    output = findPattern(memory, ["please","action","next step","follow up","todo","need to","must","should","asap"]);
  } else if (intent === "date") {
    output = findPattern(memory, ["january","february","march","april","may","june","july","august",
      "september","october","november","december","monday","tuesday","wednesday",
      "thursday","friday","am","pm","2024","2025","2026"]);
  } else {
    output = smartSearch(memory, question);
  }

  show(output);
}

function show(text) {
  document.getElementById("output").innerText = text;
}