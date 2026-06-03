/**
 * nlp.worker.js – runs TextRank in a background thread.
 * Imports engine.js via importScripts (works in all browsers).
 */
importScripts('../engine.js');

self.onmessage = function(e) {
  var data = e.data;
  if (data.type === 'summarize') {
    try {
      var text = data.text;
      var numSentences = data.numSentences || 5;

      // Progress updates
      self.postMessage({ type: 'progress', message: 'Splitting sentences...' });
      var sentences = Engine.splitSentences(text);
      if (sentences.length === 0) {
        self.postMessage({ type: 'error', message: 'No sentences found.' });
        return;
      }

      self.postMessage({ type: 'progress', message: 'Running TextRank on ' + sentences.length + ' sentences...' });
      var summarySentences = Engine.textRankSentences(sentences, numSentences);

      var summary = summarySentences.join(' ');
      self.postMessage({ type: 'summary', summary: summary });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || 'Unknown error' });
    }
  }
};
