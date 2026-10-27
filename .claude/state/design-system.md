# Loopy design system

Source of truth for every frontend task. Code mirror: `client/src/theme/tokens.ts`.
If a task needs a token that isn't here, add it here and in `tokens.ts` before building.

Stack: Expo / React Native + react-native-web. No Tailwind and no shadcn. Styles are
`StyleSheet` objects built from the tokens. Fonts come from `@expo-google-fonts/*` and are loaded in
`client/app/_layout.tsx`.

## Personality

A smart, upbeat TA: bright, chunky and celebratory, but every number and plot is crisp
enough that an engineering student trusts it. Never childish, never clinical.

## Color

Brand color is **Loop Violet**, an electric blue-violet that reads as "signal/scope trace" instead
of Duolingo green or stock iOS/Tailwind blue. Each "pressable" color has a `base` and a darker
`shade`, which is used for the 3D bottom edge.

| Token | Base | Shade (3D edge) | Tint (backgrounds) | Use |
|---|---|---|---|---|
| primary (Loop Violet) | `#5B3DF5` | `#3F24C9` | `#ECE8FF` | Main CTAs, active path nodes, links |
| secondary (Signal Teal) | `#0FB5A4` | `#0A8A7D` | `#DDF7F3` | Secondary emphasis, plot "reference" traces |
| accent (Setpoint Pink) | `#FF5FA2` | `#D63F80` | `#FFE6F1` | Sparing highlight, celebration confetti |
| success | `#25B864` | `#1A8F4C` | `#DFF7E9` | Correct answer, completed |
| error | `#EF4452` | `#BF2734` | `#FDE6E8` | Wrong answer, destructive |
| warning | `#F5A524` | `#C98213` | `#FFF3DA` | Low hearts, cautions |
| streak (orange) | `#FF8A1F` | `#D96A06` | `#FFEEDC` | Streak flame and counter |
| xp (gold) | `#FFC21A` | `#D99E00` | `#FFF6D6` | XP and rewards |
| heart (red) | `#FF4B6E` | `#D62E52` | `#FFE5EB` | Hearts/lives |

Neutral scale ("Ink"), slightly violet-tinted so greys don't look stock-zinc:

| 0 | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| `#FFFFFF` | `#F7F6FB` | `#EFEDF6` | `#E0DDEC` | `#C7C2D9` | `#9D97B4` | `#76708F` | `#5A5472` | `#403B56` | `#2A2640` | `#1A1729` |

Semantic roles: background `ink.50`; surface `ink.0`; border `ink.200`; text `ink.900`;
muted text `ink.600`; subtle text `ink.500`; on-color text `#FFFFFF` (on xp/warning, use `ink.900`).

v1 is light mode only (`userInterfaceStyle: "light"`).

## Typography

- **Nunito** (rounded geometric sans): all UI and prose. Weights 600 / 700 / 800 / 900.
  Friendly, chunky, still very legible.
- **JetBrains Mono** (500 / 700): numbers that matter (answers, gains, ζ, ω, poles), stat
  counters and code-ish values. Tabular figures keep math crisp and credible.

In RN each weight is its own family (`Nunito_800ExtraBold` etc.). Always use the `Text` primitive's
variants rather than setting `fontWeight`.

| Variant | Family | Size / line | Notes |
|---|---|---|---|
| display | Nunito 900 | 34 / 40 | Celebrations, hero numbers |
| title | Nunito 800 | 26 / 32 | Screen titles |
| heading | Nunito 800 | 20 / 26 | Section and card headings |
| body | Nunito 600 | 16 / 24 | Default prose |
| bodyStrong | Nunito 800 | 16 / 24 | Emphasis |
| caption | Nunito 600 | 13 / 18 | Meta, helper text (`ink.600`) |
| label | Nunito 800 | 13 / 16 | Uppercase, letter-spacing 0.8: eyebrows, button-like labels |
| button | Nunito 800 | 16 / 20 | Uppercase, letter-spacing 0.6 |
| mono | JetBrains Mono 500 | 15 / 22 | Inline math/values |
| monoStrong | JetBrains Mono 700 | 15 / 22 | Stat counters |

## Shape language

Rounded and layered: chunky, tactile and toy-like in shape, precise in content.

