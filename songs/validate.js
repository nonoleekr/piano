// Pure data-validation helpers for song files.
// No DOM access, no audio, no imports from the rest of the app — this module
// only ever looks at plain song objects and reports problems via console.
// A malformed song is warned about, not removed: the player already skips
// unknown note names gracefully, so one bad song shouldn't hide itself entirely.

// Matches any real note name (e.g. "C4", "F#5") across the mp3 library's
// range — this only catches typos, not whether a key exists on-screen for it.
const NOTE_NAME_PATTERN = /^[A-G]#?[0-8]$/;

// The visible piano only shows C3–C5. Notes outside this still play (the
// player falls back to direct audio), they just have no key to highlight —
// worth a heads-up, not a warning.
const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const VISIBLE_RANGE_NOTES = new Set([
    ...NOTE_LETTERS.map(letter => `${letter}3`),
    ...NOTE_LETTERS.map(letter => `${letter}4`),
    'C5',
]);

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkNote(note, songId, stepIndex, offScreenNotes) {
    if (note === null) return;
    const notes = Array.isArray(note) ? note : [note];
    notes.forEach(n => {
        if (typeof n !== 'string' || !NOTE_NAME_PATTERN.test(n)) {
            console.warn(`[songs] "${songId}" step ${stepIndex}: "${n}" isn't a valid note name (expected e.g. "C4", "F#5")`);
        } else if (!VISIBLE_RANGE_NOTES.has(n)) {
            offScreenNotes.add(n);
        }
    });
}

export function validateSong(song) {
    const id = song && song.id;

    if (!id || typeof id !== 'string') {
        console.warn('[songs] song is missing a valid "id"', song);
        return;
    }
    if (!ID_PATTERN.test(id)) {
        console.warn(`[songs] "${id}": id should be kebab-case (lowercase letters, digits, hyphens)`);
    }
    if (!song.title) {
        console.warn(`[songs] "${id}": missing "title"`);
    }
    if (!song.artist) {
        console.warn(`[songs] "${id}": missing "artist"`);
    }
    if (typeof song.bpm !== 'number' || song.bpm <= 0) {
        console.warn(`[songs] "${id}": "bpm" should be a positive number`);
    }
    if (!Array.isArray(song.notes) || song.notes.length === 0) {
        console.warn(`[songs] "${id}": "notes" should be a non-empty array`);
        return;
    }

    const offScreenNotes = new Set();
    song.notes.forEach((step, index) => {
        if (typeof step.beats !== 'number' || step.beats <= 0) {
            console.warn(`[songs] "${id}" step ${index}: "beats" should be a positive number`);
        }
        checkNote(step.note, id, index, offScreenNotes);
    });

    if (offScreenNotes.size > 0) {
        console.info(
            `[songs] "${id}" uses ${offScreenNotes.size} note(s) outside the visible C3–C5 keyboard ` +
            `(${[...offScreenNotes].sort().join(', ')}) — these play correctly but won't highlight a key.`
        );
    }
}

export function validateSongs(songs) {
    const seenIds = new Set();
    songs.forEach(song => {
        if (song.id && seenIds.has(song.id)) {
            console.warn(`[songs] duplicate song id "${song.id}"`);
        }
        if (song.id) seenIds.add(song.id);
        validateSong(song);
    });
}
