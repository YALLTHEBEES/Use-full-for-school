const memoryBox =
document.getElementById("memory");

const questionBox =
document.getElementById("question");

const output =
document.getElementById("output");

const status =
document.getElementById("status");

// SAVE

document
.getElementById("saveButton")
.onclick = () => {

    localStorage.setItem(
        "school_memory",
        memoryBox.value
    );

    status.innerText =
    "Saved.";
};

// LOAD

document
.getElementById("loadButton")
.onclick = () => {

    memoryBox.value =
    localStorage.getItem(
        "school_memory"
    ) || "";

    status.innerText =
    "Loaded.";
};

// CLEAR

document
.getElementById("clearButton")
.onclick = () => {

    memoryBox.value = "";

    output.innerText = "";

    localStorage.removeItem(
        "school_memory"
    );

    status.innerText =
    "Cleared.";
};

// ASK AI

document
.getElementById("askButton")
.onclick = () => {

    const memory =
    memoryBox.value;

    const question =
    questionBox.value;

    if (
        memory.trim() === ""
    ) {

        output.innerText =
        "Paste some notes first.";

        return;
    }

    if (
        question
        .toLowerCase()
        .includes("summary")
    ) {

        const sentences =
        memory.split(".");

        output.innerText =
        sentences
        .slice(0, 5)
        .join(". ");

        return;
    }

    const lines =
    memory.split("\n");

    const words =
    question
    .toLowerCase()
    .split(" ");

    let matches = [];

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

            matches.push(line);

        }

    });

    if (matches.length === 0) {

        output.innerText =
        "No matches found.";

    }

    else {

        output.innerText =
        matches.join("\n\n");

    }

};