- Radii: `sm 8`, `md 12`, `lg 16`, `xl 20`, `xxl 28`, `pill 999`. Buttons `lg`, cards `xl`,
  pills and progress bars `pill`.
- **3D press edge** (the signature interaction): pressables have a solid bottom border
  (`borderBottomWidth 4`) in the `shade` of their color. On press, the edge collapses
  (`borderBottomWidth` goes from 4 to 0) and the face moves down 4px (`translateY 4`), so the button
  "clicks down". Disabled: `ink.200` face, `ink.300` edge, `ink.400` label, and no press.
- Cards use the same motif, quieter: 2px `ink.200` border plus 4px `ink.200` bottom edge. No blurry
  drop shadows anywhere. Elevation means solid offset edges, not blur. A single `overlay` shadow
  token exists for modals/sheets only.
- Borders: 2px is the standard stroke weight for borders, dividers and icons.

## Text field

`TextField` (`client/src/components/ui/TextField.tsx`) uses the card vocabulary: label above, 2px `ink` border with a 4px bottom edge, `radii` from the shape scale. Focus turns the edge Loop Violet (`colors.primary`); an error turns it `colors.error` and replaces the hint with the error copy. `secure` adds a Show/Hide toggle. Use it for every free-text input (auth, numeric answers) rather than a bare `TextInput`.

## Spacing

4-pt scale: `xxs 2`, `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`, `xxxl 48`.
Screen padding `lg` (16) on phones. Content column max-width **640**, centered (web/desktop).
Touch targets are at least 44px tall. Buttons: md 48, lg 56.

## Signature motif: the step response

Loopy's mark is an **underdamped step response**: a curve that rises, overshoots, rings, and
settles onto a dashed setpoint line. ("You overshoot a bit, then you settle. That's learning.")

- `StepResponseMark` (SVG) appears in empty states and the loading state. The loading state
  animates the trace drawing on.
- Stroke 3px, round caps, primary color for the response and dashed `ink.300` for the setpoint.
- Plots elsewhere (task figures) use the same vocabulary: primary = system response,
  secondary teal = reference/comparison, dashed ink = setpoint/asymptotes.

## Icons

Small custom SVG glyphs (flame, heart, bolt, alert, etc.) drawn with filled bodies and an
optional 2px stroke, sized 16 / 20 / 24. Every StatPill icon uses its semantic color (streak, heart, xp).
No icon font. Keep glyphs filled and chunky to match the type.

Additional glyphs (same rules): `LockGlyph` (neutral `lockedTone` = ink 300/400), `CrownGlyph` (xp gold),
`TraceGlyph` (a mini step response, single color: the motif as an icon), `LoopBackGlyph` (accent, mistakes),
`TrophyGlyph` (xp), `MedalGlyph` (accent), `ProfileGlyph` (secondary).

## Skill path and tab bar

- **Unit banner**: solid face in the unit's tone with a 4px `shade` bottom edge, `xl` radius, on-color text.
  Units cycle primary → secondary → accent so chapters read as distinct. Crowns earned/total in a `shade` pill.
- **Skill node**: 72px circle, 6px `shade` bottom edge that collapses on press. Face: unit tone (open),
  xp gold (fully crowned), `disabled` ink (locked, with lock glyph). An 6px ring around the node fills with
  lessons-in-level progress. Crown level in an xp-tint pill bottom-right; "Due" in a streak-orange pill top-right.
  Nodes wind in a zig-zag (offsets 0, ±0.75, ±1.15 × 64px); "Start here" bubble above the first untouched open skill.
- **Tab bar**: surface with a 2px `ink.200` top border; labels use `label` type at 11px. Active tab icon sits in a
  48×32 `md`-radius pill filled with its tone's tint and bordered in its base color; inactive glyphs use `lockedTone`.
- **Top stats bar**: streak and hearts `StatPill`s with a caption under each (next-heart countdown), plus a 44px
  daily-goal ring (xp gold arc, turns success green once the goal is met).

## Motion

RN `Animated` only (no Framer). Press feedback is instant (edge collapse). Progress fills ease
over 300ms. Celebrations may bounce (spring); avoid motion on routine navigation.

## Voice in UI states

- Empty: encouraging, specific ("No reviews due. Your loop is stable."), plus a clear next action.
- Error: plain-spoken cause plus retry ("Couldn't reach the server. Check your connection and try
  again.").
- Loading: short, on-theme ("Settling…").
