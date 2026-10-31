# Better 3D: local Modly workflow (2026-10-31)

Status: **written, not merged, not deployed; the Modly step itself has not been run** (it needs Faiz's Windows GPU; nothing here could start it). Everything else was tested with a stand-in model, see "Verified". Branch `feature/game3d-modly-workflow`, off `main` after #203.

## The idea
Turn the Stitch pictures into real 3D models on Faiz's own PC with [Modly](https://github.com/lightningpixel/modly) (open-source desktop app, image to 3D mesh, Windows / Linux / Apple Silicon, extensions for Hunyuan3D 2, TripoSG and Trellis2). The game keeps its shape figures and swaps in a real model one slot at a time, so nothing breaks while models are missing. Slots: `hero`, `oracle`, `partner`, `fountain`, `lamp`, `board`, `perch`.

## Steps (on the Windows PC)
1. **Install Modly** from its Releases page (or clone it and run `launch.bat`). On its Models page choose "Install from GitHub", enter an extension's repo URL, and download a model. Start with a small, fast one (for example the Hunyuan3D 2 Mini/Turbo extension). VRAM needs are listed per model variant in Modly; the Modly wiki does not give an app-wide minimum, so check the number on the model you pick.
2. **Prepare the pictures:** `python scripts/3d/prep_images.py --src "E:/Aladdin/frontend/public/art/New folder"` keys the white out and writes square transparent PNGs to `art-masters/3d/prep/` (gitignored). Needs `pip install pillow numpy scipy`.
3. **Generate:** open Modly, leave it running, then `python scripts/3d/modly_generate.py --modly-dir "C:/path/to/modly" --ids hero,oracle` (add `--dry-run` first to see the commands). It uses Modly's own CLI (`tools/modly-cli/agent.py`: `health`, then `generate --image ... --output ...`) and writes `art-masters/3d/models/<slot>.glb`. If your Modly version words the command differently, run `agent.py --help` and pass flags with `--extra "..."`.
4. **Shrink and register:** `python scripts/3d/optimize_glb.py` (needs Node) makes each model small for the browser (meshopt geometry, WebP textures, at most 1024 px, 1.5 MB budget per model) into `frontend/src/assets/models/<slot>.glb` and regenerates `frontend/src/game3d/models3d.ts`. Commit those, push, and open the PR as usual.
5. **Look at it:** run the frontend, open `/game3d`. A model is scaled to its slot's height, centred and stood on the ground automatically. If it faces the wrong way, set its turn in `MODEL_YAW` (`modelFit.ts`, radians; `Math.PI` turns it round). If a model fails to load, the shape figure stays.

## What to expect
- Generated models are **static meshes**: no skeleton, so no walk cycle. For a walking hero, rig the GLB (Mixamo, humanoid only, free with an Adobe ID; or Meshy/Tripo auto-rig) and add animation playback to `Avatar.tsx` (not built yet).
- AI meshes can be messy (blobby hands and hoods, odd backs). The single Stitch front picture is all Modly's image-to-3D takes; the back and side pictures are prepped (`hero_back`, `hero_side`) only for multi-view models.
- Lighting stays flat and neutral; textures are baked colour. Models carry no facts.

## Licences: check before shipping
- A third-party guide (2026) says the Hunyuan3D 2.1 licence excludes the EU, UK and South Korea, and that TRELLIS.2 is MIT. **Faiz is in Norway: read the actual licence of the model extension before using its output in anything shared.** Not verified here.
- Modly's own licence and each extension's licence were not read. Keep a `CREDITS.md` line per model (open item from the feasibility doc).

## Verified
- `prep_images.py` ran on the six staged Stitch pictures (keyed, cropped, square RGBA). `modly_generate.py --dry-run` prints the right commands and refuses clearly when the CLI or a picture is missing. **Not run against a real Modly.**
- `optimize_glb.py` and the game loader were tested end to end with a stand-in GLB (a deliberately oversized, off-centre cone and box in the lamp slot, then removed): it was compressed by glTF-Transform, registered, loaded by the page in headless Chromium, and fitted to height and ground. `modelFit.test.ts` covers the fitting maths. `tsc`, ESLint and the 3D tests pass.

## Next
After the first real model: set its `MODEL_YAW`, judge the look, then do the rest; then a rigged hero and a walk animation.
