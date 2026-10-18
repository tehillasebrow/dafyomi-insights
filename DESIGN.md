# DESIGN.md — Daf Yomi Insights

The one place the site's look is decided. Every page reuses this; nothing is re-decided per page.

## Status

Live since 2026-10-17: "Highlighter Shiur", picked by the owner in the design studio and revised
after a readability review. The tokens live in `app/globals.css`.

## Chosen look: Highlighter Shiur

The yellow marker every chavrusa runs across the page, black ink, and the blue ballpoint in the margin.

- **Colour** (light / dark): paper #f6f7f3 / #17181c, surface #fdfdfa / #1d1f23, ink #17181c / #f1f0e8,
  soft ink #3d4048 / #d6d5cc, faint ink #565a63 / #b4b3aa, rules #d6d8cf / #3a3c42,
  highlighter yellow #ffe53b (bands, today, stickers), marker #fff07a / #5b5212 (behind titles),
  ballpoint blue #1e3fae / #a9c1ff (the one accent: list numerals, small labels, current page, focus),
  black #17181c for buttons and the footer.
- **Type:** Suez One for titles and every Hebrew daf numeral (one weight, never synthesised bold);
  Literata for reading, labels and buttons; Frank Ruhl Libre for Hebrew running text.
- **Signature:** the daf numeral as a yellow sticker. Only today's numeral is tilted (-3 degrees).
- **Titles:** a highlighter stroke under the lower half of page titles and section heads (`.hl`);
  the home lead title is swiped once on load.
- **Lists:** index cards (`.index-card`, `.row`) with the Hebrew daf in blue.
- **Buttons:** one primary per screen, black with yellow letters (yellow with black in dark mode);
  secondary buttons are outlined.
- **Home:** the lead article is on today's daf, or else the nearest daf from last week to next week,
  labelled by how close it is ("On tomorrow's daf", "On Thursday's daf, earlier this week").
  Beside it, a yellow today panel with the week as rows. Then more articles, the seder as
  left-to-right bars and topics; stories last.
- **Menu order:** Articles, Beyond the Daf, Masechtos, Today's Daf, Stories, Topics, More.
  Stories and Topics move into More on narrower screens.

## Fixed rules (apply whatever look is picked)

**Bold surface, familiar skeleton.** Be distinctive in colour, type, texture, the Hebrew daf
numerals and the copy voice. Stay conventional in navigation (top of the page, plain words),
links, buttons, forms, reading order and scrolling. If a style makes something harder to find,
read or click, usability wins.

**Signature.** The big Hebrew daf numeral (כ״ה) and the week's luach are the site's identity.
They appear on the home page, the article page and the today's-daf band.

**Colour tokens** (names stay the same in every palette):
`--bg --surf --sunk --ink --ink2 --ink3 --line --line-hard --lead --on-lead --accent
--on-accent --accent-ink --mark --band --band-ink --band-soft --band-accent --danger --s1..--s6`.
- One dominant colour (`--lead`), one sharp accent (`--accent`). The accent is a budget: the
  current page in the nav, today's daf, the highlight. Nothing else.
- Neutrals are tinted toward the dominant colour. No pure #000 or #fff.
- Body text meets WCAG AA at its real size in light and dark.

**Type.** A display face for titles and Hebrew numerals, a calm reading face for articles.
At most two families plus a Hebrew face when the pair has none. Body text 17–19px,
line-height 1.6–1.75, 60–75 characters per line. Titles use real contrast with body text
(size jump of 3x or more).

**Space.** One scale: 4 8 12 16 24 32 48 64 96 (times the density of the chosen shape).
Nothing off-scale.

**Shape and depth.** Radii only from `--r-sm / --r / --r-lg`. No shadows except to say "this
lifts" (a pressed button, an open menu), tinted with the ink colour.

**Motion.** One entrance per screen at most, 150–700ms, ease-out, and nothing when the
visitor asks for reduced motion.

**Previews** show the opening lines of the article, never the summary.

**States.** Every control has hover, pressed, focus-visible, disabled and loading. Every list
has an empty state written in the site's voice, and errors say what happened and what to do.

**Banned** unless the owner asks: purple/indigo as the main colour, gradient text, glows,
glassmorphism, emoji as icons, pill-only buttons, coloured stripes on cards, cards inside cards,
ALL-CAPS labels everywhere, "01 ·" section numbers, fade-up on every section, scale-on-hover,
parallax, Inter/Roboto/Arial/Space Grotesk/Fraunces/Playfair/Instrument Serif as defaults,
and copy words like transform, elevate, seamless, effortless.
