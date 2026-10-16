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
