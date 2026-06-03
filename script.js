// --- Language-aware tokenizer ---

const STOP_WORDS = new Set([
  // English
  "a","an","the","is","it","in","on","at","to","for","of","and","or",
  "but","with","this","that","was","are","be","been","has","have","had",
  "do","did","will","would","could","should","what","who","how","when",
  "where","which","there","their","they","we","you","i","my","your","its",
  // Spanish
  "el","la","los","las","un","una","unos","unas","de","del","al","en",
  "con","por","para","que","se","su","sus","como","pero","más","este",
  "esta","estos","estas","yo","tú","él","ella","nos","ellos",
  // French
  "le","les","une","des","du","au","aux","et","ou","ne","pas","je","tu",
  "il","elle","nous","vous","ils","elles","ce","cet","cette","ces","qui",
  "que","dont","où","mon","ton","son","ma","ta","sa","mes","tes","ses",
  // German
  "der","die","das","ein","eine","und","oder","aber","nicht","ich","du",
  "er","sie","es","wir","ihr","sie","mir","dir","ihm","ihr","uns","euch",
  "dem","den","des","im","am","vom","beim","zur","zum","ist","sind","war",
  // Portuguese
  "os","as","um","umas","na","no","nas","nos","da","do","das","dos","se",
  "me","te","lhe","lhes","meu","teu","seu","nossa","vossa","sua",
  // Italian
  "il","lo","gli","dello","degli","alla","alle","dello","degli","nella",
  "nelle","della","delle","sono","sei","siamo","siete","essere","avere",
  // Dutch
  "de","het","een","van","in","op","aan","met","te","voor","door","zijn",
  "hebben","worden","er","maar","ook","als","dan","nog","wel","niet",
  // Japanese particles/common
  "は","が","を","に","で","と","も","の","や","か","な","ね","よ","から",
  "まで","より","こと","もの","これ","それ","あれ","この","その","あの",
  // Chinese common
  "的","了","在","是","我","他","她","它","们","这","那","和","与","也",
  "都","就","但","而","对","从","到","有","没","不","很","会","可","要",
  // Korean
  "이","가","을","를","은","는","의","에","에서","로","으로","와","과",
  "도","만","부터","까지","한","하다","있다","없다","되다","그","이것",
  // Arabic common
  "في","من","إلى","على","هذا","هذه","التي","الذي","أن","مع","كان",
  // Russian
  "в","на","и","с","по","за","из","что","как","это","не","но","а","то",
  "он","она","они","мы","вы","я","его","её","их","нас","вас"
]);

function getSegmenter(granularity) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    try { return new Intl.Segmenter(undefined, { granularity }); }
    catch(e) { return null; }
  }
  return null;
}

