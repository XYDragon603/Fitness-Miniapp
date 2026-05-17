# Air Health UI Redesign

Date: 2026-05-14
Project: `fitness-miniapp`
Scope: Redesign the current WeChat Mini Program UI into an `Air Health` visual system with cleaner hierarchy, lighter surfaces, higher perceived quality, and removal of visible `第1/2/3周` switching from the main interface.

## Goals

- Upgrade the app from a basic utility look to a polished health-record product feel
- Create one unified visual language across all core pages
- Improve readability and reduce visual noise without reducing functionality
- Make the product feel more premium before the next MVP feature expansion
- Remove the visible `第1/2/3周` selector from the user-facing main flow

## Non-Goals

- No business-logic expansion in this UI redesign spec
- No automatic week progression logic in this phase
- No full information architecture rewrite
- No redesign of storage model or training-plan schema in this phase
- No animation-heavy or glassmorphism-heavy experiment that would risk usability

## Product Decisions Confirmed

- Visual direction: `Air Health`
- Planning scope: full visual system first, then page-by-page implementation
- Visible `第1/2/3周` selectors should be removed from the main UI for now
- The redesign must preserve usability for the current training, nutrition, history, and stats flows

## Design Direction

`Air Health` is a premium health-tracking visual language inspired by calm, high-trust consumer wellness products.

It should feel:

- lighter
- quieter
- more breathable
- more refined at the edges
- structured without looking mechanical

It should not feel:

- like a gym-poster app
- like a template dashboard
- overly colorful
- shadow-heavy
- visually crowded

## Visual System

### Color

Use a soft layered light theme with restrained accents.

Core palette:

- background: warm mist / soft neutral gray
- surface: clean white with subtle tonal variation
- text primary: deep charcoal-blue, not pure black
- text secondary: cool muted gray
- line / border: very low-contrast neutral line
- accent primary: restrained health red
- accent secondary: dusty blue
- success / completion: muted mint green
- warning / reference note: soft amber

Rules:

- do not use large heavy blocks of saturated red
- use accent red mostly for CTA, active state, and important metrics
- use blue-gray and mint to create calm structure around data
- avoid purple bias

Suggested token direction:

```css
--bg-page: #F5F6F8;
--bg-elevated: #FFFFFF;
--bg-soft: #EEF2F4;
--text-primary: #18222D;
--text-secondary: #5D6A75;
--text-tertiary: #8C98A4;
--line-soft: #E7EBEF;
--accent-primary: #D85A6A;
--accent-primary-soft: rgba(216, 90, 106, 0.10);
--accent-blue: #7F97AD;
--accent-green: #74B89A;
--accent-amber: #D6A15E;
```

### Radius and Shape

Rounded corners are a major part of the premium feel.

Use:

- page cards: large rounded corners
- chips / pills: capsule radius
- input blocks: medium-large radius
- modal sheets: extra-large top radius

Rules:

- corners should feel intentional and consistent
- avoid mixing sharp internal elements with very rounded containers
- avoid tiny radii that make the UI look older

### Elevation

Elevation should be subtle.

Use:

- thin borders first
- soft ambient shadows second
- only one elevation scale system across the app

Rules:

- no dark, dramatic shadows
- no stacking multiple competing shadows
- most cards should feel gently lifted, not floating far above the page

### Typography

Typography should feel clean, quiet, and expensive.

System guidance:

- keep a native-friendly Chinese-capable system stack
- rely on weight, spacing, and size rather than decorative styling
- use larger page titles and softer supporting text

Hierarchy:

- page title: bold, spacious
- section title: clear and calm
- card headline: medium-bold
- metadata: small, quiet, but readable
- helper text: soft and compact

Rules:

- reduce excessive boldness in secondary content
- avoid too many different text sizes in one card
- use consistent spacing between title, body, and meta text

### Motion

Motion should be present but almost invisible.

Allowed:

- fade and rise on page sections
- gentle progress transitions
- modal entrance with soft opacity + translate
- subtle scale on primary tap states

Avoid:

- bouncy motion
- exaggerated spring effects
- decorative movement without purpose

## Global Layout Principles

- Increase whitespace between major sections
- Reduce border noise
- Use grouped content blocks rather than many separate boxes
- Keep one strong primary action per screen
- Let content breathe vertically, especially on mobile

## Page-by-Page Design

### 1. Training Plan Page

Current problems:

