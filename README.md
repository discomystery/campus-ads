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

- Every Meta and Google Display size: Meta feed 4:5 and 1:1, Stories/Reels 9:16 (text kept inside the safe zone), Facebook link ad, plus 300×250, 336×280, 728×90, 970×250, 160×600, 300×600, 320×50, 320×100, and a custom size. Each size is laid out by fitting blocks to boxes, so a custom size works too. Small sizes use the short headline and drop name lines; the tiniest show last names only.
- Candidate photos: shoulders-up transparent PNGs. Empty edges are trimmed on upload so every judge lines up.
- Endorser photo (upload, zoom, reposition) on the larger sizes by default. Choose which sizes on the Endorser tab.
- Election Day copy: every size says it's Election Day and when polls close (7:30 PM); the larger sizes add a polling-place line (vote.nc.gov). Election Day voting is at the voter's assigned precinct, so no voting site is named on the ads.
- Font: Roc Grotesk Wide and Condensed from Adobe Fonts. Add them to a web project, add this site's domain (and `localhost`), then paste the project ID on the Style tab. Until then it uses Archivo's wide and narrow widths.
- Export PNG/JPG per size or every checked size as one ZIP. Google sizes are kept under 150 KB.
