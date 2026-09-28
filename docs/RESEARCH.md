# Research and design notes

## The "System" in Solo Leveling (what inspired the design)
- The hero becomes a "Player" who sees holographic **System windows**: a status screen (level, stats, title, job), notifications and quests.
- **Daily Quest**: a fixed physical routine (push-ups, sit-ups, squats, a run) that must be done every day. Failing it sends the player to a **Penalty Zone**.
- Rewards: EXP, **level-ups**, stat points (Strength, Agility, Vitality, Intelligence, Perception), **titles**, and a **rank** that climbs from E to S.
- Sources: [Solo Leveling Wiki: Quests](https://solo-leveling.fandom.com/wiki/Quests), [Penalty Zone](https://solo-leveling.fandom.com/wiki/Penalty_Zone), [What is the System](https://onlinesololevelingmanga.us/what-is-the-system-in-solo-leveling/).

### How Awaken adapts it (original, not copied)
| Solo Leveling | Awaken |
|---|---|
| Daily Quest (about 1 hour) | 10-minute Daily Quest: combat drills + strength sets |
| Penalty Zone | Penalty Quest: +20% reps the next day (never extra time) |
| STR / AGI / VIT / INT / PER | STR (push-ups), VIT (squats), CORE (crunches), STRIKE (boxing + Muay Thai), BLADE (knife), STAFF (rod) |
| Job change | Class Advancement: move up to a harder exercise variation |
| E to S rank | Rank by level: E 1-5, D 6-12, C 13-20, B 21-30, A 31-40, S 41+ |
| Titles | 19 achievements; the latest one is shown as your title |

All names, text and art are original. There are no franchise names, logos or quotes, so the app can be published safely.

## Competitive scan (September 2026)
- [HabitForge](https://habitforge.io/solo-leveling-app/), [MainQuest](https://www.mainquest.net/solo-leveling-inspired-gamified-life-app) and [Solo Levelling Daily Quests (Play)](https://play.google.com/store/apps/details?id=fr.storycom.sololevellingdailyquests&hl=en_US) are general habit trackers or rep checklists with a Solo Leveling theme.
- [Rahoof-Codes/solo-levelling-system](https://github.com/Rahoof-Codes/solo-levelling-system) is an open-source gamified workout logger.
- **Gap Awaken fills:** none of these ships a real **combat-skills curriculum** (boxing, Muay Thai, Kali knife, Arnis stick) with a guided **interval timer and spoken combo callouts**, a hard **10-minute cap**, adaptive strength ladders and **verified tutorial videos** for every drill.

## Why 10 minutes works
- Short daily practice builds skill (motor learning favours frequent, spaced repetition) and habit (a low barrier means fewer missed days).
- Strength targets start at about 60% of your one-set max. Two hits in a row add a rep; two clear misses remove one. This avoids burnout.
- The weekly recovery day swaps intensity for mobility, while the streak stays alive.

## Video verification
`scripts/verify-videos.mjs` checks every referenced YouTube ID against YouTube's oEmbed endpoint. It returns 200 only for public, embeddable videos. One candidate that failed (embedding disabled) was replaced. Result: 75/75 OK ([VIDEOS.md](VIDEOS.md)). A unit test fails if the curriculum references a video that has not been verified.
