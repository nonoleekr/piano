document.addEventListener('DOMContentLoaded', () => {
    // Select all piano keys and the show notes checkbox
    const keys = document.querySelectorAll('.key');
    const showNotesCheckbox = document.getElementById('show-notes');
    
    // Initialize note visibility from localStorage or default to visible
    const notesVisible = localStorage.getItem('showNotes') !== 'false';
    showNotesCheckbox.checked = notesVisible;
    updateNoteVisibility(notesVisible);
    
    // Toggle note visibility when checkbox is changed
    showNotesCheckbox.addEventListener('change', () => {
        const isVisible = showNotesCheckbox.checked;
        updateNoteVisibility(isVisible);
        localStorage.setItem('showNotes', isVisible);
    });
    
    // Function to update visibility of notes on keys
    function updateNoteVisibility(isVisible) {
        keys.forEach(key => {
            if (isVisible) {
                key.classList.remove('notes-hidden');
            } else {
                key.classList.add('notes-hidden');
            }
        });
    }
    
    // Audio management
    const audioCache = {};  // Cache for audio objects
    const activeNotes = new Set();  // Track currently playing notes
    
    // Convert sharp notes to flat for file naming
    function preloadAudio(note) {
        let fileName = note;
        if (note.includes('#')) {
            const noteParts = note.split('#');
            const noteMap = {
                'C': 'Db',
                'D': 'Eb',
                'F': 'Gb',
                'G': 'Ab',
                'A': 'Bb'
            };
            fileName = noteMap[noteParts[0]] + noteParts[1];
        }
        
        // Create and configure audio object
        const audio = new Audio(`piano-mp3/${fileName}.mp3`);
        audio.preload = 'auto';
        audio.loop = true;
        return audio;
    }
    
    // Preload all audio files for piano keys
    keys.forEach(key => {
        const note = key.getAttribute('data-note');
        if (note) {
            audioCache[note] = preloadAudio(note);
        }
    });
    
    // Map keyboard keys to piano keys
    const keyboardMap = {};
    keys.forEach(key => {
        const keyboardKey = key.getAttribute('data-key');
        if (keyboardKey) {
            keyboardMap[keyboardKey] = key;
        }
    });
    
    // Play a note
    function playNote(note) {
        if (audioCache[note] && !activeNotes.has(note)) {
            const audio = audioCache[note];
            audio.currentTime = 0;
            audio.play().catch(e => console.error('Error playing audio:', e));
            activeNotes.add(note);
        }
    }
    
    // Stop a note with fade out effect
    function stopNote(note) {
        if (audioCache[note] && activeNotes.has(note)) {
            const audio = audioCache[note];
            const fadeOut = setInterval(() => {
                if (audio.volume > 0.1) {
                    audio.volume -= 0.1;
                } else {
                    audio.pause();
                    audio.volume = 1;
                    audio.currentTime = 0;
                    clearInterval(fadeOut);
                    activeNotes.delete(note);
                }
            }, 20);
        }
    }
    
    // Play a piano key
    function playKey(key) {
        const note = key.getAttribute('data-note');
        if (note) {
            key.classList.add('active');
            playNote(note);
        }
    }
    
    // Release a piano key
    function releaseKey(key) {
        const note = key.getAttribute('data-note');
        if (note) {
            key.classList.remove('active');
            stopNote(note);
        }
    }
    
    // Mouse interaction handling
    let isMouseDown = false;
    
    keys.forEach(key => {
        // Mouse down on key
        key.addEventListener('mousedown', () => {
            isMouseDown = true;
            playKey(key);
        });
        
        // Mouse up on key
        key.addEventListener('mouseup', () => {
            isMouseDown = false;
            releaseKey(key);
        });
        
        // Mouse leaves key
        key.addEventListener('mouseleave', () => {
            if (key.classList.contains('active')) {
                releaseKey(key);
            }
        });
        
        // Mouse enters key while button is pressed
        key.addEventListener('mouseenter', () => {
            if (isMouseDown) {
                playKey(key);
            }
        });
    });
    
    // Reset mouse state when mouse is released anywhere
    document.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
    
    // Keyboard interaction handling
    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (keyboardMap[key]) {
            if (!event.repeat) {
                playKey(keyboardMap[key]);
            } else {
                keyboardMap[key].classList.add('active');
            }
        }
    });
    
    document.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (keyboardMap[key]) {
            releaseKey(keyboardMap[key]);
        }
    });
    
    // Initialize audio context on first user interaction (required by browsers)
    document.body.addEventListener('click', () => {
        Object.values(audioCache).forEach(audio => {
            audio.volume = 0;
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1;
            }).catch(e => console.error('Error initializing audio:', e));
        });
    }, { once: true });
    
    document.addEventListener('keydown', () => {
        Object.values(audioCache).forEach(audio => {
            if (audio.paused) {
                audio.volume = 0;
                audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.volume = 1;
                }).catch(e => console.error('Error initializing audio:', e));
            }
        });
    }, { once: true });
    
    // Touch interaction handling for mobile devices
    let currentTouchedKey = null;
    
    keys.forEach(key => {
        // Touch starts on key
        key.addEventListener('touchstart', (e) => {
            e.preventDefault();
            playKey(key);
            currentTouchedKey = key;
        });
        
        // Touch ends on key
        key.addEventListener('touchend', () => {
            releaseKey(key);
            currentTouchedKey = null;
        });
        
        // Touch is canceled
        key.addEventListener('touchcancel', () => {
            releaseKey(key);
            currentTouchedKey = null;
        });
    });
    
    // Handle touch movement across keys
    document.querySelector('.piano').addEventListener('touchmove', (e) => {
        e.preventDefault();
        
        const touch = e.touches[0];
        const touchElement = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (touchElement && touchElement.classList.contains('key')) {
            if (currentTouchedKey !== touchElement) {
                if (currentTouchedKey) {
                    releaseKey(currentTouchedKey);
                }
                
                playKey(touchElement);
                currentTouchedKey = touchElement;
            }
        } else if (currentTouchedKey) {
            releaseKey(currentTouchedKey);
            currentTouchedKey = null;
        }
    });
    
    // Handle device orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            document.querySelector('.piano').style.display = 'none';
            setTimeout(() => {
                document.querySelector('.piano').style.display = 'block';
                
                updateNoteVisibility(showNotesCheckbox.checked);
            }, 10);
        }, 100);
    });
});