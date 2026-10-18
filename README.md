# Volute

An original arcade puzzle game in a geothermal pump hall. Fire luminous mineral
cores into the winding feed channel, match three of a charge, and extract them
before they reach the intake. Recoil can close gaps into scoring chains. Marked
cores grant choke, backflow, bore, or sightline machinery. Clear five halls with
three cells.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

Serve `dist/` from any static server, at the root or under a sub-path. The game is
entirely local: no backend, account, network service, or external asset request.

## Controls

| Action                        | Control                                            |
| ----------------------------- | -------------------------------------------------- |
| Aim                           | Pointer, or left/right arrows / A and D            |
| Fire                          | Click / tap, or Space                              |
| Exchange loaded and next core | X                                                  |
| Start / dismiss ending        | Enter, Space, or click / tap anywhere on the field |
| Pause / resume                | P or Escape                                        |
| Mute / unmute                 | M                                                  |
| Engine diagnostics            | Backtick                                           |

The core glyphs distinguish charges without relying on color. The next core is
shown separately from the injector's loaded core. Match at least three in a
connected segment; later gap-closing matches multiply the chain score.

## Verification and architecture

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The Simple 2D engine owns frames, input, audio, fitting, asset loading, and debug
overlays. `src/simulation.ts` advances immutable state at 60 ticks per second;
`src/debug.ts` implements the scenario and snapshot surface returned by the
engine. `src/presentation.ts` draws the authored assets and live particle systems.
Tests cover rules, engine stepping, decoding every asset, and all seven screens.

## Asset sources

All art and audio were produced for this game. The committed PNGs, animated
frames, WAVs, MIDI compositions, and four particle systems live in
`public/assets/`. The drawing action logs accompany their sprites. The optional
one-time authoring scripts in `tools/` use `draw`, `draw-sheet`, `particle-2d`,
`sfx-synth`, `sfx-sample` (combat-core), and `music` (synthwave). These development
tools are **not required or invoked by installation or builds**. The production
build simply bundles the committed files.