function splitWords(text) {
  const segmenter = getSegmenter("word");
  if (segmenter) {
    return Array.from(segmenter.segment(text))
      .filter(s => s.isWordLike)
      .map(s => s.segment.toLowerCase())
      .filter(w => w.length > 0 && !STOP_WORDS.has(w));
  }
  // Fallback: split on whitespace + punctuation, keep Unicode chars
  return text.toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function splitSentences(text) {
  const segmenter = getSegmenter("sentence");
  if (segmenter) {
    return Array.from(segmenter.segment(text))
      .map(s => s.segment.trim())
      .filter(Boolean);
  }
  // Fallback: handles Latin + CJK sentence endings
  return text
    .split(/(?<=[.!?。！？\n])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// --- TF-IDF (unchanged logic, now language-aware via tokenizer) ---

function computeTFIDF(sentences) {
  const tf = sentences.map(s => {
    const words = splitWords(s);
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

// --- Summarize ---

function summarize(text) {
  const sentences = splitSentences(text);
  if (sentences.length <= 5) return sentences.join("\n\n");
  const tfidf = computeTFIDF(sentences);
  const scored = sentences.map((s, i) => ({ s, score: sentenceScore(tfidf[i]), i }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).sort((a, b) => a.i - b.i).map(x => x.s).join("\n\n");
}

// --- Smart search ---

function smartSearch(text, question) {
  const qWords = splitWords(question);
  if (!qWords.length) return "Could not understand the question.";

  const sentences = splitSentences(text);
  const tfidf = computeTFIDF(sentences);

  const scored = sentences.map((s, i) => {
    let score = 0;
    qWords.forEach(w => { if (tfidf[i][w]) score += tfidf[i][w] * 3; });
    const sWords = splitWords(s);
    qWords.forEach(w => { if (sWords.includes(w)) score += 1; });
    return { s: s.trim(), score };
  }).filter(x => x.score > 0);

  if (!scored.length) return "No relevant content found for that question.";
  scored.sort((a, b) => b.score - a.score);

  const seen = [];
  const results = [];
  for (const item of scored) {
    const a = splitWords(item.s);
    const isDupe = seen.some(prev => {
      const b = splitWords(prev);
      const shared = a.filter(w => b.includes(w)).length;
      return shared / Math.max(a.length, b.length, 1) > 0.7;
    });
    if (!isDupe) { results.push(item.s); seen.push(item.s); }
    if (results.length >= 5) break;
  }
  return results.join("\n\n");
}

// --- Intent detection (multilingual keywords) ---

const INTENT_PATTERNS = {
  summary: [
    /summar|overview|brief|tldr|main point/,                        // English
    /resumen|resúmen|sinopsis|puntos principales/,                   // Spanish
    /résumé|synthèse|aperçu|points principaux/,                     // French
    /zusammenfassung|überblick|kurzfassung/,                        // German
    /要約|概要|まとめ|サマリー/,                                      // Japanese
    /总结|摘要|概述|要点/,                                           // Chinese
    /요약|개요|정리/,                                                 // Korean
    /ملخص|موجز/,                                                     // Arabic
    /краткое|резюме|обзор/                                           // Russian
  ],
  deadline: [
    /deadline|due|by when|submit|finish|deliver/,
    /plazo|fecha límite|entregar|vencimiento/,
    /délai|date limite|soumettre|livrer/,
    /frist|abgabe|liefern|termin/,
    /締め切り|期限|提出|納期/,
    /截止|期限|提交|截止日期/,
    /마감|기한|제출|납기/
  ],
  meeting: [
    /meeting|call|zoom|schedule|appointment|agenda/,
    /reunión|llamada|cita|horario/,
    /réunion|appel|rendez-vous|agenda/,
    /treffen|besprechung|termin|anruf/,
    /ミーティング|会議|打ち合わせ|スケジュール/,
    /会议|通话|日程|安排/,
    /회의|통화|일정|약속/
  ],
  people: [
    /who|person|people|contact|sender|recipient/,
    /quién|persona|personas|contacto|remitente/,
    /qui|personne|gens|contact|expéditeur/,
    /wer|person|leute|kontakt|absender/,
    /誰|人|連絡先|送信者/,
    /谁|人|联系人|发件人/,
    /누구|사람|연락처|발신자/
  ],
  action: [
    /action|next step|todo|follow.?up|task|please|must|should/,
    /acción|siguiente paso|tarea|seguimiento|por favor/,
    /action|prochaine étape|tâche|suivi|s'il vous plaît/,
    /aktion|nächster schritt|aufgabe|nachverfolgung|bitte/,
    /アクション|次のステップ|タスク|フォローアップ|お願い/,
    /行动|下一步|任务|跟进|请/,
    /행동|다음 단계|작업|팔로업|부탁/
  ],
  date: [
    /january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}/,
    /enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|lunes|martes|miércoles|jueves|viernes/,
    /janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|lundi|mardi|mercredi|jeudi|vendredi/,
    /januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|montag|dienstag|mittwoch|donnerstag|freitag/,
    /月|年|日|週|月曜|火曜|水曜|木曜|金曜/,
    /年|月|日|周|星期|月份/,
    /년|월|일|주|월요일|화요일|수요일|목요일|금요일/
  ]
};

function detectIntent(question) {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some(p => p.test(question.toLowerCase()))) return intent;
  }
  return "search";
}

// --- Keyword finder (Unicode-safe) ---

const FIND_PATTERNS = {
  deadline: ["deadline","due","submit","deliver","plazo","délai","frist","締め切り","截止","마감"],
  meeting:  ["meeting","call","zoom","teams","reunión","réunion","treffen","会議","会议","회의"],
  people:   ["from:","to:","cc:","@","regards","sincerely","cordialement","mit freundlichen"],
  action:   ["please","action","next step","por favor","s'il vous plaît","bitte","お願い","请","부탁"],
  date:     ["2024","2025","2026","monday","tuesday","wednesday","thursday","friday",
             "lunes","martes","janvier","februar","月","年","월","년"]
};

function findPattern(text, patternKey) {
  const patterns = FIND_PATTERNS[patternKey];
  const lines = text.split("\n");
  const matches = [];
  lines.forEach(line => {
    const lower = line.toLowerCase();
    if (patterns.some(p => lower.includes(p)) && line.trim() && !matches.includes(line.trim())) {
      matches.push(line.trim());
    }
  });
  return matches.length ? matches.join("\n\n") : "Nothing found for that topic.";
}

// --- Main ---

document.getElementById("askButton").addEventListener("click", runAI);

function runAI() {
  const memory = document.getElementById("memory").value;
  const question = document.getElementById("question").value;

  if (!memory.trim()) { show("Please paste email or document text."); return; }
  if (!question.trim()) { show("Please enter a question."); return; }

  const intent = detectIntent(question);

  const output =
    intent === "summary"  ? summarize(memory) :
    intent === "people"   ? findPattern(memory, "people") :
    intent === "action"   ? findPattern(memory, "action") :
    intent === "date"     ? findPattern(memory, "date") :
    intent === "deadline" ? findPattern(memory, "deadline") :
    intent === "meeting"  ? findPattern(memory, "meeting") :
    smartSearch(memory, question);

  show(output);
}

function show(text) {
  document.getElementById("output").innerText = text;
}