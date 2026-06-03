```javascript
function normalize(text) {

    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, "");
}

function tokenize(text) {

    return normalize(text)
    .split(/\s+/)
    .filter(Boolean);
}

function scoreLine(
    line,
    queryWords
) {

    const lineWords =
    tokenize(line);

    let score = 0;

    queryWords.forEach((word) => {

        if (
            lineWords.includes(word)
        ) {

            score += 2;
        }

        lineWords.forEach((lw) => {

            if (
                lw.startsWith(word)
            ) {

                score += 1;
            }

        });

    });

    return score;
}

function summarize(text) {

    const sentences =
    text.split(/[.!?]/);

    return sentences
        .slice(0, 8)
        .join(". ");
}

function extractDeadlines(text) {

    const lines =
    text.split("\n");

    const keywords = [
        "due",
        "deadline",
        "submit",
        "exam",
        "test",
        "quiz"
    ];

    return lines.filter((line) => {

        const lower =
        line.toLowerCase();

        return keywords.some(
            (k) =>
            lower.includes(k)
        );
    });
}

function runLocalAI(
    memory,
    question
) {

    const q =
    question.toLowerCase();

    if (
        q.includes("summary")
    ) {

        return summarize(memory);
    }

    if (
        q.includes("deadline")
    ) {

        return extractDeadlines(
            memory
        ).join("\n\n");
    }

    const queryWords =
    tokenize(question);

    const lines =
    memory.split("\n");

    const ranked = lines
    .map((line) => {

        return {
            line,
            score:
            scoreLine(
                line,
                queryWords
            )
        };

    })
    .filter(
        (x) => x.score > 0
    )
    .sort(
        (a, b) =>
        b.score - a.score
    );

    if (ranked.length === 0) {

        return
        "No relevant results found.";
    }

    return ranked
    .slice(0, 10)
    .map((x) => x.line)
    .join("\n\n");
}
```
