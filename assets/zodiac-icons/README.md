# move ♥ me zodiac icons

12 signs x 8 styles x 3 color sets, each in light and dark mode (576 SVGs).

Folders: <set>/<mode>/<sign>-<style>.svg
- sets: cobalt (cobalt + chartreuse), coral (coral + cobalt), mono (black + white)
- modes: light (for paper/white grounds), dark (for #13121D grounds)
- styles: outline, filled, twotone, half, swash, circle, blob, sticker
- signs: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces

All files are 64x64 viewBox, scale cleanly. Recommended display: 32, 48 or 64px.
Each SVG has a <title> and aria-label; when an icon sits next to its sign name, add aria-hidden="true" instead.
Theme swap example:
  <picture>
    <source srcset="cobalt/dark/leo-twotone.svg" media="(prefers-color-scheme: dark)">
    <img src="cobalt/light/leo-twotone.svg" alt="Leo" width="48" height="48">
  </picture>
