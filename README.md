# pace

Offline-first period tracking mobile app built with Expo Router + TypeScript.

## Core features

- **Home tab**: cycle status card and quick daily log (symptoms, flow, mood, notes)
- **Calendar tab**: monthly grid highlighting logged period days, current cycle window, and predicted next periods
- **Insights tab**: local cycle statistics and JSON backup export via native share sheet
- **Local-only data**: all health data stored in local Expo SQLite database (`pace.db`)

## Project structure

```text
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx        # Home
    calendar.tsx     # Calendar
    insights.tsx     # Insights/Settings
lib/
  database.ts        # SQLite init, queries, stats, export helpers
constants/
  Colors.ts          # Health-focused palette
```
