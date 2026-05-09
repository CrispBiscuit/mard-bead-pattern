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

# Plan

- [x] Create the project directory and tracking plan.
- [x] Add the static HTML/CSS/JS app shell.
- [x] Embed the 221-color MARD palette as JSON.
- [x] Implement browser-side image processing and MARD color matching.
- [x] Implement PNG, CSV, legend, and PDF exports.
- [x] Run local validation and update this checklist.
