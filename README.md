# Awaken - Hunter Training System

A "System"-style self-development app (PWA + Android). Every day the System issues a **Daily Quest** of at most **10 minutes**: boxing, Muay Thai, knife (Kali) and rod/stick (Arnis) drills with voice callouts, plus push-ups, squats and crunches that level up. Clear quests to gain EXP, raise stats and climb from **E-Rank to S-Rank**. Miss one and a **Penalty Quest** (+20% reps) arrives the next day.

## Features
- **Daily Quest**: a 6/8/10-minute guided session (hard cap: 10 min). Interval timer, spoken combo callouts ("1-2-3", "Angle 4", "Teep, reset"), countdown beeps, screen kept awake.
- **30 / 60 / 90-day program**: 3 phases (Awakening, Hunter, Ascendant). Weekly cycle: 2 boxing, 2 Muay Thai, 1 mixed, 1 weapons, 1 active-recovery day.
- **Strength ladders**: push-ups (wall to archer), squats (chair to pistol), crunches (crunch to V-up). Daily targets adjust from how you actually perform. A "Class Advancement" unlocks the next variation.
- **Status window**: level, rank, EXP, 6 stats (STR, VIT, CORE, STRIKE, BLADE, STAFF), streaks, titles.
- **Calendar**: every program day marked cleared, missed or upcoming, with a preview of each day's plan.
- **Skill library**: 33 drills and 18 exercise stages, each with how-to steps, safety notes and **75 YouTube tutorials, all checked public** (see [docs/VIDEOS.md](docs/VIDEOS.md)).
- Offline-first, no account. Data stays on the device and can be exported or imported as a backup.

## Project layout
```
src/                 web app (native ES modules, no bundler)
  js/config.js       branding + global limits (rename the app here)
  js/core/           store (versioned schema + migrations), dates
  js/data/           curriculum: drills, exercises, achievements, verified video registry
  js/domain/         pure logic: program generator, leveling, strength, quest rules, session timer
  js/services/       platform bridge (Capacitor/web), audio + TTS
  js/ui/, js/views/  DOM helper, System modal, screens
tests/               node:test unit tests (domain + state)
scripts/             build, icons, video verification, local server
android/             Capacitor Android project
docs/                research, architecture, video report, store assets
build/               latest tested APK
```

## Commands
```bash
npm install
npm test                 # unit tests
npm run verify:videos    # re-check every YouTube link (fails if any is gone)
npm run build            # src -> dist (stamps the service worker)
npm run serve            # http://localhost:8080
npm run icons            # regenerate all icons, including Android
npm run android:apk      # debug APK (needs JAVA_HOME = Android Studio jbr)
npm run android:release  # signed AAB + APK (needs android/keystore.properties)
```

## Publishing
- **PWA**: deploy `dist/` to any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages).
- **Play Store**: create an upload keystore, then add `android/keystore.properties` (storeFile, storePassword, keyAlias, keyPassword). Run `npm run android:release`, then upload `android/app/build/outputs/bundle/release/app-release.aab`. Bump `versionCode`/`versionName` in `android/app/build.gradle` and `APP.version` in `src/js/config.js` for every release.
- Play listing notes: category Health & Fitness. Data safety: no data collected (everything stays on the device). Notifications are only used for the optional daily reminder.

## Safety and IP
Weapons drills are for training tools only (a wooden, rubber or blunt trainer knife, and a rattan or foam stick). The app is inspired by the progression-fantasy "System" genre and does not use names, art or text from any franchise. The videos belong to their creators; the app links to YouTube and never re-hosts them.
