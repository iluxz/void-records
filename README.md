# void records

a record player for the objbox school edition soundtrack. one repo, one page, no cube.

## play

```
https://iluxz.github.io/void-records/
```

mirror (no jekyll, no build, raw from branch):

```
https://raw.githack.com/iluxz/void-records/main/index.html
```

## what it is

- **114 tracks** pulled from the objbox bgm registry + every special-cased branch song (employment, downfall, foxy, stanley, moon, box, folk/grotto cues — aliases searchable in the filter box), plus the tally hall/miracle musical batch, havexy pack 2, the full Bad Things OST (22 songs), horror skunx, dm dokuro, axie and more
- all unlocked, nothing gated, no chapter, no premium, no key
- vinyl turntable with tonearm, spectrum bars, wave background that moves with the bass
- prev / next / shuffle / loop-one / volume / seek / filter
- smooth fades between records, sleep timer fades out instead of hard-cutting
- os window with **lyrics** (lrclib, karaoke highlight when the song is timed), **info**, **stats** (spin counts, top tracks, history) and **credits** tabs
- star favorites, spin counts on every row, `recent` filter by last played
- blobs are fetched whole before playing (githack has no range support — same trick objbox used)
- installable as a desktop app (manifest + service worker, app shell works offline)

## controls

| key / button | action |
|---|---|
| click track | play it |
| &#9654; / &#10074;&#10074; | play / pause (space-free, it's a website) |
| &#128256; | shuffle (rebuilds order in place) |
| &#128257; | loop one |
| filter box | searches names + aliases + filenames |
| `favorites` / `recent` | filter modes: starred rows / what you played last |

## origins

forked out of `objbox-school`, which was stripped from `objbox` itself. no cube chapter in this fork - just the music (the cube itself is still going, this is the side project). song sources in `songPLSDOWNLOAD.txt`.