- The visible week tab creates visual clutter and steals attention
- Too many competing borders and weighty surfaces
- The page looks more like a list dump than a designed training overview

Redesign:

- Remove the visible `第1/2/3周` selector from the page
- Replace the top area with a calm overview header:
  - title
  - one-line training philosophy / plan subtitle
  - optional soft info badge such as `当前启用计划`
- Turn each training day into a premium overview card:
  - day name
  - target muscle focus
  - exercise count
  - subtle day color cue
  - actions: `查看教学` and `开始训练`

Exercise rows:

- reduce hard separators
- convert metadata to softer inline pills
- notes become quiet advisory blocks, not bright warnings

Result:

- the page feels curated
- the eye lands on the day card first, not on tabs
- week logic stops dominating the interface

### 2. Record Page

This page is the highest-priority page in the redesign.

Current problems:

- high information density without enough hierarchy
- the page feels busy even when all information is useful
- state blocks compete too much visually

Redesign:

- Remove the visible week selector from the interface
- Make the top of the page feel like a focused session header:
  - today
  - selected training day
  - overall progress
- Use a lighter segmented or card-based day selector with more breathing room

Each exercise card should contain:

- exercise name
- compact plan summary
- previous-weight summary
- overload suggestion
- guide action
- set-entry table

Hierarchy rules:

- previous-weight info should look informative, not promotional
- overload suggestion should look advisory and soft
- the set table stays the functional center
- completion state should be elegant, not loud

Rest timer:

- present as a clean floating sheet
- large timer typography
- soft surrounding overlay
- controls clearly separated

Result:

- more premium, less noisy
- easier to scan during real training
- better sense of progression and calm control

### 3. Nutrition Page

Current role:

- this should feel like a trusted daily nutrition log, not only an AI page

Redesign:

- top section becomes a clean daily intake dashboard
- macro cards become lighter, more rounded, more editorial
- AI scan entry becomes a clear action zone, not a crowded tool row
- result confirmation card becomes the main focus when AI returns data

AI result design principles:

- all numbers presented as `估算值`
- confidence warning presented softly but clearly
- portion adjustment should feel safe and editable
- save action must come only after user review

Result:

- the experience feels controlled and trustworthy
- the user understands that AI assists, not decides

### 4. History Page

Redesign:

- treat the training calendar as the visual hero of the training tab
- use soft day markers and calm month navigation
- keep the training record list below as the detailed stream
- reduce the weight of the tab switch itself

Training history cards:

- cleaner layout
- stronger date hierarchy
- lower-contrast supporting stats

Nutrition history:

- keep separate and quieter
- similar card language, but not visually identical to training cards

Result:

- this page feels like a health journal rather than a raw archive

### 5. Stats Page

Redesign direction:

- turn it into a weekly health summary / training insight page
- reduce dashboard heaviness
- make the most important metrics feel more refined and editorial

Use:

- one hero summary block
- cleaner metric cards
- softer progress visuals
- lighter chart containers

Rules:

- no overly bright charts
- no data box overload
- preserve quick comprehension first

## Removal of Visible Week Switching

This redesign explicitly removes visible `第1/2/3周` tabs from:

- training plan page
- training record page

For this phase:

- no visible week tab
- no auto-progression UI
- no additional explanation block unless needed later

If the underlying data still depends on week structure temporarily during implementation, that may remain hidden internally as an implementation detail. The user-facing interface should stop foregrounding it.

## Interaction Rules

- Buttons should feel soft but confident
- Secondary actions should use quiet pills or outline treatments
- Modal close actions should be obvious but not harsh
- Active and completed states should use color plus structure, not color alone

## Accessibility and Usability

- maintain readable contrast in all text
- preserve touch-friendly hit targets
- do not sacrifice clarity for minimalism
- do not hide necessary training information behind too many taps

## Implementation Guidance

This redesign should be implemented in layers:

1. global tokens and common card/button language
2. training plan page
3. record page
4. nutrition page
5. history page
6. stats page

## Risks

- if the redesign becomes too pale, the app may lose action clarity
- if too many decorative layers are added, the result will feel like template UI
- removing visible week tabs without aligning internal logic later may create hidden product inconsistency

## Success Criteria

The redesign is successful when:

- the app feels noticeably more premium and calmer at first glance
- the UI looks more like a health product than a generic training tool
- the pages feel visually related without becoming repetitive
- training and nutrition tasks remain easy to complete
- visible `第1/2/3周` switching no longer dominates the interface
