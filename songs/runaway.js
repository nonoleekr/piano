// Filename: runaway.js
//
// Transcription notes (right-hand intro melody only):
// Multiple independent tutorial sources agree on the shape of the famous
// intro phrase: a note struck three times, then the same note struck once
// an octave lower, repeated on a descending line (E, D#, C#), followed by
// a short A–A–G#–E turn. The melody's top register is E6 (both loop
// passes now shifted consistently — an earlier draft had the second pass
// a register too low). E6 and everything above C5 is *above* this app's
// visible C3–C5 keyboard. Per instructions, octaves are kept accurate
// rather than transposed down to fit; notes above C5 still play correctly
// (the player falls back to direct audio for off-screen notes), they just
// won't have an on-screen key to highlight.
//
// No source specifies exact note-value/rhythm notation, so this uses a
// steady quarter-note pulse (beats: 1), matching how the intro is
// generally described (a slow, hypnotic repeated pulse) — tempo set to
// 45 BPM, within the requested 40-50 BPM range. The 16-note phrase is
// looped twice to represent the intro before the beat would normally come
// in. Left-hand chord accompaniment (E–G#–B–G#) belongs to a later
// section, not the bare intro, so it's left out here — a natural next
// addition.
//
// Sources consulted:
// - https://latouchemusicale.com/en/runaway-piano-notes-letters/
// - Search-aggregated tutorial notes (TikTok/YouTube piano tutorials for
//   "Runaway" intro, cross-referenced for the repeat/octave-drop pattern)
export default {
  id: "runaway",
  title: "Runaway",
  artist: "Kanye West",
  bpm: 45,
  notes: [
    { note: "E6", beats: 1 },
    { note: "E6", beats: 1 },
    { note: "E6", beats: 1 },
    { note: "E5", beats: 1 },
    { note: "D#6", beats: 1 },
    { note: "D#6", beats: 1 },
    { note: "D#6", beats: 1 },
    { note: "D#5", beats: 1 },
    { note: "C#6", beats: 1 },
    { note: "C#6", beats: 1 },
    { note: "C#6", beats: 1 },
    { note: "C#5", beats: 1 },
    { note: "A6", beats: 1 },
    { note: "A6", beats: 1 },
    { note: "G#6", beats: 1 },
    { note: "E6", beats: 1 },

    { note: "E6", beats: 1 },
    { note: "E6", beats: 1 },
    { note: "E6", beats: 1 },
    { note: "E5", beats: 1 },
    { note: "D#6", beats: 1 },
    { note: "D#6", beats: 1 },
    { note: "D#6", beats: 1 },
    { note: "D#5", beats: 1 },
    { note: "C#6", beats: 1 },
    { note: "C#6", beats: 1 },
    { note: "C#6", beats: 1 },
    { note: "C#5", beats: 1 },
    { note: "A6", beats: 1 },
    { note: "A6", beats: 1 },
    { note: "G#6", beats: 1 },
    { note: "E6", beats: 1 },
  ],
};
