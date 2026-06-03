                    // ============================================================
                    //  SMART DOC/EMAIL/CODE AI — Pure JS, No Dependencies
                    //  Features: TF-IDF, BM25, extractive summarization,
                    //  entity extraction, sentiment, readability, code analysis,
                    //  multilingual, query expansion, answer confidence scoring
                    // ============================================================


                    // ─────────────────────────────────────────────
                    //  STOP WORDS (multilingual)
                    // ─────────────────────────────────────────────

                    const STOP_WORDS = new Set([
                    "a","an","the","is","it","in","on","at","to","for","of","and","or","but","with",
                    "this","that","was","are","be","been","has","have","had","do","did","will","would",
                    "could","should","what","who","how","when","where","which","there","their","they",
                    "we","you","i","my","your","its","by","from","as","if","then","than","so","up",
                    "out","about","into","through","during","before","after","above","below","between",
                    "each","both","few","more","most","other","some","such","no","nor","not","only",
                    "own","same","too","very","just","because","while","although","however","therefore",
                    "el","la","los","las","un","una","de","del","al","en","con","por","para","que","se",
                    "su","sus","como","pero","más","este","esta","yo","él","ella","nos","ellos",
                    "le","les","une","des","du","au","aux","et","ou","ne","pas","je","tu","il","elle",
                    "nous","vous","ils","elles","ce","cet","cette","ces","qui","dont","où","mon","ton",
                    "der","die","das","ein","eine","und","oder","aber","nicht","ich","du","er","sie",
                    "es","wir","ihr","dem","den","des","im","am","vom","beim","zur","zum","ist","sind",
                    "os","as","um","umas","na","no","nas","nos","da","do","das","dos","me","te",
                    "il","lo","gli","della","delle","sono","sei","siamo","avere",
                    "de","het","een","van","op","aan","met","te","door","zijn","hebben","ook","als",
                    "は","が","を","に","で","と","も","の","や","か","な","ね","よ","から","まで",
                    "的","了","在","是","我","他","她","它","们","这","那","和","也","都","就","但",
                    "이","가","을","를","은","는","의","에","에서","로","와","과","도","만","한",
                    "في","من","إلى","على","هذا","هذه","التي","الذي","أن","مع","كان",
                    "в","на","и","с","по","за","из","что","как","это","не","но","а","то","он","она"
                    ]);


                    // ─────────────────────────────────────────────
                    //  LANGUAGE-AWARE TOKENIZER
                    // ─────────────────────────────────────────────

                    function getSegmenter(granularity) {
                    if (typeof Intl !== "undefined" && Intl.Segmenter) {
                        try { return new Intl.Segmenter(undefined, { granularity }); } catch(e) {}
                    }
                    return null;
                    }

                    function splitWords(text, includeStopWords = false) {
                    const seg = getSegmenter("word");
                    let words;
                    if (seg) {
                        words = Array.from(seg.segment(text))
                        .filter(s => s.isWordLike)
                        .map(s => s.segment.toLowerCase());
                    } else {
                        words = text.toLowerCase().split(/[\s\p{P}]+/u).filter(w => w.length > 0);
                    }
                    return includeStopWords ? words : words.filter(w => w.length > 1 && !STOP_WORDS.has(w));
                    }

                    function splitSentences(text) {
                    const seg = getSegmenter("sentence");
                    if (seg) {
                        return Array.from(seg.segment(text)).map(s => s.segment.trim()).filter(Boolean);
                    }
                    return text.split(/(?<=[.!?。！？])\s+|(?<=\n)\n+/).map(s => s.trim()).filter(Boolean);
                    }

                    function splitParagraphs(text) {
                    return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
                    }


                    // ─────────────────────────────────────────────
                    //  TF-IDF ENGINE
                    // ─────────────────────────────────────────────

                    function buildTFIDF(sentences) {
                    const tf = sentences.map(s => {
                        const words = splitWords(s);
                        const freq = {};
                        words.forEach(w => freq[w] = (freq[w] || 0) + 1);
                        const total = words.length || 1;
                        Object.keys(freq).forEach(w => freq[w] /= total);
                        return freq;
                    });

                    const df = {};
                    tf.forEach(freq => Object.keys(freq).forEach(w => df[w] = (df[w] || 0) + 1));

                    const n = sentences.length;
                    const idf = {};
                    Object.keys(df).forEach(w => idf[w] = Math.log((n + 1) / (df[w] + 1)) + 1);

                    const tfidf = tf.map(freq => {
                        const v = {};
                        Object.keys(freq).forEach(w => v[w] = freq[w] * (idf[w] || 1));
                        return v;
                    });

                    return { tfidf, idf };
                    }


                    // ─────────────────────────────────────────────
                    //  BM25 RANKING (smarter than TF-IDF for search)
                    // ─────────────────────────────────────────────

                    function bm25Score(query, sentences, k1 = 1.5, b = 0.75) {
                    const qWords = splitWords(query);
                    const docLengths = sentences.map(s => splitWords(s).length);
                    const avgLen = docLengths.reduce((a, b) => a + b, 0) / (docLengths.length || 1);

                    const df = {};
                    sentences.forEach(s => {
                        const seen = new Set();
                        splitWords(s).forEach(w => { if (!seen.has(w)) { df[w] = (df[w] || 0) + 1; seen.add(w); } });
                    });

                    const n = sentences.length;

                    return sentences.map((s, i) => {
                        const words = splitWords(s);
                        const freq = {};
                        words.forEach(w => freq[w] = (freq[w] || 0) + 1);
                        const dl = docLengths[i];

                        let score = 0;
                        qWords.forEach(w => {
                        const f = freq[w] || 0;
                        if (f === 0) return;
                        const idf = Math.log((n - (df[w] || 0) + 0.5) / ((df[w] || 0) + 0.5) + 1);
                        const tf = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgLen)));
                        score += idf * tf;
                        });
                        return score;
                    });
                    }


                    // ─────────────────────────────────────────────
                    //  QUERY EXPANSION
                    //  Finds related words in the document itself
                    // ─────────────────────────────────────────────

                    function expandQuery(query, text) {
                    const qWords = splitWords(query);
                    const allWords = splitWords(text);
                    const freq = {};
                    allWords.forEach(w => freq[w] = (freq[w] || 0) + 1);

                    // Co-occurrence: words that appear near query words in the text
                    const tokens = text.toLowerCase().split(/\s+/);
                    const cooccur = {};
                    qWords.forEach(qw => {
                        tokens.forEach((t, i) => {
                        if (t.includes(qw)) {
                            for (let j = Math.max(0, i-4); j <= Math.min(tokens.length-1, i+4); j++) {
                            const w = tokens[j].replace(/[^a-z0-9\u00C0-\u024F\u4e00-\u9fff]/gi, "");
                            if (w && !STOP_WORDS.has(w) && !qWords.includes(w)) {
                                cooccur[w] = (cooccur[w] || 0) + 1;
                            }
                            }
                        }
                        });
                    });

                    const expansions = Object.entries(cooccur)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([w]) => w);

                    return [...new Set([...qWords, ...expansions])];
                    }


                    // ─────────────────────────────────────────────
                    //  EXTRACTIVE SUMMARIZER
                    //  Position bias + TF-IDF + sentence length scoring
                    // ─────────────────────────────────────────────

                    function summarize(text, numSentences = 6) {
                    const sentences = splitSentences(text);
                    if (sentences.length <= numSentences) return sentences.join("\n\n");

                    const { tfidf } = buildTFIDF(sentences);
                    const n = sentences.length;

                    const scored = sentences.map((s, i) => {
                        const words = splitWords(s);
                        if (words.length < 4) return { s, score: 0, i };

                        // TF-IDF importance
                        const vals = Object.values(tfidf[i]);
                        const tfidfScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

                        // Position bias: first and last sentences matter more
                        const posBias = i === 0 ? 2.0
                        : i === 1 ? 1.5
                        : i === n - 1 ? 1.3
                        : i < n * 0.2 ? 1.2
                        : i > n * 0.8 ? 1.1
                        : 1.0;

                        // Length penalty: very short or very long sentences score lower
                        const lenScore = words.length < 6 ? 0.5
                        : words.length > 50 ? 0.8
                        : 1.0;

                        // Bonus for sentences with numbers, dates, names (likely factual)
                        const hasFactual = /\d|[A-Z][a-z]+\s[A-Z][a-z]+|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(s) ? 1.2 : 1.0;

                        return { s: s.trim(), score: tfidfScore * posBias * lenScore * hasFactual, i };
                    });

                    scored.sort((a, b) => b.score - a.score);

                    // Remove near-duplicates
                    const selected = [];
                    const usedWords = [];
                    for (const item of scored) {
                        if (selected.length >= numSentences) break;
                        const words = splitWords(item.s);
                        const isDupe = usedWords.some(prev => {
                        const shared = words.filter(w => prev.includes(w)).length;
                        return shared / Math.max(words.length, prev.length, 1) > 0.65;
                        });
                        if (!isDupe) { selected.push(item); usedWords.push(words); }
                    }

                    return selected.sort((a, b) => a.i - b.i).map(x => x.s).join("\n\n");
                    }


                    // ─────────────────────────────────────────────
                    //  ENTITY EXTRACTION
                    //  Names, emails, dates, URLs, phone numbers, money
                    // ─────────────────────────────────────────────

                    const ENTITY_PATTERNS = {
                    emails:   { re: /[\w.+-]+@[\w-]+\.[a-z]{2,}/gi,                          label: "Emails" },
                    urls:     { re: /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/gi,                 label: "URLs" },
                    phones:   { re: /(?:\+?\d[\d\s\-().]{7,}\d)/g,                           label: "Phone numbers" },
                    money:    { re: /(?:[$€£¥₹]\s?\d[\d,.]*|\d[\d,.]*\s?(?:USD|EUR|GBP|JPY|dollars?|euros?|pounds?))/gi, label: "Amounts" },
                    dates:    { re: /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/gi, label: "Dates" },
                    times:    { re: /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]m)?\b/gi,          label: "Times" },
                    names:    { re: /\b[A-Z][a-z]+ (?:[A-Z]\. )?[A-Z][a-z]+\b/g,            label: "Names" },
                    percentages: { re: /\d+(?:\.\d+)?%/g,                                    label: "Percentages" },
                    };

                    function extractEntities(text) {
                    const result = {};
                    for (const [type, { re, label }] of Object.entries(ENTITY_PATTERNS)) {
                        const matches = [...new Set((text.match(re) || []).map(m => m.trim()))];
                        if (matches.length) result[label] = matches;
                    }
                    return result;
                    }


                    // ─────────────────────────────────────────────
                    //  SENTIMENT ANALYSIS
                    // ─────────────────────────────────────────────

                    const SENTIMENT_WORDS = {
                    positive: new Set(["good","great","excellent","amazing","wonderful","fantastic","happy","pleased",
                        "thank","thanks","appreciate","love","best","perfect","congratulations","success","agree",
                        "helpful","outstanding","impressive","positive","improve","benefit","opportunity","enjoy",
                        "bien","bueno","excelente","merci","super","génial","gut","danke","toll","prima","bene"]),
                    negative: new Set(["bad","terrible","awful","horrible","hate","dislike","disagree","problem",
                        "issue","concern","fail","failed","error","wrong","sorry","unfortunately","delay","urgent",
                        "complaint","disappointed","frustrated","difficult","impossible","never","reject","refuse",
                        "mal","malo","terrible","désolé","schlecht","leider","problema","cattivo","problème"])
                    };

                    function analyzeSentiment(text) {
                    const words = splitWords(text, true);
                    let pos = 0, neg = 0, total = 0;
                    let negating = false;

                    words.forEach((w, i) => {
                        if (["not","no","never","don't","doesn't","isn't","wasn't","won't","wouldn't","couldn't"].includes(w)) {
                        negating = true; return;
                        }
                        if (SENTIMENT_WORDS.positive.has(w)) { negating ? neg++ : pos++; total++; }
                        else if (SENTIMENT_WORDS.negative.has(w)) { negating ? pos++ : neg++; total++; }
                        else if (i % 3 === 0) negating = false;
                    });

                    if (total === 0) return { label: "Neutral", score: 0, pos: 0, neg: 0 };
                    const score = (pos - neg) / total;
                    const label = score > 0.15 ? "Positive" : score < -0.15 ? "Negative" : "Neutral";
                    return { label, score: Math.round(score * 100) / 100, pos, neg };
                    }


                    // ─────────────────────────────────────────────
                    //  READABILITY (Flesch-Kincaid adapted)
                    // ─────────────────────────────────────────────

                    function countSyllables(word) {
                    word = word.toLowerCase().replace(/[^a-z]/g, "");
                    if (word.length <= 3) return 1;
                    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
                    const vowelGroups = word.match(/[aeiouy]{1,2}/g);
                    return vowelGroups ? vowelGroups.length : 1;
                    }

                    function readabilityScore(text) {
                    const sentences = splitSentences(text);
                    const words = text.match(/\b\w+\b/g) || [];
                    if (sentences.length === 0 || words.length === 0) return null;

                    const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
                    const asl = words.length / sentences.length;
                    const asw = syllables / words.length;
                    const fk = 206.835 - 1.015 * asl - 84.6 * asw;
                    const score = Math.max(0, Math.min(100, Math.round(fk)));

                    const level = score >= 90 ? "Very Easy (Grade 5)"
                        : score >= 80 ? "Easy (Grade 6)"
                        : score >= 70 ? "Fairly Easy (Grade 7)"
                        : score >= 60 ? "Standard (Grade 8-9)"
                        : score >= 50 ? "Fairly Difficult (Grade 10-12)"
                        : score >= 30 ? "Difficult (College)"
                        : "Very Difficult (College+)";

                    return { score, level, words: words.length, sentences: sentences.length, asl: Math.round(asl * 10) / 10 };
                    }


                    // ─────────────────────────────────────────────
                    //  KEYWORD EXTRACTION
                    //  Top N most significant words by TF-IDF
                    // ─────────────────────────────────────────────

                    function extractKeywords(text, n = 12) {
                    const sentences = splitSentences(text);
                    if (!sentences.length) return [];
                    const { idf } = buildTFIDF(sentences);

                    const allWords = splitWords(text);
                    const freq = {};
                    allWords.forEach(w => freq[w] = (freq[w] || 0) + 1);

                    return Object.entries(freq)
                        .map(([w, f]) => ({ word: w, score: f * (idf[w] || 1) }))
                        .sort((a, b) => b.score - a.score)
                        .slice(0, n)
                        .map(x => x.word);
                    }


                    // ─────────────────────────────────────────────
                    //  SMART SEARCH with BM25 + query expansion
                    //  + confidence scoring + deduplication
                    // ─────────────────────────────────────────────

                    function smartSearch(text, question, topN = 6) {
                    const qWords = splitWords(question);
                    if (!qWords.length) return { results: [], confidence: 0 };

                    const expanded = expandQuery(question, text);
                    const sentences = splitSentences(text);
                    if (!sentences.length) return { results: [], confidence: 0 };

                    const bm25 = bm25Score(expanded.join(" "), sentences);
                    const { tfidf } = buildTFIDF(sentences);

                    const scored = sentences.map((s, i) => {
                        let score = bm25[i];

                        // Exact phrase bonus
                        const lowerS = s.toLowerCase();
                        const qPhrase = qWords.join(" ");
                        if (lowerS.includes(qPhrase)) score += 5;

                        // Partial phrase bonus
                        qWords.forEach(w => { if (lowerS.includes(w)) score += 0.3; });

                        // TF-IDF boost
                        const tfidfBoost = qWords.reduce((acc, w) => acc + (tfidf[i][w] || 0), 0);
                        score += tfidfBoost;

                        return { s: s.trim(), score, i };
                    }).filter(x => x.score > 0 && x.s.length > 10);

                    scored.sort((a, b) => b.score - a.score);

                    // Deduplicate
                    const seen = [];
                    const results = [];
                    for (const item of scored) {
                        const a = splitWords(item.s);
                        const isDupe = seen.some(prev => {
                        const shared = a.filter(w => prev.includes(w)).length;
                        return shared / Math.max(a.length, prev.length, 1) > 0.7;
                        });
                        if (!isDupe) { results.push(item); seen.push(a); }
                        if (results.length >= topN) break;
                    }

                    const maxPossible = sentences.length > 0 ? bm25.reduce((a, b) => Math.max(a, b), 0) : 1;
                    const confidence = results.length > 0
                        ? Math.min(100, Math.round((results[0].score / Math.max(maxPossible, 1)) * 80 + (results.length / topN) * 20))
                        : 0;

                    return { results: results.map(x => x.s), confidence };
                    }


                    // ─────────────────────────────────────────────
                    //  COMPARISON MODE
                    //  Compare two documents or sections
                    // ─────────────────────────────────────────────

                    function compareTexts(text) {
                    const parts = text.split(/\n[-=]{3,}\n/);
                    if (parts.length < 2) return null;

                    const [a, b] = parts;
                    const wordsA = new Set(splitWords(a));
                    const wordsB = new Set(splitWords(b));

                    const onlyA = [...wordsA].filter(w => !wordsB.has(w));
                    const onlyB = [...wordsB].filter(w => !wordsA.has(w));
                    const shared = [...wordsA].filter(w => wordsB.has(w));
                    const similarity = Math.round(shared.length / Math.max(wordsA.size + wordsB.size - shared.length, 1) * 100);

                    const sentA = analyzeSentiment(a);
                    const sentB = analyzeSentiment(b);

                    return {
                        similarity,
                        uniqueToFirst: onlyA.slice(0, 10),
                        uniqueToSecond: onlyB.slice(0, 10),
                        sharedTopics: shared.slice(0, 10),
                        sentimentA: sentA.label,
                        sentimentB: sentB.label,
                        keywordsA: extractKeywords(a, 6),
                        keywordsB: extractKeywords(b, 6),
                    };
                    }


                    // ─────────────────────────────────────────────
                    //  CODE ANALYSIS ENGINE
                    // ─────────────────────────────────────────────

                    const CODE_SIGNATURES = [
                    { lang: "python",     patterns: [/^\s*def /m, /^\s*import /m, /^\s*from .+ import/m, /:\s*$/m, /^\s*class \w+:/m] },
                    { lang: "javascript", patterns: [/function\s+\w+\s*\(/, /(?:const|let|var)\s+\w/, /=>\s*[{(]/, /require\s*\(/, /export\s+(?:default|const)/] },
                    { lang: "typescript", patterns: [/:\s*(?:string|number|boolean|void|any|never)\b/, /interface\s+\w+/, /type\s+\w+\s*=/, /<\w+>/, /as\s+\w+/] },
                    { lang: "html",       patterns: [/<html/i, /<div/i, /<body/i, /<script/i, /<link/i] },
                    { lang: "css",        patterns: [/\{[^}]*:[^}]*\}/, /^\s*[.#@]/m, /@(?:media|keyframes|import)/, /:\s*(?:flex|grid|block|none)\b/] },
                    { lang: "java",       patterns: [/public\s+class/, /public\s+static\s+void\s+main/, /System\.out\.print/, /import\s+java\./] },
                    { lang: "c",          patterns: [/#include\s*</, /int\s+main\s*\(/, /printf\s*\(/, /(?:malloc|calloc|free)\s*\(/] },
                    { lang: "cpp",        patterns: [/#include\s*<(?:iostream|vector|string)>/, /std::/, /cout\s*<</, /cin\s*>>/] },
                    { lang: "rust",       patterns: [/fn\s+main\s*\(\)/, /let\s+mut\s+/, /println!\s*\(/, /use\s+std::/, /impl\s+\w+/] },
                    { lang: "go",         patterns: [/^package\s+\w+/m, /func\s+\w+\s*\(/, /fmt\.Print/, /^import\s+\(/m] },
                    { lang: "php",        patterns: [/<\?php/, /\$\w+\s*=/, /echo\s+/, /->/, /::/] },
                    { lang: "ruby",       patterns: [/def\s+\w+/, /\bend\b/, /puts\s+/, /require\s+['"]/, /\.each\s+do\s*\|/] },
                    { lang: "swift",      patterns: [/func\s+\w+\s*\(/, /(?:var|let)\s+\w+\s*:\s*\w+/, /import\s+Foundation/, /guard\s+let/] },
                    { lang: "kotlin",     patterns: [/fun\s+\w+\s*\(/, /(?:val|var)\s+\w+/, /println\s*\(/, /import\s+kotlin\./] },
                    { lang: "sql",        patterns: [/SELECT\s+.+\s+FROM/i, /INSERT\s+INTO/i, /CREATE\s+TABLE/i, /WHERE\s+\w+/i] },
                    { lang: "bash",       patterns: [/^#!\/(?:bin|usr)\/(?:env\s+)?(?:bash|sh)/m, /\$\(\(/, /\[\[/, /\bfi\b/, /\bdone\b/] },
                    { lang: "json",       patterns: [/^\s*\{[\s\S]*"[\w]+"\s*:/m, /^\s*\[[\s\S]*\{/m] },
                    { lang: "yaml",       patterns: [/^[\w]+:\s*$/m, /^\s{2,}-\s+\w/m, /^---/m] },
                    { lang: "markdown",   patterns: [/^#{1,6}\s+\w/m, /^\s*[-*]\s+\w/m, /\[.+\]\(.+\)/, /```\w*/] },
                    ];

                    function detectCodeLanguage(text) {
                    let best = null, bestScore = 0;
                    for (const { lang, patterns } of CODE_SIGNATURES) {
                        const score = patterns.filter(p => p.test(text)).length;
                        if (score > bestScore) { bestScore = score; best = lang; }
                    }
                    return bestScore >= 2 ? best : null;
                    }

                    const EXTRACTORS = {
                    functions: {
                        python:     /^\s*(?:async\s+)?def\s+(\w+)\s*\(/gm,
                        javascript: /(?:function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\())/g,
                        typescript: /(?:function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\())/g,
                        java:       /(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?\{/g,
                        cpp:        /[\w:*&]+\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{/g,
                        rust:       /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[<(]/g,
                        go:         /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/g,
                        php:        /(?:public|private|protected|static|\s)*function\s+(\w+)\s*\(/g,
                        ruby:       /def\s+(?:self\.)?(\w+[?!]?)/g,
                        swift:      /(?:func|init)\s+(\w+)\s*[<(]/g,
                        kotlin:     /(?:fun|constructor)\s+(\w+)\s*[<(]/g,
                        bash:       /^\s*(\w+)\s*\(\s*\)\s*\{/gm,
                    },
                    classes: {
                        python:     /^\s*class\s+(\w+)\s*(?:\(|:)/gm,
                        javascript: /class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g,
                        typescript: /(?:export\s+)?(?:abstract\s+)?(?:class|interface|type|enum)\s+(\w+)/g,
                        java:       /(?:public|private|protected|abstract|\s)*class\s+(\w+)/g,
                        cpp:        /(?:class|struct|enum)\s+(\w+)/g,
                        rust:       /(?:struct|impl|enum|trait)\s+(\w+)/g,
                        php:        /(?:abstract\s+)?class\s+(\w+)/g,
                        ruby:       /class\s+(\w+)/g,
                        swift:      /(?:class|struct|enum|protocol|extension)\s+(\w+)/g,
                        kotlin:     /(?:class|object|interface|data\s+class|sealed\s+class|enum\s+class)\s+(\w+)/g,
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
                    }
                    };

                    function extractCodeItems(text, lang, type) {
                    const re = EXTRACTORS[type]?.[lang];
                    if (!re) return [];
                    const matches = [];
                    const r = new RegExp(re.source, re.flags);
                    let m;
                    while ((m = r.exec(text)) !== null) {
                        const name = m[1] || m[2];
                        if (name && !matches.includes(name) && name.length > 1) matches.push(name);
                    }
                    return matches;
                    }

                    function analyzeComplexity(text, lang) {
                    const lines = text.split("\n");
                    const nonEmpty = lines.filter(l => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("#")).length;

                    let nestingDepth = 0, maxNesting = 0, currentDepth = 0;
                    const openers = /[{(\[]/g, closers = /[})\]]/g;
                    text.split("\n").forEach(line => {
                        const opens = (line.match(openers) || []).length;
                        const closes = (line.match(closers) || []).length;
                        currentDepth += opens - closes;
                        if (currentDepth > maxNesting) maxNesting = currentDepth;
                        if (currentDepth < 0) currentDepth = 0;
                    });

                    // Cyclomatic complexity estimate
                    const conditionKeywords = /\b(?:if|else|elif|for|while|switch|case|catch|&&|\|\||ternary|\?)\b/g;
                    const conditions = (text.match(conditionKeywords) || []).length;
                    const cyclomaticEstimate = conditions + 1;

                    const complexity = cyclomaticEstimate < 10 ? "Low" : cyclomaticEstimate < 20 ? "Moderate" : "High";

                    return { lines: lines.length, nonEmpty, maxNesting, cyclomaticEstimate, complexity };
                    }

                    function summarizeCode(text, lang) {
                    const functions = extractCodeItems(text, lang, "functions");
                    const classes   = extractCodeItems(text, lang, "classes");
                    const imports   = extractCodeItems(text, lang, "imports");
                    const complexity = analyzeComplexity(text, lang);

                    let out = `Language: ${lang.toUpperCase()}\n`;
                    out += `Lines: ${complexity.lines} (${complexity.nonEmpty} code lines)\n`;
                    out += `Complexity: ${complexity.complexity} (cyclomatic estimate: ${complexity.cyclomaticEstimate})\n`;
                    out += `Max nesting depth: ${complexity.maxNesting}\n`;

                    if (classes.length)    out += `\nClasses / types (${classes.length}):\n  ${classes.join(", ")}`;
                    if (functions.length)  out += `\nFunctions / methods (${functions.length}):\n  ${functions.join(", ")}`;
                    if (imports.length)    out += `\nDependencies (${imports.length}):\n  ${imports.slice(0, 15).join("\n  ")}`;

                    return out;
                    }

                    function findInCode(text, lang, questionWords) {
                    const lines = text.split("\n");
                    const defKeywords = /^\s*(?:def |function |class |const |let |var |fn |func |pub |async |private |public |protected |interface |type |struct )/;

                    const scored = lines.map((line, i) => {
                        const lower = line.toLowerCase();
                        let score = questionWords.filter(w => lower.includes(w)).length;
                        if (defKeywords.test(line)) score += 0.5;
                        if (score > 0 && line.trim()) return { line: line.trim(), score, i };
                        return null;
                    }).filter(Boolean);

                    scored.sort((a, b) => b.score - a.score);
                    if (!scored.length) return null;
                    return scored.slice(0, 8).map(x => `Line ${x.i + 1}: ${x.line}`).join("\n");
                    }


                    // ─────────────────────────────────────────────
                    //  INTENT DETECTION (multilingual)
                    // ─────────────────────────────────────────────

                    const INTENTS = {
                    summary:   [/summar|overview|brief|tldr|main point|key point|gist|nutshell/,
                                /resumen|sinopsis|résumé|synthèse|zusammenfassung|要約|概要|总结|요약/],
                    entities:  [/who|email|phone|date|url|link|name|number|contact|amount|money|price|percent/,
                                /quién|fecha|teléfono|qui|date|téléphone|wer|datum|telefon|誰|日付/],
                    sentiment: [/sentiment|tone|feel|mood|positiv|negativ|angry|happy|upset|formal|opinion/,
                                /感情|雰囲気|tono|sentimiento|ton|sentiment|stimmung/],
                    readability:[/readab|difficult|easy|grade|level|complex|simple|understand/,
                                /lisibilité|lesbarkeit|lesbaarheid|读懂|読みやすさ/],
                    keywords:  [/keyword|topic|theme|about|subject|tag|key word|main word/,
                                /mot.clé|schlüsselwort|palabra clave|キーワード|关键词|키워드/],
                    deadline:  [/deadline|due|by when|submit|finish|deliver|expir|overdue/,
                                /plazo|vencimiento|délai|frist|締め切り|截止|마감/],
                    meeting:   [/meeting|call|zoom|schedule|appointment|agenda|calendar|standup|sync/,
                                /réunion|treffen|besprechung|会議|会议|회의/],
                    action:    [/action|next step|todo|follow.?up|task|please|must|should|need to|assign/,
                                /acción|action|aktion|アクション|행동|行动/],
                    people:    [/who|person|people|contact|sender|recipient|author|from|signed|cc/,
                                /quién|personne|wer|person|誰|谁|누구/],
                    date:      [/when|date|time|day|month|year|schedul|monday|tuesday|wednesday|thursday|friday/,
                                /cuándo|quand|wann|いつ|什么时候|언제/],
                    compare:   [/compar|differ|versus|vs|contrast|similar|same|both|between/,
                                /comparer|vergleich|比較|对比|비교/],
                    code:      [/function|class|method|import|variable|const|let|var|def|struct|interface|complexity/],
                    };

                    function detectIntent(question) {
                    const q = question.toLowerCase();
                    for (const [intent, patterns] of Object.entries(INTENTS)) {
                        if (patterns.some(p => p.test(q))) return intent;
                    }
                    return "search";
                    }


                    // ─────────────────────────────────────────────
                    //  PATTERN FINDER (for structured email/doc)
                    // ─────────────────────────────────────────────

                    const FIND_SETS = {
                    deadline: ["deadline","due","submit","deliver","by monday","by friday","by end","overdue","expir",
                                "plazo","délai","frist","締め切り","截止","마감"],
                    meeting:  ["meeting","call","zoom","teams","meet","conference","schedule","appointment","agenda","standup",
                                "réunion","treffen","会議","会议","회의"],
                    people:   ["from:","to:","cc:","bcc:","@","regards","sincerely","yours","signed","dear","hi ","hello ",
                                "cordialement","mit freundlichen","distinti saluti"],
                    action:   ["please","action required","next step","follow up","todo","need to","must","should","asap",
                                "por favor","s'il vous plaît","bitte","お願い","请","부탁"],
                    date:     ["2023","2024","2025","2026","monday","tuesday","wednesday","thursday","friday","saturday","sunday",
                                "january","february","march","april","june","july","august","september","october","november","december",
                                "lunes","martes","miércoles","lundi","mardi","mercredi","月","年","週","월","년","일"],
                    };

                    function findPattern(text, key) {
                    const patterns = FIND_SETS[key];
                    const sentences = splitSentences(text);
                    const matches = [];
                    sentences.forEach(s => {
                        const lower = s.toLowerCase();
                        if (patterns.some(p => lower.includes(p)) && !matches.includes(s.trim())) {
                        matches.push(s.trim());
                        }
                    });
                    return matches.length ? matches.join("\n\n") : "Nothing found for that topic.";
                    }


                    // ─────────────────────────────────────────────
                    //  ANSWER FORMATTER
                    // ─────────────────────────────────────────────

                    function formatAnswer(content, confidence, extra) {
                    let out = content;
                    if (confidence !== undefined && confidence < 50) {
                        out += `\n\n[Confidence: ${confidence}% — the document may not directly address this question]`;
                    }
                    if (extra) out += `\n\n${extra}`;
                    return out;
                    }


                    // ─────────────────────────────────────────────
                    //  MAIN CONTROLLER
                    // ─────────────────────────────────────────────

                    document.getElementById("askButton").addEventListener("click", runAI);

                    function runAI() {
                    const memory   = document.getElementById("memory").value;
                    const question = document.getElementById("question").value;
                    const output   = document.getElementById("output");

                    if (!memory.trim())   { show("Please paste some text, an email, or code."); return; }
                    if (!question.trim()) { show("Please enter a question."); return; }

                    const lang = detectCodeLanguage(memory);

                    // ── CODE MODE ──────────────────────────────
                    if (lang) {
                        const q = question.toLowerCase();
                        const qWords = splitWords(question);
                        let result = "";

                        if (/summar|overview|what does|what is this|explain|describe|analyz/.test(q)) {
                        result = summarizeCode(memory, lang);
                        } else if (/function|method|def|procedure|routine/.test(q)) {
                        const found = extractCodeItems(memory, lang, "functions");
                        result = found.length ? `Functions / methods found (${found.length}):\n\n${found.join("\n")}` : "No functions found.";
                        } else if (/class|struct|interface|type|object|inherit/.test(q)) {
                        const found = extractCodeItems(memory, lang, "classes");
                        result = found.length ? `Classes / types found (${found.length}):\n\n${found.join("\n")}` : "No classes found.";
                        } else if (/import|require|depend|librar|package|module|use/.test(q)) {
                        const found = extractCodeItems(memory, lang, "imports");
                        result = found.length ? `Dependencies found (${found.length}):\n\n${found.join("\n")}` : "No imports found.";
                        } else if (/complex|cyclomat|nest|depth|length|line|size|metric/.test(q)) {
                        const c = analyzeComplexity(memory, lang);
                        result = `Complexity Analysis:\n\nTotal lines: ${c.lines}\nCode lines (non-empty, non-comment): ${c.nonEmpty}\nMax nesting depth: ${c.maxNesting}\nCyclomatic complexity estimate: ${c.cyclomaticEstimate}\nComplexity rating: ${c.complexity}`;
                        } else {
                        const found = findInCode(memory, lang, qWords);
                        result = found || summarizeCode(memory, lang);
                        }

                        show(result);
                        return;
                    }

                    // ── DOCUMENT / EMAIL MODE ─────────────────
                    const intent = detectIntent(question);

                    switch (intent) {
                        case "summary": {
                        const s = summarize(memory);
                        const kw = extractKeywords(memory, 8).join(", ");
                        show(formatAnswer(s, undefined, `Key topics: ${kw}`));
                        break;
                        }
                        case "entities": {
                        const ents = extractEntities(memory);
                        if (!Object.keys(ents).length) { show("No structured entities found."); break; }
                        const lines = Object.entries(ents).map(([label, vals]) => `${label}:\n  ${vals.join("\n  ")}`);
                        show(lines.join("\n\n"));
                        break;
                        }
                        case "sentiment": {
                        const sent = analyzeSentiment(memory);
                        const sentences = splitSentences(memory);
                        const bm = bm25Score("positive negative tone mood emotion", sentences);
                        const topSentences = sentences
                            .map((s, i) => ({ s, score: bm[i] }))
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 3)
                            .map(x => x.s);

                        let result = `Overall tone: ${sent.label}\n`;
                        result += `Sentiment score: ${sent.score} (range: -1 very negative → +1 very positive)\n`;
                        result += `Positive signals: ${sent.pos}  |  Negative signals: ${sent.neg}\n`;
                        if (topSentences.length) result += `\nMost emotionally loaded sentences:\n\n${topSentences.join("\n\n")}`;
                        show(result);
                        break;
                        }
                        case "readability": {
                        const r = readabilityScore(memory);
                        if (!r) { show("Not enough text to analyze readability."); break; }
                        let result = `Readability: ${r.level}\n`;
                        result += `Flesch-Kincaid score: ${r.score}/100\n`;
                        result += `Words: ${r.words}  |  Sentences: ${r.sentences}\n`;
                        result += `Average sentence length: ${r.asl} words`;
                        show(result);
                        break;
                        }
                        case "keywords": {
                        const kw = extractKeywords(memory, 15);
                        show(`Top keywords / topics:\n\n${kw.join(", ")}`);
                        break;
                        }
                        case "compare": {
                        const cmp = compareTexts(memory);
                        if (!cmp) {
                            show("To compare two texts, separate them with a line of dashes:\n\n---");
                            break;
                        }
                        let result = `Similarity: ${cmp.similarity}%\n\n`;
                        result += `Tone of first section: ${cmp.sentimentA}\n`;
                        result += `Tone of second section: ${cmp.sentimentB}\n\n`;
                        result += `Keywords unique to first:\n  ${cmp.uniqueToFirst.join(", ")}\n\n`;
                        result += `Keywords unique to second:\n  ${cmp.uniqueToSecond.join(", ")}\n\n`;
                        result += `Shared topics:\n  ${cmp.sharedTopics.join(", ")}`;
                        show(result);
                        break;
                        }
                        case "deadline":   show(findPattern(memory, "deadline")); break;
                        case "meeting":    show(findPattern(memory, "meeting")); break;
                        case "action":     show(findPattern(memory, "action")); break;
                        case "people":     show(findPattern(memory, "people")); break;
                        case "date":       show(findPattern(memory, "date")); break;
                        default: {
                        const { results, confidence } = smartSearch(memory, question);
                        if (!results.length) { show("No relevant content found. Try rephrasing your question."); break; }
                        show(formatAnswer(results.join("\n\n"), confidence));
                        }
                    }
                    }

                    function show(text) {
                    document.getElementById("output").innerText = text;
                    }