# server/summarizer.py
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.summarizers.lex_rank import LexRankSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words

SUMMARIZERS = {
    "textrank": TextRankSummarizer,
    "lsa": LsaSummarizer,
    "lexrank": LexRankSummarizer,
}

def summarize_text(text, method="textrank", ratio=0.3, language="english"):
    parser = PlaintextParser.from_string(text, Tokenizer(language))
    stemmer = Stemmer(language)
    summarizer_class = SUMMARIZERS.get(method, TextRankSummarizer)
    summarizer = summarizer_class(stemmer)
    summarizer.stop_words = get_stop_words(language)

    sentences = summarizer(parser.document, sentences_count=None)
    # Extract the sentence texts
    summary_sentences = []
    for sentence in sentences:
        summary_sentences.append(str(sentence))
    
    # Calculate how many sentences to include based on ratio
    num_sentences = max(1, int(len(summary_sentences) * ratio))
    summary = ' '.join(summary_sentences[:num_sentences])
    return summary
