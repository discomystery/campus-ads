# Campus Early Vote Studio

Animated 4:5 Instagram PSAs for North Carolina early voting, one per campus, in each school's colors.

**Live site:** https://discomystery.github.io/campus-ads/ (once GitHub Pages is on: Settings → Pages → Deploy from a branch → `main` / root)

## Run locally

```
python3 -m http.server 8765
```

Then open http://localhost:8765 in Chrome (Chrome exports H.264 MP4 video, which Instagram expects).

## Notes

- Static site: `index.html`, `styles.css`, `app.js`, `data.js`, plus `vendor/mp4-muxer.js` (MIT) for MP4 export. No build step.
- Early voting sites and hours: NC State Board of Elections list for the Nov 3, 2026 election (`data.js`). School flyer sites override the nearest-site pick where provided.
- Student IDs: approvals from the State Board's 2025–26 list (valid through Dec 31, 2026); unconfirmed schools get a general photo-ID line. Check the Data check view before posting.
- Edits (text, colors, layouts, per-school settings) are saved in the browser. Use Export → Save settings file to move them between computers.

## Down-Ballot Studio (judicial races spin-off)

`judicial/` is a separate studio for Election Day (Nov 3, 2026) judicial race ads aimed at people who missed early voting. It follows the campaign literature: a headline on white with key words in bold blue, then the four judges (Earls, Arrowood, Hampson, Walczyk) as cutouts on blue circles popping out of a yellow band, each with "Justice Anita" / **EARLS** / "for Supreme Court". Yellow, blue, white and black only. Live at `/campus-ads/judicial/` once Pages is on.

- Every Meta and Google Display size: Meta feed 4:5 and 1:1, Stories/Reels 9:16 (text kept inside the safe zone), Facebook link ad, plus 300×250, 336×280, 728×90, 970×250, 160×600, 300×600, 320×50, 320×100, and a custom size. Each size is laid out by fitting blocks to boxes, so a custom size works too. Nothing is drawn below a readable size: small sizes use the short headline and drop name lines, and the tiniest show last names and the button only.
- Candidate photos: shoulders-up transparent PNGs. Empty edges are trimmed on upload so every judge lines up.
- Three designs, chosen per size (Mix alternates them) or previewed across every size from the All sizes view (`judicial/suites.js`): **Spotlight** (hook headline, each judge full-frame through an iris wipe, then an end card), **Front Row** (scrolling ticker, full-width poster headline, the judges shoulder to shoulder on a sunrise), **Scrapbook** (polaroid cards over sunburst rays, a marker note in Permanent Marker, a starburst button). Looping ambient motion (ticker, shine, rays) is left out of GIFs to keep them small.
- Timing: pick a Spotlight slide to set how long it stays up (or copy one judge's length to all four). Slide lengths apply to every size of that design, and the ad runs as long as its slides need (the Length setting becomes a minimum, up to 30 seconds). Any element can also get a Delay (−1 to +3 s) to come in earlier or later. If a long GIF can't fit under 150 KB even at 2 frames a second, it falls back to straight cuts between finished slides.
- Editor layout: sizes and a Layers list on the left (everything on the current slide, top first, with an eye to hide), the ad in the middle with a slide strip under it (a thumbnail per slide and its length in seconds), and on the right the settings tabs, which switch to an inspector while an element is selected (Esc or ✕ goes back).
- Slide-by-slide editing: click a slide's thumbnail to freeze it; every line of text, photo, shape and background is its own element. The inspector takes exact numbers in ad pixels: X, Y, W, scale, font size, weight, width and delay, plus text, highlight and fill colors and six align buttons (to the margins; Shift for the ad's edges). "Match the font size of…" copies any other line's size, from any slide, and "Copy these edits to the other slides" puts the same element on every judge slide at the same px size, lined up. Text keeps its aligned edge when its size, weight or width changes. Moving a card or starburst carries its text with it. Edits are saved per size and design, and the animation presets still move everything in from its edited spot.
- Snapping: while dragging, an element snaps to the ad's edges, center and margins, to the other elements on the slide, and to the same element on the other slides (blue guide), with a readout of its position; resizing text snaps to font sizes used elsewhere in the ad. Hold Alt to skip snapping, or turn Snap off above the ad.
- The campaign's judge and Roy Cooper cutouts ship in `judicial/photos/` as the defaults.
- Options: animation style (Pop, Slide, Fade or None) and button pulse on the Style tab; photo frame (circle, rounded square or none) for the judges and for the endorser; and per-judge checkboxes for the title/first-name line and the office line.
- Motion: every ad animates in over ~4–5 seconds (band sweeps in, headline builds word by word, judges pop up out of their circles, last names land, endorser, button stretches open and pulses), then holds. Meta sizes export as MP4 (H.264 in Chrome/Edge); Google sizes export as animated GIFs under 150 KB that replay within Google's 30-second limit, with optional still backups.
- Endorser (Roy Cooper): face and name only, on the larger sizes by default. Choose which sizes on the Endorser tab.
- Election Day copy: every size says it's Election Day and when polls close (7:30 PM).
- Alternate messages (Message tab): five ready-made headline/button sets, spread across the sizes so the ads don't all say the same thing. Edit, add or remove them, pick one per size, or export every message for every size for A/B testing.
- Font: Obviously Variable from Adobe Fonts, drawn wide (headline, last names, button) and narrow (name lines, tag), with width and weight sliders on the Style tab. Add it to a web project, add this site's domain (and `localhost`), then paste the project ID. If the browser can't read the project's CSS, the Style tab asks you to paste it in. Until then it uses Archivo.
- Export PNG/JPG per size or every checked size as one ZIP. Google sizes are kept under 150 KB.
