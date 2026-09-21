import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1] / 'server'))
from privacy.vectorizer import sanitize_features

def test_vectorizer_returns_canonical_numeric_vector():
    vector = sanitize_features({'typing_speed': .8, 'dwell_mean': .4})
    assert len(vector) == 15 and vector[0] == .8

def test_raw_text_is_rejected():
    try: sanitize_features({'text': 'secret', 'typing_speed': .4})
    except ValueError as error: assert 'raw input' in str(error)
    else: raise AssertionError('raw input must never be accepted')
