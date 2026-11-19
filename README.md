# The World Tonight — 19 November 2026 in one night poster

[![make.fun · news-image-20261119](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/ChristaNavisa/news-image-20261119/rank.svg)](https://make.fun/bounty/news-image-20261119/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/ChristaNavisa/news-image-20261119/reward.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)

A dark navy-and-gold night poster summing up Thursday 19 November 2026 in a
single image: **43 stories from 7 regions**, built for the
[make.fun bounty](https://make.fun/bounty/news-image-20261119).

## What the poster shows

- **3 illustrated hero scenes** — GTA VI launches after a 13-year wait
  (Vice City opens; 99/100 reviews, 2.3M watching on Twitch), the first
  Trump–Xi–Putin trilateral at the APEC summit in Shenzhen, and Anthropic's
  record $81.3B IPO ($83 a share, ~$1.5T value — the biggest debut ever,
  topping SpaceX's $75B).
- **A dotted world map with 10 numbered pins** marking where the biggest
  stories happened, from Miami and New York to Shenzhen, Gaza, Tallinn,
  Kyiv, Addis Ababa, New Delhi, Wellington and Brasília.
- **40 numbered briefs** across North America, South America, Europe,
  Africa, Asia, Oceania and the wider world — every headline with a complete
  one-line caption, none clipped or covered.

## How it is made

`work/gen3.py` (kept outside this repo) draws the poster with PIL from a
hand-built list of the day's 43 stories, researched from the 19 November
2026 news — the APEC trilateral, the Gulf strikes, Cyclone Akvan, the
Estonia–Russia border closure, the EU's €45B Ukraine loan, the Ethiopia–
Eritrea tensions, Voyager 1's one-light-day milestone and more. The finished
image ships as `entry.png`; `main.ts` (Node 22, standard library only)
copies it to the output directory, deterministically — two runs write
identical bytes, verified by sha256.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/entry.png
```

## License

MIT — see [LICENSE](LICENSE).
