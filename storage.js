```javascript
function saveMemory(text) {

    localStorage.setItem(
        "school_ai_memory",
        text
    );
}

function loadMemory() {

    return localStorage.getItem(
        "school_ai_memory"
    ) || "";
}

function clearMemory() {

    localStorage.removeItem(
        "school_ai_memory"
    );
}
```
