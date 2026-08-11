import { songs, getSongById } from './songs/index.js';

document.addEventListener('DOMContentLoaded', () => {
    const keys = Array.from(document.querySelectorAll('.key'));
    const showNotesCheckbox = document.getElementById('show-notes');
    const sustainCheckbox = document.getElementById('sustain-toggle');
    const volumeSlider = document.getElementById('volume');
    const octaveDownBtn = document.getElementById('octave-down');
    const octaveUpBtn = document.getElementById('octave-up');
    const octaveLabel = document.getElementById('octave-label');
    const nowPlayingEl = document.getElementById('now-playing-notes');
    const pianoEl = document.querySelector('.piano');

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
    const MIN_OCTAVE_SHIFT = -2;
    const MAX_OCTAVE_SHIFT = 2;

    function parseNote(note) {
        const match = note.match(/^([A-G]#?)(\d)$/);
        return { pitchClass: match[1], octave: parseInt(match[2], 10) };
    }

    function transposeNote(note, semitones) {
        const { pitchClass, octave } = parseNote(note);
        const index = octave * 12 + NOTE_SEQUENCE.indexOf(pitchClass) + semitones;
        const newOctave = Math.floor(index / 12);
        const newPitchClass = NOTE_SEQUENCE[((index % 12) + 12) % 12];
        return `${newPitchClass}${newOctave}`;
    }

    function noteToFileName(note) {
        const { pitchClass, octave } = parseNote(note);
        return `${FLAT_NAMES[pitchClass] || pitchClass}${octave}`;
    }

    // The note actually sounded for a key's base (unshifted) note, given the current octave shift.
    function currentNoteFor(baseNote) {
        return transposeNote(baseNote, octaveShift * 12);
    }

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
    const activeVoices = new Map();  // baseNote -> { source, gain }
    const pressedKeys = new Set();   // baseNote currently physically held
    const pressTokens = new Map();   // baseNote -> latest press token (guards async races)

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

    function preloadCurrentRange() {
        keys.forEach(key => {
            loadBuffer(noteToFileName(currentNoteFor(key.dataset.note)));
        });
    }

    // Keep each key's visible note name / octave and accessible label in sync
    // with what will actually sound (they drift apart when the octave is shifted).
    function updateKeyLabels() {
        keys.forEach(key => {
            const { pitchClass, octave } = parseNote(currentNoteFor(key.dataset.note));
            key.querySelector('.note-name').textContent = pitchClass;
            key.querySelector('.octave').textContent = octave;
            const shortcutLabel = key.dataset.keyLabel;
            key.setAttribute('aria-label', shortcutLabel
                ? `${pitchClass}${octave}, keyboard shortcut ${shortcutLabel}`
                : `${pitchClass}${octave}`);
        });
    }

    function stopVoice(baseNote) {
        const voice = activeVoices.get(baseNote);
        if (!voice) return;
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const { gain, source } = voice;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
        source.stop(now + 0.26);
        activeVoices.delete(baseNote);
    }

    function playNote(baseNote) {
        const ctx = getAudioContext();
        const fileName = noteToFileName(currentNoteFor(baseNote));

        // Retriggering a still-sounding note: cut the old voice short first.
        stopVoice(baseNote);

        // Token guards against a stale, still-loading press overwriting a newer one.
        const token = Symbol(baseNote);
        pressTokens.set(baseNote, token);

        loadBuffer(fileName).then(buffer => {
            if (!buffer || pressTokens.get(baseNote) !== token) return;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.value = 1;
            source.connect(gain).connect(masterGain);
            source.start(0);
            activeVoices.set(baseNote, { source, gain });
            updateNowPlaying();
        });
    }

    function updateNowPlaying() {
        const notes = Array.from(activeVoices.keys()).map(currentNoteFor);
        nowPlayingEl.textContent = notes.length ? notes.join(' · ') : '—';
    }

    // ---- Sustain ----
    sustainCheckbox.checked = localStorage.getItem('sustain') === 'true';
    sustainCheckbox.addEventListener('change', () => {
        localStorage.setItem('sustain', sustainCheckbox.checked);
        if (!sustainCheckbox.checked) {
            // Release any notes that are ringing only because sustain held them.
            Array.from(activeVoices.keys())
                .filter(baseNote => !pressedKeys.has(baseNote))
                .forEach(baseNote => { stopVoice(baseNote); updateNowPlaying(); });
        }
    });

    // ---- Volume ----
    volumeSlider.addEventListener('input', () => {
        if (masterGain) {
            masterGain.gain.value = volumeSlider.value / 100;
        }
    });

    // ---- Octave shift ----
    let octaveShift = 0;

    function updateOctaveLabel() {
        octaveLabel.textContent = `Octave ${3 + octaveShift}–${5 + octaveShift}`;
        octaveDownBtn.disabled = octaveShift <= MIN_OCTAVE_SHIFT;
        octaveUpBtn.disabled = octaveShift >= MAX_OCTAVE_SHIFT;
    }

    function shiftOctave(delta) {
        const next = octaveShift + delta;
        if (next < MIN_OCTAVE_SHIFT || next > MAX_OCTAVE_SHIFT) return;
        // Changing octave mid-note would bend the pitch of ringing notes, so stop everything first.
        Array.from(activeVoices.keys()).forEach(stopVoice);
        pressedKeys.forEach(baseNote => {
            const keyEl = keys.find(k => k.dataset.note === baseNote);
            if (keyEl) releaseKeyVisual(keyEl);
        });
        pressedKeys.clear();
        octaveShift = next;
        updateOctaveLabel();
        updateKeyLabels();
        updateNowPlaying();
        preloadCurrentRange();
    }

    octaveDownBtn.addEventListener('click', () => shiftOctave(-1));
    octaveUpBtn.addEventListener('click', () => shiftOctave(1));

    // ---- Key press/release ----
    function releaseKeyVisual(keyEl) {
        keyEl.classList.remove('active');
        keyEl.setAttribute('aria-pressed', 'false');
    }

    function pressKey(keyEl) {
        const baseNote = keyEl.dataset.note;
        if (!baseNote || pressedKeys.has(baseNote)) return;
        pressedKeys.add(baseNote);
        keyEl.classList.add('active');
        keyEl.setAttribute('aria-pressed', 'true');
        playNote(baseNote);
    }

    function releaseKey(keyEl) {
        const baseNote = keyEl.dataset.note;
        if (!baseNote || !pressedKeys.has(baseNote)) return;
        pressedKeys.delete(baseNote);
        releaseKeyVisual(keyEl);
        if (!sustainCheckbox.checked) {
            stopVoice(baseNote);
            updateNowPlaying();
        }
    }

    // ---- Song player (practice mode / auto-play) ----
    // Reuses pressKey()/releaseKey() exactly like mouse, touch, and keyboard input do,
    // so autoplay gets correct highlighting, aria-pressed, "Now playing", and sustain
    // behavior for free without a second audio path.
    const noteToKeyElement = new Map(keys.map(key => [key.dataset.note, key]));

    const playbackState = {
        status: 'idle',        // 'idle' | 'playing' | 'paused'
        song: null,
        stepIndex: 0,
        timeoutId: null,
        bpm: 100,
        savedOctaveShift: null,
        currentStepKeys: [],
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

    // Songs reference real note names (e.g. "C4"), so playback needs the piano
    // sitting at octaveShift 0 while it plays; the user's own shift is restored after.
    function setPlaybackControlsLocked(locked) {
        songSelect.disabled = locked;
        if (locked) {
            octaveDownBtn.disabled = true;
            octaveUpBtn.disabled = true;
        } else {
            updateOctaveLabel();
        }
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
            if (!keyEl) return;
            pressKey(keyEl);
            playbackState.currentStepKeys.push(keyEl);
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
        playbackState.savedOctaveShift = octaveShift;
        playbackState.currentStepKeys = [];
        if (octaveShift !== 0) {
            octaveShift = 0;
            updateKeyLabels();
            preloadCurrentRange();
        }

        setPlaybackControlsLocked(true);
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

    function restoreOctaveAfterPlayback() {
        if (playbackState.savedOctaveShift !== null && playbackState.savedOctaveShift !== octaveShift) {
            octaveShift = playbackState.savedOctaveShift;
            updateKeyLabels();
            preloadCurrentRange();
        }
        playbackState.savedOctaveShift = null;
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
        restoreOctaveAfterPlayback();
        playbackState.status = 'idle';
        playbackState.stepIndex = 0;
        resetSongUI();
        setPlaybackControlsLocked(false);
        updateTransportButtons();
    }

    function finishSong() {
        clearTimeout(playbackState.timeoutId);
        releaseStepKeys();
        restoreOctaveAfterPlayback();
        playbackState.status = 'idle';
        playbackState.stepIndex = 0;
        clearNextHints();
        songCurrentNoteEl.textContent = 'Done!';
        songNextNoteEl.textContent = '—';
        setPlaybackControlsLocked(false);
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
        key.setAttribute('aria-pressed', 'false');

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
    // ergonomic layout below stays correct regardless of Shift/Caps Lock or keyboard language.
    const keyboardMap = {};
    keys.forEach(key => {
        const shortcut = key.getAttribute('data-key');
        if (shortcut) keyboardMap[shortcut] = key;
    });

    document.addEventListener('keydown', (event) => {
        getAudioContext();
        const mappedKey = keyboardMap[event.code];
        if (mappedKey && !event.repeat) {
            pressKey(mappedKey);
        }
    });

    document.addEventListener('keyup', (event) => {
        const mappedKey = keyboardMap[event.code];
        if (mappedKey) releaseKey(mappedKey);
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
    updateOctaveLabel();
    updateKeyLabels();
    preloadCurrentRange();
    initSongPlayer();
});
