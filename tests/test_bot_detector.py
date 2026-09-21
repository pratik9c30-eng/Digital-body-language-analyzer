import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1] / 'server'))
from ml.bot_detector import bot_probability

def test_repeated_timing_looks_automated():
    assert bot_probability([.5, .5, .5, .5, .5, .5, .5, .5, .5, .5, .5, .5, .5, .5, .5]) > .8

def test_varied_timing_is_less_automated():
    assert bot_probability([.1, .2, .8, .3, .7, .2, .9, .4, .6, .3, .8, .1, .9, .2, .7]) < .8
