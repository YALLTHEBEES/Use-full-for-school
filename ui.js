/* global TextRankEngine */

// ---------- UI elements ----------
const emailInput = document.getElementById('emailInput');
const summarizeBtn = document.getElementById('summarizeBtn');
const outputDiv = document.getElementById('output');
const ratioSlider = document.getElementById('ratioSlider');
const ratioValue = document.getElementById('ratioValue');
const serverModeCheck = document.getElementById('serverMode');
const serverStatus = document.getElementById('serverStatus');

// ---------- State ----------
let useLocalServer = false;
let worker = undefined;

// ---------- Ratio display ----------
ratioSlider.addEventListener('input', () => {
  ratioValue.textContent = Math.round(ratioSlider.value * 100) + '%';
});

// ---------- Server mode toggle ----------
serverModeCheck.addEventListener('change', () => {
  useLocalServer = serverModeCheck.checked;
  serverStatus.style.display = useLocalServer ? 'inline' : 'none';
});

// ---------- Server summar
