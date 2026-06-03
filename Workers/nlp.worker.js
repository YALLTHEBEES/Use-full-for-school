```javascript
self.onmessage =
function(event) {

    const {
        memory,
        question
    } = event.data;

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

    const lines =
    memory.split("\n");

    const queryWords =
    tokenize(question);

    let ranked = [];

    lines.forEach((line) => {

        let score = 0;

        const lineWords =
        tokenize(line);

        queryWords.forEach((word) => {

            if (
                lineWords.includes(word)
            ) {

                score += 2;
            }

        });

        if (score > 0) {

            ranked.push({
                line,
                score
            });
        }

    });

    ranked.sort(
        (a, b) =>
        b.score - a.score
    );

    const result =
    ranked
    .slice(0, 10)
    .map((x) => x.line)
    .join("\n\n");

    self.postMessage(result);
};
```
