# Food Scan Performance And Accuracy Design

Date: 2026-05-19
Project: `fitness-miniapp`
Scope: Improve the photo-based food recognition flow on `pages/nutrition/nutrition` so first-pass results stay reasonably complete while total wait time and timeout risk are reduced in the WeChat Mini Program environment.

## Goals

Improve the current AI food scan experience so users can:

- get a usable first recognition result faster in most cases
- keep first-pass results focused on the main food composition instead of becoming too shallow
- automatically get a second, more detailed recognition pass only when the first result is too broad or uncertain
- keep any successful first-pass result instead of losing everything when the detailed retry fails
- continue saving recognized foods into today's intake with the existing confirmation flow

## Non-Goals

- No redesign of the nutrition page layout
- No replacement of the current manual add or manual edit flows
- No cloud sync redesign beyond the recognition request path itself
- No promise of perfectly accurate nutrition estimation from images
- No changes to how daily nutrition records are stored after recognition succeeds

## Product Decisions Confirmed

- First-pass recognition should still prioritize completeness over ultra-fast but vague output
- The flow should still be noticeably faster and less timeout-prone than the current implementation
- Complex meals should use an automatic second-pass recognition only when needed
- If the second pass fails, the user should still keep the first successful result
- Manual add remains the fallback when recognition cannot complete

## Current Problem Summary

The current scan flow spends too much of the WeChat timeout budget on request overhead before model inference finishes.

Current sequence:

1. compress image locally
2. read local image as base64
3. upload compressed image to cloud storage
4. call cloud function with `fileID`
5. cloud function downloads the same image again
6. cloud function converts it to base64
7. cloud function calls the external recognition model

This adds avoidable upload and download latency on top of the model request itself. In practice, this makes the current 30-second WeChat timeout easy to hit, especially for mixed meals and retry cases.

## Recommended Approach

Use a two-tier recognition pipeline with direct base64 delivery by default.

### Tier 1: First Pass

The first pass should:

- send the compressed image base64 directly to the cloud function
- skip cloud upload/download round-trips in the normal path
- use a medium-high recognition profile tuned for balanced completeness and speed
- aim to identify main food composition on the first attempt

### Tier 2: Conditional Detailed Pass

Run a second, more detailed recognition pass only when the first pass is likely too broad or incomplete.

The second pass should:

- reuse the already selected image
- use a more detailed recognition profile
- run automatically after a successful but weak first pass
- preserve the first-pass result if the detailed pass fails

This approach keeps everyday single-plate meals fast while still improving mixed meals like lunch boxes, rice bowls, hot pot, spicy mix, or self-serve plates.

## Recognition Transport Design

### Default Request Path

Default path:

1. compress image
2. read compressed file as base64
3. call `foodRecognize` with `imageBase64`
4. do not upload to cloud storage in the normal path

Why:

- removes one upload and one download from the hot path
- reduces time spent before the model call starts
- makes timeout behavior more dependent on actual recognition work rather than transport overhead

### Fallback Transport Path

Only use the existing `fileID` path when the base64 payload still exceeds the safe request budget after compression fallback attempts.

Fallback rules:

- keep the current compression downgrade ladder
- if compressed base64 still exceeds the payload guard, fall back to cloud upload
- use the upload path as an exception path, not the default path

## Recognition Profiles

The cloud function should support explicit recognition profiles instead of inferring all behavior only from `splitMode`.

### Balanced Profile

Used for the first pass.

Characteristics:

- tuned for medium-high completeness
- lower latency than the current heaviest path
- still capable of identifying major meal components
- appropriate for most first scans

Expected behavior:

- for a clear single dish, return one stable result quickly
- for a clear composed meal, return major components when boundaries are visible
- avoid unnecessary over-fragmentation when confidence is low

### Detailed Profile

Used only for the automatic second pass or explicit retry.

Characteristics:

- higher detail request level
- higher token budget than balanced profile
- more aggressive at separating rice, protein, vegetables, sauce, and side items
- higher latency, but reserved for fewer cases

## Auto-Retry Decision Rules

The app should trigger the detailed second pass only after a successful first pass that appears too broad or uncertain.

Trigger when any of these is true:

- only one recognized item is returned and its name matches broad mixed-meal keywords such as `盖饭`, `便当`, `拼盘`, `麻辣烫`, `套餐`, `炒饭`, or similar grouped meal labels
- `lowConfidence` is true
- the result note indicates likely incompleteness
- the result structure is valid but item count is clearly too low for a visually mixed meal
- the model returns an empty or near-empty usable structure after the first pass normalization

Do not trigger when:

- the first pass already returns a clear single dish with acceptable confidence
- the first pass already returns the major meal components the user needs for editing and confirmation

## Result Preservation Rules

The app must distinguish between:

