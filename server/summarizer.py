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

    sentences = summarizer(parser.d sentences_count=None)
    # sumy returns Sentence objects, join them
    summary = " ".join(str(s) for s in sentences[:max(1, int(len(sentences) * ratio))])
    return summary else text  # fallback to full text if empty
