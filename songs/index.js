// Song registry — the only file allowed to import individual songs.
// The rest of the app (script.js) imports from here, never from a song
// file directly. To add a new song: create songs/your-song.js exporting
// a default song object, then add two lines below (import + array entry).

import { validateSongs } from './validate.js';
import twinkleTwinkle from './twinkle-twinkle.js';
import maryHadALittleLamb from './mary-had-a-little-lamb.js';
import runaway from './runaway.js';

const registeredSongs = [
    twinkleTwinkle,
    maryHadALittleLamb,
    runaway,
];

validateSongs(registeredSongs);

export const songs = registeredSongs;

const songsById = new Map(songs.map(song => [song.id, song]));

export function getSongById(id) {
    return songsById.get(id);
}
