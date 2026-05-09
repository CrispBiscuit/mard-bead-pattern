# Goal

Build a maintenance-light GitHub Pages tool that converts PNG/JPG images into MARD bead patterns directly in the browser.

# Done When

- [x] The static site exists in `D:\Github\mard-bead-pattern`.
- [x] Users can upload PNG/JPG files and generate MARD bead patterns at preset or custom sizes.
- [x] Pixel-art mode preserves hard edges with nearest-neighbor resizing.
- [x] Photo mode crops, downsamples, quantizes, maps to MARD colors, and denoises small isolated color blocks.
- [x] The tool exports `pattern_grid.png`, `pattern_code.png`, `materials.csv`, `legend.png`, and `pattern.pdf`.
- [x] `data/mard-palette.json` contains 221 unique MARD color entries.
- [x] Local verification covers a pixel-art sample, a photo-like sample, palette validation, and responsive layout.
- [x] The layout is verified for iPad mini 6 portrait and landscape CSS viewports.
- [x] Exported PNG/PDF patterns stay readable for larger bead grids.
- [x] Photo mode includes the most useful lightweight controls found in comparable bead-pattern tools.
- [x] Users can isolate one MARD color in the preview and exports.
- [x] Users can generate non-square patterns by preserving the source image aspect ratio from a target width or height.
- [x] Users can remove simple/solid image backgrounds into blank bead cells before color mapping.
- [x] Aspect-ratio size inputs do not rewrite user keyboard input while typing.

# Plan

- [x] Create the project directory and tracking plan.
- [x] Add the static HTML/CSS/JS app shell.
- [x] Embed the 221-color MARD palette as JSON.
- [x] Implement browser-side image processing and MARD color matching.
- [x] Implement PNG, CSV, legend, and PDF exports.
- [x] Run local validation and update this checklist.
- [x] Add high-resolution export cell-size controls for grid/code PNG output.
- [x] Add multi-board, readable PDF pages for large patterns.
- [x] Add photo adjustment and optional dithering controls.
- [x] Add a same-color filter from the preview toolbar and materials table.
- [x] Re-run browser verification and push the update.
- [x] Add aspect-ratio size presets and validation.
- [x] Re-run browser verification and push the aspect-ratio update.
- [x] Add browser-side corner flood-fill background cutout controls.
- [x] Support blank cells in rendering, filtering, material counts, and exports.
- [x] Re-run browser verification and push the cutout update.
- [x] Fix aspect-ratio size input keyboard handling.
- [x] Re-run local browser verification and push the input fix.
