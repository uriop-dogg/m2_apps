Fundamental Perception Simulator.web v1.0.6

Open the standalone HTML file in a modern browser, or publish index.html on GitHub Pages.
No external libraries or audio uploads are required. Microphone access needs HTTPS or localhost.

Language
Choose English or Japanese from LANGUAGE / 言語 in the header or initial input dialog.
The browser remembers this preference. Switching language preserves current inputs and settings.

Inputs
- Open audio: load a browser-supported audio file (such as WAV, MP3 or M4A).
  Choose Current position for live playback analysis, or Whole audio (STFT average).
  Whole-audio analysis averages squared FFT magnitudes before computing harmonic values.
  It works while paused; changing the file or window size recalculates the average.
- Use microphone: grant microphone permission to analyze live input. It is not played through speakers.
- Behind chord theory: use 12 equal-tempered pitch-class sliders to create chords.
  Add octave duplicates the last bank into an unused octave (0 through 8).
  Duplicate octaves are rejected. Timbre and volume are independent per bank.
  Play/Stop, Retrigger and Set all notes to zero affect all banks.
  Eight timbres are available: Sine, Triangle, Sawtooth, Square, Organ, Strings, Guitar and Piano.

Displays and definitions
P(f) is linear squared spectral magnitude.
H(f) = sum of w_n P(nf), S(f) = sum of w_n P(f/n), for n=2 through N.
W is the sum of these active weights.
- Pitch-frequency value: P.
- Harmonic polarity (scalar): H-S.
- Harmonic polarity vector: P+i(H-S).
- Harmonic characteristic vector: WP-(H+S)/2+i sqrt(3)(H-S)/2.
This simulator retains the polarity vector definition above, without division by W.
Sawtooth weights use 1/n for all n; square weights use 1/n for odd n only.
Out-of-range input references are zero. DC is excluded.

For complex values, curve height is magnitude and color represents phase.
Polarity: -90 degrees blue, 0 green, +90 red.
Characteristic: S at -120 blue, P at 0 green, H at +120 red, +/-180 magenta.
Peak phase labels can be toggled. The phase of zero is undefined.

Range and settings
Choose Octave sum, All frequencies or One octave. The left-edge pitch class is adjustable.
Octave sums add real and imaginary components before computing magnitude and phase.
Analysis/display settings include weights, harmonic limit, STFT window, update interval,
A4 tuning and vertical scale. Lock current upper limit captures the current graph range.
Small fixed limits can be entered in scientific notation.

Processing
Audio is analyzed in a Web Worker using a Blackman window and 8x zero-padding.
The default 8192-sample window is about 171 ms at 48 kHz.
Longer windows improve frequency resolution but increase temporal smearing.
Zero-padding improves sampling of the spectrum; it does not improve true frequency resolution.
Whole-audio STFT uses a half-window hop, centers starting at time zero, and zero-padded ends.
Channels are averaged to mono. File/synth master volume affects analysis; microphone input is direct.
Long files may require substantial browser memory and processing time.

Development
Run node build.cjs to regenerate dist/index.html and the standalone HTML.
Run node serve.cjs for http://127.0.0.1:8766/.
i18n.js and translations.tsv provide localization; test-i18n.cjs checks translation coverage.
Numerical and audio-control regression tests are included in the source archive.

v1.0.6 adds Japanese/English switching, translated controls, graph text and messages.
English UI and switching back to Japanese were checked in a browser, including added octave banks.
Microphone lifecycle is covered by mock tests; live microphone capture was not tested.
