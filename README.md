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

- **68 tracks** pulled from the objbox bgm registry + every special-cased branch song (employment, downfall, foxy, stanley, moon, box, folk/grotto cues — aliases searchable in the filter box)
- all unlocked, nothing gated, no chapter, no premium, no key
- vinyl turntable with tonearm, spectrum bars, wave background that moves with the bass
- prev / next / shuffle / loop-one / volume / seek / filter
- blobs are fetched whole before playing (githack has no range support — same trick objbox used)

## controls

| key / button | action |
|---|---|
| click track | play it |
| &#9654; / &#10074;&#10074; | play / pause (space-free, it's a website) |
| &#128256; | shuffle (rebuilds order in place) |
| &#128257; | loop one |
| filter box | searches names + aliases + filenames |

## origins

forked out of `objbox-school`, which was stripped from `objbox` itself. the cube is gone — only the music survived. song sources in `songPLSDOWNLOAD.txt`.
