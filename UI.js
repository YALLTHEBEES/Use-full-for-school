```javascript
const worker =
new Worker(
    "workers/nlp.worker.js"
);

const memoryBox =
document.getElementById(
    "memory"
);

const questionBox =
document.getElementById(
    "question"
);

const output =
document.getElementById(
    "output"
);

const status =
document.getElementById(
    "status"
);

document
.getElementById("saveButton")
.onclick = () => {

    saveMemory(
        memoryBox.value
    );

    status.innerText =
    "Notes saved locally.";
};

document
.getElementById("loadButton")
.onclick = () => {

    memoryBox.value =
    loadMemory();

    status.innerText =
    "Notes loaded.";
};

document
.getElementById("clearButton")
.onclick = () => {

    clearMemory();

    memoryBox.value = "";

    status.innerText =
    "Memory cleared.";
};

document
.getElementById("askButton")
.onclick = () => {

    status.innerText =
    "Processing...";

    worker.postMessage({

        memory:
        memoryBox.value,

        question:
        questionBox.value
    });
};

worker.onmessage =
function(event) {

    status.innerText = "";

    output.innerText =
    event.data;
};
```
