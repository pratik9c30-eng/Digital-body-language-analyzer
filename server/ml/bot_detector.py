import math
import numpy as np

def entropy(values: list[float]) -> float:
    if len(values) < 2: return 1.0
    counts = {}
    for value in values:
        bucket = round(float(value), 2)
        counts[bucket] = counts.get(bucket, 0) + 1
    probabilities = np.asarray(list(counts.values()), dtype=float) / len(values)
    return float(-(probabilities * np.log2(probabilities)).sum())

def bot_probability(vector: list[float]) -> float:
    """Low variance and low timing entropy are characteristic of scripted input."""
    values = np.asarray(vector, dtype=float)
    timing = values[[1, 2, 3, 4, 14]]
    variance_signal = 1.0 - float(np.clip(np.std(timing) / 0.45, 0, 1))
    entropy_signal = 1.0 - float(np.clip(entropy(timing) / 2.2, 0, 1))
    return round(float(np.clip(0.55 * variance_signal + 0.45 * entropy_signal, 0, 1)), 3)
