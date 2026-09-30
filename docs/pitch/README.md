# Pitch: Hackabike – Smart Bikestation

The slide deck for the final presentation at the Kalkar Hackathon 2026, by Luca and Tobias.
It follows the jury's evaluation form: innovation, technical implementation, testing & quality,
open source & documentation, and the pitch itself.

| File | What it is |
|---|---|
| [`slides.pdf`](slides.pdf) | the deck, ready to present (speaker notes included as PDF annotations) |
| [`slides.md`](slides.md) | the source, one Markdown file written for [Marp](https://marp.app) |
| [`slides.pptx`](slides.pptx) | editable PowerPoint version with speaker notes (a separate copy: changes to `slides.md` do not update it) |

## Edit and rebuild

Change `slides.md`: slides are separated by `---`, speaker notes are the
`<!-- … -->` comments, and the look is the `style:` block at the top.

```bash
npx @marp-team/marp-cli docs/pitch/slides.md --html --pdf --pdf-notes -o docs/pitch/slides.pdf
npx @marp-team/marp-cli docs/pitch/slides.md --html --pptx   # PowerPoint
npx @marp-team/marp-cli docs/pitch/slides.md --html -p       # live preview in the browser
```

Marp needs Chrome, Chromium or Edge on the machine. The VS Code extension
*Marp for VS Code* shows a live preview while you type.

> [!TIP]
> If the build hangs, it is usually stuck loading the Google Fonts. Stop it and run it again.

## Before presenting

- Replace `[Team name]` on the first slide.
- Refresh the figures on "Live data" (queries in
  [postgres/README.md](../../postgres/README.md#useful-queries)) and "Open source"
  (`git rev-list --count HEAD`, `git shortlog -sn`). They are from 29 Sep 2026.
