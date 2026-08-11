import { songs, getSongById } from './songs/index.js';

document.addEventListener('DOMContentLoaded', () => {
    const showNotesCheckbox = document.getElementById('show-notes');
    const sustainCheckbox = document.getElementById('sustain-toggle');
    const volumeSlider = document.getElementById('volume');
    const nowPlayingEl = document.getElementById('now-playing-notes');
    const pianoEl = document.querySelector('.piano');
    const keysStripEl = document.querySelector('.keys-strip');
    const whiteKeysContainer = document.querySelector('.white-keys');
    const blackKeysContainer = document.querySelector('.black-keys');
    const keyRangeSlider = document.getElementById('key-range');
    const keyRangeLabel = document.getElementById('key-range-label');

    // Song player (practice mode) elements
    const songSelect = document.getElementById('song-select');
    const songPlayBtn = document.getElementById('song-play');
    const songPauseBtn = document.getElementById('song-pause');
    const songStopBtn = document.getElementById('song-stop');
    const songTempoSlider = document.getElementById('song-tempo');
    const songTempoValue = document.getElementById('song-tempo-value');
    const songCurrentNoteEl = document.getElementById('song-current-note');
    const songNextNoteEl = document.getElementById('song-next-note');
    const songProgressEl = document.getElementById('song-progress');

    // ---- Note name helpers ----
    const NOTE_SEQUENCE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLAT_NAMES = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
    // How far each black key sits into its octave, in white-key-width units from
    // that octave's C (e.g. C# sits 0.7 of a white key past C). Mirrors the
    // original hand-tuned positions from the fixed 2-octave layout.
    const BLACK_KEY_OFFSET = { 'C#': 0.7, 'D#': 1.7, 'F#': 3.7, 'G#': 4.7, 'A#': 5.7 };

    function parseNote(note) {
        const match = note.match(/^([A-G]#?)(\d)$/);
        return { pitchClass: match[1], octave: parseInt(match[2], 10) };
    }

    function noteToFileName(note) {
        const { pitchClass, octave } = parseNote(note);
        return `${FLAT_NAMES[pitchClass] || pitchClass}${octave}`;
    }

    // ---- Build the keyboard: a wide strip spanning C1–C7, of which a 2-octave
    // window is visible at a time. Each key has a permanent, fixed note identity
    // (no relabeling) — sliding the range only changes which keys are visible
    // and which are bound to computer-keyboard shortcuts.
    const RANGE_LOW_OCTAVE = 1;
    const RANGE_HIGH_OCTAVE = 7; // inclusive; only C is used in this final octave
    const VISIBLE_WHITE_COUNT = 15; // matches the original fixed 2-octave layout

    // Ergonomic touch-typing layout (left hand A S D F G, right hand J K L ; ',
    // J = Middle C), applied to whichever keys are currently visible — identical
    // shortcut assignment to before, just rebound to different real keys as the
    // range slides instead of relabeling the same 25 keys.
    const WHITE_SHORTCUTS = [
        { code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' },
        { code: 'KeyF', label: 'F' }, { code: 'KeyG', label: 'G' }, { code: 'KeyX', label: 'X' },
        { code: 'KeyV', label: 'V' }, { code: 'KeyJ', label: 'J' }, { code: 'KeyK', label: 'K' },
        { code: 'KeyL', label: 'L' }, { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" },
        { code: 'KeyM', label: 'M' }, { code: 'Period', label: '.' }, { code: 'Slash', label: '/' },
    ];
    const BLACK_SHORTCUTS = [
        { code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E' }, { code: 'KeyT', label: 'T' },
        { code: 'KeyZ', label: 'Z' }, { code: 'KeyC', label: 'C' }, { code: 'KeyI', label: 'I' },
        { code: 'KeyO', label: 'O' }, { code: 'BracketLeft', label: '[' }, { code: 'KeyN', label: 'N' },
        { code: 'Comma', label: ',' },
    ];

    function createKeyElement(note, pitchClass, octave, isBlack) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `key ${isBlack ? 'black' : 'white'}`;
        button.dataset.note = note;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', note);

        const shortcut = document.createElement('span');
        shortcut.className = 'key-shortcut';
        button.appendChild(shortcut);

        const name = document.createElement('span');
        name.className = 'note-name';
        name.textContent = pitchClass;
        button.appendChild(name);

        const oct = document.createElement('span');
        oct.className = 'octave';
        oct.textContent = String(octave);
        button.appendChild(oct);

        return button;
    }

    function buildKeyboard() {
        const whiteKeyElements = [];
        const blackKeyElements = [];
        let whiteIndex = 0;

        for (let octave = RANGE_LOW_OCTAVE; octave <= RANGE_HIGH_OCTAVE; octave++) {
            const octaveStartWhiteIndex = whiteIndex;
            NOTE_SEQUENCE.forEach(pitchClass => {
                if (octave === RANGE_HIGH_OCTAVE && pitchClass !== 'C') return; // stop exactly at C7
                const note = `${pitchClass}${octave}`;
                const isBlack = pitchClass.includes('#');
                const keyEl = createKeyElement(note, pitchClass, octave, isBlack);

                if (isBlack) {
                    const position = octaveStartWhiteIndex + BLACK_KEY_OFFSET[pitchClass];
                    keyEl.style.left = `${(position / TOTAL_WHITE_KEYS) * 100}%`;
                    keyEl.dataset.whiteAnchor = String(Math.floor(position));
                    blackKeysContainer.appendChild(keyEl);
                    blackKeyElements.push(keyEl);
                } else {
                    whiteKeysContainer.appendChild(keyEl);
                    whiteKeyElements.push(keyEl);
                    whiteIndex++;
                }
            });
        }

        return { whiteKeyElements, blackKeyElements };
    }

    const TOTAL_WHITE_KEYS = (RANGE_HIGH_OCTAVE - RANGE_LOW_OCTAVE) * 7 + 1; // 43
    const { whiteKeyElements, blackKeyElements } = buildKeyboard();
    const keys = [...whiteKeyElements, ...blackKeyElements];
    const noteToKeyElement = new Map(keys.map(key => [key.dataset.note, key]));

    pianoEl.style.setProperty('--total-white', TOTAL_WHITE_KEYS);
    pianoEl.style.setProperty('--visible-white', VISIBLE_WHITE_COUNT);

    // ---- Note visibility toggle ----
    const notesVisible = localStorage.getItem('showNotes') !== 'false';
    showNotesCheckbox.checked = notesVisible;
    updateNoteVisibility(notesVisible);

    showNotesCheckbox.addEventListener('change', () => {
        const isVisible = showNotesCheckbox.checked;
        updateNoteVisibility(isVisible);
        localStorage.setItem('showNotes', isVisible);
    });

    function updateNoteVisibility(isVisible) {
        keys.forEach(key => key.classList.toggle('notes-hidden', !isVisible));
    }

    // ---- Audio engine (Web Audio API) ----
    let audioCtx = null;
    let masterGain = null;
    const bufferCache = new Map();   // fileName -> Promise<AudioBuffer>
    const activeVoices = new Map();  // note -> { source, gain }
    const pressedKeys = new Set();   // note currently physically held
    const pressTokens = new Map();   // note -> latest press token (guards async races)

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = volumeSlider.value / 100;
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function loadBuffer(fileName) {
        if (bufferCache.has(fileName)) {
            return bufferCache.get(fileName);
        }
        const ctx = getAudioContext();
        const promise = fetch(`piano-mp3/${fileName}.mp3`)
            .then(res => res.arrayBuffer())
            .then(data => ctx.decodeAudioData(data))
            .catch(err => {
                console.error(`Could not load ${fileName}.mp3`, err);
                bufferCache.delete(fileName);
                return null;
            });
        bufferCache.set(fileName, promise);
        return promise;
    }

    function preloadAllNotes() {
        keys.forEach(key => loadBuffer(noteToFileName(key.dataset.note)));
    }

    function stopVoice(note) {
        const voice = activeVoices.get(note);
        if (!voice) return;
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const { gain, source } = voice;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
        source.stop(now + 0.26);
        activeVoices.delete(note);
    }

    function playNote(note) {
        const ctx = getAudioContext();
        const fileName = noteToFileName(note);

        // Retriggering a still-sounding note: cut the old voice short first.
        stopVoice(note);

        // Token guards against a stale, still-loading press overwriting a newer one.
        const token = Symbol(note);
        pressTokens.set(note, token);

        loadBuffer(fileName).then(buffer => {
            if (!buffer || pressTokens.get(note) !== token) return;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.value = 1;
            source.connect(gain).connect(masterGain);
            source.start(0);
            activeVoices.set(note, { source, gain });
            updateNowPlaying();
        });
    }

    function updateNowPlaying() {
        const notes = Array.from(activeVoices.keys());
        nowPlayingEl.textContent = notes.length ? notes.join(' · ') : '—';
    }

    // ---- Sustain ----
    sustainCheckbox.checked = localStorage.getItem('sustain') === 'true';
    sustainCheckbox.addEventListener('change', () => {
        localStorage.setItem('sustain', sustainCheckbox.checked);
        if (!sustainCheckbox.checked) {
            // Release any notes that are ringing only because sustain held them.
            Array.from(activeVoices.keys())
                .filter(note => !pressedKeys.has(note))
                .forEach(note => { stopVoice(note); updateNowPlaying(); });
        }
    });

    // ---- Volume ----
    volumeSlider.addEventListener('input', () => {
        if (masterGain) {
            masterGain.gain.value = volumeSlider.value / 100;
        }
    });

    // ---- Key press/release ----
    function releaseKeyVisual(keyEl) {
        keyEl.classList.remove('active');
        keyEl.setAttribute('aria-pressed', 'false');
    }

    function pressKey(keyEl) {
        const note = keyEl.dataset.note;
        if (!note || pressedKeys.has(note)) return;
        pressedKeys.add(note);
        keyEl.classList.add('active');
        keyEl.setAttribute('aria-pressed', 'true');
        playNote(note);
    }

    function releaseKey(keyEl) {
        const note = keyEl.dataset.note;
        if (!note || !pressedKeys.has(note)) return;
        pressedKeys.delete(note);
        releaseKeyVisual(keyEl);
        if (!sustainCheckbox.checked) {
            stopVoice(note);
            updateNowPlaying();
        }
    }

    // Same press/release contract as pressKey()/releaseKey(), for notes that have
    // no corresponding key at all (outside the full C1–C7 range). Sound plays
    // correctly; there's just no key to highlight.
    function playOffScreenNote(note) {
        if (pressedKeys.has(note)) return;
        pressedKeys.add(note);
        playNote(note);
    }

    function releaseOffScreenNote(note) {
        if (!pressedKeys.has(note)) return;
        pressedKeys.delete(note);
        if (!sustainCheckbox.checked) {
            stopVoice(note);
            updateNowPlaying();
        }
    }

    // ---- Sliding key range ----
    // The visible window is described by windowStart: the index (into the 43
    // white keys, C1=0) of the leftmost visible white key. Sliding never affects
    // any already-sounding note — only which keys are visible and which are
    // bound to computer-keyboard shortcuts.
    const MAX_WINDOW_START = TOTAL_WHITE_KEYS - VISIBLE_WHITE_COUNT;
    const keyboardMap = {}; // event.code -> currently-bound keyEl
    let windowStart = Number(keyRangeSlider.value);

    function getVisibleWhiteKeys() {
        return whiteKeyElements.slice(windowStart, windowStart + VISIBLE_WHITE_COUNT);
    }

    function getVisibleBlackKeys() {
        // A black key's anchor is the white key just before it — it only belongs
        // to this window if that white key AND the one after it are both visible,
        // i.e. anchor must leave room for one more white key within the window.
        return blackKeyElements.filter(keyEl => {
            const anchor = Number(keyEl.dataset.whiteAnchor);
            return anchor >= windowStart && anchor < windowStart + VISIBLE_WHITE_COUNT - 1;
        });
    }

    function clearShortcut(keyEl) {
        delete keyEl.dataset.key;
        delete keyEl.dataset.keyLabel;
        keyEl.querySelector('.key-shortcut').textContent = '';
        keyEl.setAttribute('aria-label', keyEl.dataset.note);
    }

    function applyShortcut(keyEl, shortcut) {
        keyEl.dataset.key = shortcut.code;
        keyEl.dataset.keyLabel = shortcut.label;
        keyEl.querySelector('.key-shortcut').textContent = shortcut.label;
        keyEl.setAttribute('aria-label', `${keyEl.dataset.note}, keyboard shortcut ${shortcut.label}`);
    }

    function updateActiveShortcuts() {
        keys.forEach(clearShortcut);
        Object.keys(keyboardMap).forEach(code => delete keyboardMap[code]);

        getVisibleWhiteKeys().forEach((keyEl, i) => {
            applyShortcut(keyEl, WHITE_SHORTCUTS[i]);
            keyboardMap[WHITE_SHORTCUTS[i].code] = keyEl;
        });
        getVisibleBlackKeys().forEach((keyEl, i) => {
            applyShortcut(keyEl, BLACK_SHORTCUTS[i]);
            keyboardMap[BLACK_SHORTCUTS[i].code] = keyEl;
        });
    }

    function updateRangeLabel() {
        const first = whiteKeyElements[windowStart].dataset.note;
        const last = whiteKeyElements[windowStart + VISIBLE_WHITE_COUNT - 1].dataset.note;
        const text = `${first} – ${last}`;
        keyRangeLabel.textContent = text;
        keyRangeSlider.setAttribute('aria-valuetext', text);
    }

    function applyWindow(start) {
        windowStart = Math.max(0, Math.min(MAX_WINDOW_START, start));
        const offsetPercent = -(windowStart * 100 / TOTAL_WHITE_KEYS);
        keysStripEl.style.setProperty('--strip-offset', `${offsetPercent}%`);
        updateActiveShortcuts();
        updateRangeLabel();
    }

    keyRangeSlider.min = '0';
    keyRangeSlider.max = String(MAX_WINDOW_START);
    keyRangeSlider.addEventListener('input', () => {
        applyWindow(Number(keyRangeSlider.value));
    });

    // ---- Song player (practice mode / auto-play) ----
    // Reuses pressKey()/releaseKey() exactly like mouse, touch, and keyboard input do,
    // so autoplay gets correct highlighting, aria-pressed, "Now playing", and sustain
    // behavior for free without a second audio path. Every note in a song looks up
    // a real key directly by name — no range-locking needed, since keys are never
    // relabeled and the lookup doesn't depend on the current slide position.
    const playbackState = {
        status: 'idle',        // 'idle' | 'playing' | 'paused'
        song: null,
        stepIndex: 0,
        timeoutId: null,
        bpm: 100,
        currentStepKeys: [],
        currentStepOffScreenNotes: [],
    };

    function getSelectedSong() {
        return getSongById(songSelect.value) || songs[0];
    }

    function normalizeStepNotes(step) {
        if (!step || step.note == null) return [];
        return Array.isArray(step.note) ? step.note : [step.note];
    }

    function msPerBeat() {
        return 60000 / playbackState.bpm;
    }

    // Releases whatever the current step is holding down (respects Sustain,
    // same as releasing a manually-held key would).
    function releaseStepKeys() {
        playbackState.currentStepKeys.forEach(releaseKey);
        playbackState.currentStepKeys = [];
        playbackState.currentStepOffScreenNotes.forEach(releaseOffScreenNote);
        playbackState.currentStepOffScreenNotes = [];
    }

    function clearNextHints() {
        keys.forEach(keyEl => keyEl.classList.remove('next-hint'));
    }

    function updateSongUI(step, index, total) {
        const currentNotes = normalizeStepNotes(step);
        songCurrentNoteEl.textContent = currentNotes.length ? currentNotes.join(' + ') : '—';

        clearNextHints();
        const nextNotes = normalizeStepNotes(playbackState.song.notes[index + 1]);
        songNextNoteEl.textContent = nextNotes.length ? nextNotes.join(' + ') : '—';
        nextNotes.forEach(note => {
            const keyEl = noteToKeyElement.get(note);
            if (keyEl) keyEl.classList.add('next-hint');
        });

        songProgressEl.max = total;
        songProgressEl.value = index;
    }

    function updateTransportButtons() {
        const { status } = playbackState;
        songPlayBtn.disabled = status === 'playing';
        songPlayBtn.setAttribute('aria-label', status === 'paused' ? 'Resume song' : 'Play song');
        songPauseBtn.disabled = status !== 'playing';
        songStopBtn.disabled = status === 'idle';
    }

    function scheduleStep(index) {
        releaseStepKeys();

        const song = playbackState.song;
        if (!song || index >= song.notes.length) {
            finishSong();
            return;
        }

        playbackState.stepIndex = index;
        const step = song.notes[index];
        updateSongUI(step, index, song.notes.length);

        normalizeStepNotes(step).forEach(note => {
            const keyEl = noteToKeyElement.get(note);
            if (keyEl) {
                pressKey(keyEl);
                playbackState.currentStepKeys.push(keyEl);
            } else {
                // Note is outside the full C1–C7 range — still play it accurately,
                // just without a key to highlight.
                playOffScreenNote(note);
                playbackState.currentStepOffScreenNotes.push(note);
            }
        });

        const ms = step.beats * msPerBeat();
        playbackState.timeoutId = setTimeout(() => scheduleStep(index + 1), ms);
    }

    function startSong() {
        if (playbackState.status === 'playing') return; // guards rapid double-clicks

        if (playbackState.status === 'paused') {
            playbackState.status = 'playing';
            updateTransportButtons();
            scheduleStep(playbackState.stepIndex);
            return;
        }

        const song = getSelectedSong();
        if (!song || !song.notes.length) return;

        playbackState.song = song;
        playbackState.bpm = Number(songTempoSlider.value) || song.bpm;
        playbackState.currentStepKeys = [];
        playbackState.currentStepOffScreenNotes = [];

        songSelect.disabled = true;
        playbackState.status = 'playing';
        updateTransportButtons();
        scheduleStep(0);
    }

    function pauseSong() {
        if (playbackState.status !== 'playing') return;
        clearTimeout(playbackState.timeoutId);
        releaseStepKeys();
        playbackState.status = 'paused';
        updateTransportButtons();
    }

    function resetSongUI() {
        clearNextHints();
        songCurrentNoteEl.textContent = '—';
        songNextNoteEl.textContent = '—';
        songProgressEl.value = 0;
    }

    function stopSong() {
        if (playbackState.status === 'idle') return;
        clearTimeout(playbackState.timeoutId);
        releaseStepKeys();
        playbackState.status = 'idle';
        playbackState.stepIndex = 0;
        resetSongUI();
        songSelect.disabled = false;
        updateTransportButtons();
    }

    function finishSong() {
        clearTimeout(playbackState.timeoutId);
        releaseStepKeys();
        playbackState.status = 'idle';
        playbackState.stepIndex = 0;
        clearNextHints();
        songCurrentNoteEl.textContent = 'Done!';
        songNextNoteEl.textContent = '—';
        songSelect.disabled = false;
        updateTransportButtons();
    }

    function loadSongOptions() {
        songs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.id;
            option.textContent = `${song.title} — ${song.artist}`;
            songSelect.appendChild(option);
        });
    }

    function applySongDefaults(song) {
        songTempoSlider.value = song.bpm;
        songTempoValue.textContent = `${song.bpm} BPM`;
        playbackState.bpm = song.bpm;
        songProgressEl.max = song.notes.length;
        songProgressEl.value = 0;
        preloadSongNotes(song);
    }

    // Defensive fallback for any song note outside the full C1–C7 range
    // (preloadAllNotes() already covers everything within it).
    function preloadSongNotes(song) {
        song.notes.forEach(step => {
            normalizeStepNotes(step).forEach(note => {
                if (!noteToKeyElement.has(note)) {
                    loadBuffer(noteToFileName(note));
                }
            });
        });
    }

    songSelect.addEventListener('change', () => {
        if (playbackState.status !== 'idle') stopSong();
        applySongDefaults(getSelectedSong());
    });

    songTempoSlider.addEventListener('input', () => {
        playbackState.bpm = Number(songTempoSlider.value);
        songTempoValue.textContent = `${songTempoSlider.value} BPM`;
    });

    songPlayBtn.addEventListener('click', startSong);
    songPauseBtn.addEventListener('click', pauseSong);
    songStopBtn.addEventListener('click', stopSong);

    function initSongPlayer() {
        loadSongOptions();
        const song = getSelectedSong();
        if (song) applySongDefaults(song);
        updateTransportButtons();
    }

    // ---- Mouse interaction ----
    let isMouseDown = false;

    keys.forEach(key => {
        key.addEventListener('mousedown', () => {
            isMouseDown = true;
            pressKey(key);
        });
        key.addEventListener('mouseup', () => releaseKey(key));
        key.addEventListener('mouseleave', () => {
            if (key.classList.contains('active')) releaseKey(key);
        });
        key.addEventListener('mouseenter', () => {
            if (isMouseDown) pressKey(key);
        });

        // Enter / Space activation for keyboard focus (accessibility)
        key.addEventListener('keydown', (event) => {
            if (event.code === 'Enter' || event.code === 'Space') {
                event.preventDefault();
                if (!event.repeat) pressKey(key);
            }
        });
        key.addEventListener('keyup', (event) => {
            if (event.code === 'Enter' || event.code === 'Space') {
                event.preventDefault();
                releaseKey(key);
            }
        });
    });

    document.addEventListener('mouseup', () => { isMouseDown = false; });

    // ---- Physical keyboard shortcuts ----
    // Keyed by event.code (physical key position) rather than event.key, so the
    // ergonomic layout stays correct regardless of Shift/Caps Lock or keyboard
    // language. Bindings are rebuilt by updateActiveShortcuts() whenever the
    // visible range slides.
    //
    // heldByPhysicalKey records exactly which key element a keydown actually
    // triggered, so if the range slides while a key is held, the matching keyup
    // still releases the right element — not whatever keyboardMap happens to
    // point to by then.
    const heldByPhysicalKey = new Map(); // event.code -> keyEl

    document.addEventListener('keydown', (event) => {
        getAudioContext();
        if (event.repeat) return;
        const mappedKey = keyboardMap[event.code];
        if (mappedKey) {
            pressKey(mappedKey);
            heldByPhysicalKey.set(event.code, mappedKey);
        }
    });

    document.addEventListener('keyup', (event) => {
        const heldKey = heldByPhysicalKey.get(event.code);
        if (heldKey) {
            releaseKey(heldKey);
            heldByPhysicalKey.delete(event.code);
        }
    });

    // ---- Touch interaction (glissando across keys) ----
    let currentTouchedKey = null;

    keys.forEach(key => {
        key.addEventListener('touchstart', (event) => {
            event.preventDefault();
            getAudioContext();
            pressKey(key);
            currentTouchedKey = key;
        });
        key.addEventListener('touchend', () => {
            releaseKey(key);
            currentTouchedKey = null;
        });
        key.addEventListener('touchcancel', () => {
            releaseKey(key);
            currentTouchedKey = null;
        });
    });

    pianoEl.addEventListener('touchmove', (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        const touchElement = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.key');

        if (touchElement) {
            if (currentTouchedKey !== touchElement) {
                if (currentTouchedKey) releaseKey(currentTouchedKey);
                pressKey(touchElement);
                currentTouchedKey = touchElement;
            }
        } else if (currentTouchedKey) {
            releaseKey(currentTouchedKey);
            currentTouchedKey = null;
        }
    });

    // ---- Init ----
    document.addEventListener('pointerdown', getAudioContext, { once: true });
    document.addEventListener('keydown', getAudioContext, { once: true });
    preloadAllNotes();
    applyWindow(windowStart);
    initSongPlayer();
});