- hard failure before any usable result exists
- soft failure after a usable first-pass result already exists

Rules:

- if the first pass fails, show the existing failure modal and allow retry or manual add
- if the first pass succeeds and the second pass fails, keep the first-pass result on screen
- if the second pass succeeds, replace the first-pass result with the more detailed result
- do not clear a good first-pass result just because the refinement pass fails

This is important for user trust and for avoiding the feeling that the app "recognized something and then lost it."

## Frontend Changes

Primary file:

- `pages/nutrition/nutrition.js`

### Request Flow Changes

Update the recognition flow so that:

- `prepareRecognizeImage` still handles compression and base64 generation
- `runAnalyzeFood` uses direct `imageBase64` transport first
- upload-to-cloud becomes a fallback branch instead of the default branch
- the recognition flow can run a first pass and optional second pass in one user action

### UI State Changes

Add explicit progress states for:

- first-pass recognition in progress
- detailed refinement in progress
- detailed refinement failed but first-pass result preserved

User-facing copy should make the distinction clear, for example:

- `正在识别主要食材...`
- `正在进一步细分食材...`

The user should understand whether the app is still getting the first answer or only improving an answer it already has.

### Retry Behavior

The existing explicit `重新细分` action should remain, but it should now reuse the same detailed profile used by automatic second-pass refinement.

## Cloud Function Changes

Primary file:

- `cloudfunctions/foodRecognize/index.js`

### Input Contract

Support these inputs explicitly:

- `imageBase64`
- `fileID`
- `splitMode`
- `recognizeProfile`
- `imageDetail`

Priority:

1. use `imageBase64` when provided
2. only download from `fileID` when `imageBase64` is absent

### Request Tuning

Define separate parameter presets for:

- balanced profile
- detailed profile

These presets should control:

- prompt emphasis
- temperature
- token budget
- image detail level
- any timeout-sensitive request settings

Implementation guidance:

- balanced should be lighter than the current heavy path
- detailed can stay close to the current most complete behavior
- both profiles must keep JSON-only output constraints

### Failure Contract

Return enough structure for the frontend to distinguish:

- transport failure
- provider timeout
- invalid AI response
- usable first-pass result with failed detailed refinement

The second-pass failure should not force the frontend into the same branch as a total recognition failure.

## Error Handling

### Hard Failures

Examples:

- missing image
- compression failure
- cloud unavailable
- provider timeout before any usable result

Behavior:

- keep current modal-driven fallback pattern
- allow high-quality retry or manual add

### Soft Failures

Examples:

- detailed refinement request times out
- detailed refinement returns invalid structure
- detailed refinement provider call fails after a usable first pass

Behavior:

- preserve the first-pass result
- optionally show a lightweight tip that detailed refinement did not complete
- do not interrupt the user's ability to edit and save the current result

## Data Model Impact

No storage schema changes are required for saved nutrition records.

Existing `todayFoods` save behavior remains unchanged:

- recognized foods are normalized
- user can still adjust portion and values
- final save still writes into the current nutrition record storage keys

## Testing Strategy

Priority manual checks:

1. clear single-dish photo returns a usable result in one pass
2. mixed-meal photo returns a first-pass result and auto-refines when needed
3. if auto-refine fails, the first-pass result remains visible and savable
4. oversized images still fall back safely instead of crashing
5. explicit `重新细分` still works after the pipeline change
6. manual add remains available from all failure states
7. adding recognized foods to today's intake still works without storage regressions

Suggested test image categories:

- single dish such as tomato egg or stir-fried vegetables
- rice bowl or lunch box with visible main components
- mixed plate or spicy mix with ambiguous boundaries
- blurry or partially occluded meal image

Recommended code verification:

- syntax check for touched mini-program JS files
- syntax check for cloud function JS
- manual recognition regression in WeChat DevTools or target runtime

## Risks

- direct base64 transport may still hit payload limits on some images if compression is not conservative enough
- balancing first-pass completeness against latency may need real-device tuning
- auto-refine heuristics that are too aggressive could make simple meals slower than needed
- auto-refine heuristics that are too weak could leave mixed meals too coarse
- preserving first-pass results requires careful state handling to avoid accidental clearing

## Recommended Implementation Order

1. change frontend request flow to prefer direct base64 transport
2. update cloud function input priority and add recognition profiles
3. implement first-pass balanced recognition
4. implement conditional automatic detailed second pass
5. add result-preservation behavior for second-pass failures
6. update loading and status copy for the two-pass flow
7. run manual performance and regression verification

## Success Criteria

The feature is successful when:

- first-pass recognition usually completes faster than the current upload-download-model path
- first-pass results remain good enough for most everyday meals
- complex meals can automatically receive a more detailed breakdown when needed
- second-pass failures do not wipe out a valid first-pass result
- today's intake save flow remains unchanged and stable after recognition
