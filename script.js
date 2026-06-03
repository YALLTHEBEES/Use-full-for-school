document
.getElementById("askButton")
.addEventListener("click", runAI);

function runAI() {

    const memory =
    document
    .getElementById("memory")
    .value;

    const question =
    document
    .getElementById("question")
    .value
    .toLowerCase();

    let output = "";

    if (memory.trim() === "") {

        output =
        "Please paste email or document text.";

        show(output);

        return;
    }

    if (
        question.includes("summary")
    ) {

        output =
        summarize(memory);

    }

    else if (
        question.includes("deadline")
    ) {

        output =
        findKeywords(
            memory,
            [
                "deadline",
                "due",
                "submit",
                "finish",
                "complete"
            ]
        );

    }

    else if (
        question.includes("meeting")
    ) {

        output =
        findKeywords(
            memory,
            [
                "meeting",
                "zoom",
                "call",
                "schedule"
            ]
        );

    }

    else if (
        question.includes("tax")
    ) {

        output =
        findKeywords(
            memory,
            [
                "tax",
                "irs",
                "invoice",
                "payment"
            ]
        );

    }

    else {

        output =
        smartSearch(
            memory,
            question
        );

    }

    show(output);
}

function summarize(text) {

    const sentences =
    text.split(".");

    let result = "";

    sentences
    .slice(0, 10)
    .forEach((s) => {

        result +=
        s.trim() + ".\n\n";

    });

    return result;
}

function findKeywords(
    text,
    keywords
) {

    const lines =
    text.split("\n");

    let matches = [];

    lines.forEach((line) => {

        keywords.forEach((word) => {

            if (
                line
                .toLowerCase()
                .includes(word)
            ) {

                matches.push(line);

            }

        });

    });

    if (matches.length === 0) {

        return "No matches found.";

    }

    return matches.join("\n\n");
}

function smartSearch(
    memory,
    question
) {

    const words =
    question.split(" ");

    const lines =
    memory.split("\n");

    let scored = [];

    lines.forEach((line) => {

        let score = 0;

        words.forEach((word) => {

            if (
                line
                .toLowerCase()
                .includes(word)
            ) {

                score++;

            }

        });

        if (score > 0) {

            scored.push({
                score: score,
                line: line
            });

        }

    });

    scored.sort(
        (a, b) =>
        b.score - a.score
    );

    if (scored.length === 0) {

        return "No relevant text found.";

    }

    return scored
    .slice(0, 10)
    .map((x) => x.line)
    .join("\n\n");
}

function show(text) {

    document
    .getElementById("output")
    .innerText = text;
}