const state = {
  palette: [],
  paletteLabs: [],
  sourceImage: null,
  sourceFileName: "",
  pattern: null,
  activeView: "grid",
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  setStatus("正在载入 MARD 色卡...");

  try {
    const response = await fetch("./data/mard-palette.json");
    const data = await response.json();
    state.palette = data.colors.map((color, index) => ({
      ...color,
      index,
      rgb: [color.r, color.g, color.b],
    }));
    state.paletteLabs = state.palette.map((color) => rgbToLab(color.r, color.g, color.b));
    els.paletteCount.textContent = `${state.palette.length} 色 MARD`;
    drawSamplePalette();
    setStatus("等待上传图片。");
  } catch (error) {
    console.error(error);
    els.paletteCount.textContent = "色卡载入失败";
    setStatus("色卡载入失败，请确认 data/mard-palette.json 可访问。");
  }

  updateDenoiseLabel();
  updateCutoutLabel();
  updateAdjustmentLabels();
  updateGenerateButton();
  updateDownloadButtons();
}

function bindElements() {
  [
    "paletteCount",
    "imageInput",
    "dropZone",
    "fileMeta",
    "sizePreset",
    "customSizeRow",
    "widthField",
    "widthLabel",
    "customWidth",
    "heightField",
    "heightLabel",
    "customHeight",
    "sizeHint",
    "denoiseMin",
    "denoiseValue",
    "maxColors",
    "ditherMode",
    "cutoutMode",
    "cutoutTolerance",
    "cutoutToleranceValue",
    "brightness",
    "brightnessValue",
    "contrast",
    "contrastValue",
    "saturation",
    "saturationValue",
    "exportCellSize",
    "generateBtn",
    "downloadGrid",
    "downloadCode",
    "downloadLegend",
    "downloadCsv",
    "downloadPdf",
    "statusText",
    "patternStats",
    "colorFilter",
    "gridCanvas",
    "codeCanvas",
    "legendCanvas",
    "sampleCanvas",
    "emptyState",
    "materialsBody",
    "materialTotal",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.imageInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadImageFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dragover");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) loadImageFile(file);
  });

  els.sizePreset.addEventListener("change", () => {
    updateSizeControls();
  });
  els.customWidth.addEventListener("input", () => handleSizeInput("width"));
  els.customHeight.addEventListener("input", () => handleSizeInput("height"));
  els.customWidth.addEventListener("blur", () => finalizeSizeInput("width"));
  els.customHeight.addEventListener("blur", () => finalizeSizeInput("height"));

  document.querySelectorAll("input[name='mode']").forEach((input) => {
    input.addEventListener("change", () => {
      els.denoiseMin.value = input.value === "photo" ? "2" : "0";
      updateDenoiseLabel();
    });
  });

  els.denoiseMin.addEventListener("input", updateDenoiseLabel);
  els.cutoutTolerance.addEventListener("input", updateCutoutLabel);
  [els.brightness, els.contrast, els.saturation].forEach((input) => {
    input.addEventListener("input", updateAdjustmentLabels);
  });
  els.generateBtn.addEventListener("click", generatePattern);
  els.downloadGrid.addEventListener("click", () => downloadCanvas(createExportPatternCanvas(false), "pattern_grid.png"));
  els.downloadCode.addEventListener("click", () => downloadCanvas(createExportPatternCanvas(true), "pattern_code.png"));
  els.downloadLegend.addEventListener("click", () => downloadCanvas(els.legendCanvas, "legend.png"));
  els.downloadCsv.addEventListener("click", downloadMaterialsCsv);
  els.downloadPdf.addEventListener("click", downloadPdf);
  els.colorFilter.addEventListener("change", () => {
    if (state.pattern) {
      renderPattern();
      renderMaterials(state.pattern.materials, state.pattern.beadCount);
    }
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });
}

async function loadImageFile(file) {
  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    setStatus("只支持 PNG/JPG。");
    return;
  }

  try {
    const image = await decodeImage(file);
    state.sourceImage = image;
    state.sourceFileName = file.name;
    state.pattern = null;
    els.fileMeta.textContent = `${file.name} · ${image.naturalWidth}x${image.naturalHeight}`;
    updateAspectDefaults();
    updateSizeControls();
    els.emptyState.hidden = false;
    clearMaterials();
    updateGenerateButton();
    updateDownloadButtons();
    setStatus("图片已载入，可以生成图纸。");
  } catch (error) {
    console.error(error);
    setStatus("图片读取失败，请换一张 PNG/JPG。");
  }
}

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    image.src = url;
  });
}

function getMode() {
  return document.querySelector("input[name='mode']:checked").value;
}

function getSourceRatio() {
  if (!state.sourceImage) return 1;
  return state.sourceImage.naturalWidth / state.sourceImage.naturalHeight || 1;
}

function updateAspectDefaults() {
  if (!state.sourceImage || !["auto-width", "auto-height"].includes(els.sizePreset.value)) return;
  finalizeSizeInput(els.sizePreset.value === "auto-width" ? "width" : "height");
}

function updateSizeControls() {
  const preset = els.sizePreset.value;
  const usesCustomInputs = ["custom", "auto-width", "auto-height"].includes(preset);
  const isAutoWidth = preset === "auto-width";
  const isAutoHeight = preset === "auto-height";
  els.customSizeRow.hidden = !usesCustomInputs;
  els.sizeHint.hidden = !isAutoWidth && !isAutoHeight;
  els.sizeHint.textContent = isAutoWidth
    ? "输入宽度，高度会按原图比例自动计算。"
    : "输入高度，宽度会按原图比例自动计算。";

  els.widthLabel.textContent = isAutoHeight ? "自动宽" : "宽";
  els.heightLabel.textContent = isAutoWidth ? "自动高" : "高";
  setDerivedSizeField(els.customWidth, els.widthField, isAutoHeight);
  setDerivedSizeField(els.customHeight, els.heightField, isAutoWidth);

  if (isAutoWidth) {
    updateLinkedAspectSize("width");
  } else if (isAutoHeight) {
    updateLinkedAspectSize("height");
  }
}

function setDerivedSizeField(input, field, isDerived) {
  input.readOnly = isDerived;
  input.tabIndex = isDerived ? -1 : 0;
  input.setAttribute("aria-readonly", String(isDerived));
  field.classList.toggle("input-derived", isDerived);
}

function handleSizeInput(source) {
  const preset = els.sizePreset.value;
  if ((preset === "auto-width" && source === "width") || (preset === "auto-height" && source === "height")) {
    updateLinkedAspectSize(source);
  }
}

function finalizeSizeInput(source) {
  const preset = els.sizePreset.value;
  if (preset === "custom") {
    const width = source === "height" ? normalizeDimensionInput(els.customWidth, false) : normalizeDimensionInput(els.customWidth, true);
    const height = source === "width" ? normalizeDimensionInput(els.customHeight, false) : normalizeDimensionInput(els.customHeight, true);
    return { width, height };
  }

  if (preset === "auto-width") return updateLinkedAspectSize("width", true);
  if (preset === "auto-height") return updateLinkedAspectSize("height", true);
  return null;
}

function normalizeDimensionInput(input, shouldWrite) {
  const parsed = parseDimensionInput(input, true);
  const value = clamp(Number.isFinite(parsed) ? parsed : 58, 8, 300);
  if (shouldWrite) input.value = String(value);
  return value;
}

function parseDimensionInput(input, shouldClean = false) {
  const rawValue = String(input.value).trim();
  const cleanValue = rawValue.replace(/[^\d]/g, "");
  if (shouldClean && cleanValue !== rawValue) input.value = cleanValue;
  return Number.parseInt(cleanValue, 10);
}

function updateLinkedAspectSize(source, shouldFinalize = false) {
  if (!state.sourceImage) return;
  const preset = els.sizePreset.value;
  if (preset === "auto-width" && source === "width") {
    const parsed = parseDimensionInput(els.customWidth, true);
    if (!Number.isFinite(parsed)) {
      els.customHeight.value = "";
      return null;
    }
    const width = shouldFinalize ? clamp(parsed, 8, 300) : parsed;
    const height = clamp(Math.round(width / getSourceRatio()), 8, 300);
    if (shouldFinalize) els.customWidth.value = String(width);
    els.customHeight.value = String(height);
    return { width: clamp(width, 8, 300), height };
  } else if (preset === "auto-height" && source === "height") {
    const parsed = parseDimensionInput(els.customHeight, true);
    if (!Number.isFinite(parsed)) {
      els.customWidth.value = "";
      return null;
    }
    const height = shouldFinalize ? clamp(parsed, 8, 300) : parsed;
    const width = clamp(Math.round(height * getSourceRatio()), 8, 300);
    if (shouldFinalize) els.customHeight.value = String(height);
    els.customWidth.value = String(width);
    return { width, height: clamp(height, 8, 300) };
  }
  return null;
}

function getRequestedSize() {
  if (els.sizePreset.value !== "custom") {
    if (els.sizePreset.value === "auto-width") {
      return finalizeSizeInput("width") || { width: 58, height: 58 };
    }

    if (els.sizePreset.value === "auto-height") {
      return finalizeSizeInput("height") || { width: 58, height: 58 };
    }

    const [width, height] = els.sizePreset.value.split("x").map(Number);
    return { width, height };
  }

  return finalizeSizeInput("both");
}

function generatePattern() {
  if (!state.sourceImage || !state.palette.length) return;

  const mode = getMode();
  const { width, height } = getRequestedSize();
  const denoiseMin = Number.parseInt(els.denoiseMin.value, 10);
  const maxColors = Number.parseInt(els.maxColors.value, 10);
  const ditherMode = els.ditherMode.value;
  const cutout = getCutoutSettings();

  setStatus("正在生成图纸...");

  window.setTimeout(() => {
    try {
      const imageData = applyAutoCutout(
        adjustImageData(renderSourceToImageData(state.sourceImage, width, height, mode), getAdjustments()),
        cutout,
      );
      const pixels = mode === "photo" ? quantizeImageData(imageData, maxColors) : imageDataToRgbPixels(imageData);
      const allowedPalette = mode === "photo" && ditherMode === "floyd" ? buildAllowedPaletteIndices(pixels) : null;
      let cells = allowedPalette ? mapPixelsToPaletteWithDither(pixels, width, height, allowedPalette) : mapPixelsToPalette(pixels);

      if (denoiseMin > 0) {
        cells = denoiseCells(cells, width, height, denoiseMin);
      }

      const beadCount = countBeads(cells);
      const materials = buildMaterials(cells, beadCount);
      state.pattern = { width, height, cells, materials, beadCount, mode, denoiseMin, ditherMode, cutout };

      renderPattern();
      renderMaterials(materials, beadCount);
      els.emptyState.hidden = true;
      const blankCount = width * height - beadCount;
      els.patternStats.textContent = `${width}x${height} · ${beadCount} 颗 · ${materials.length} 色${blankCount ? ` · 空 ${blankCount} 格` : ""}`;
      updateDownloadButtons();
      setStatus(`已生成 ${width}x${height} 图纸。`);
    } catch (error) {
      console.error(error);
      setStatus("生成失败，请降低尺寸或换一张图片。");
    }
  }, 20);
}

function renderSourceToImageData(image, width, height, mode) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = mode !== "pixel";
  ctx.imageSmoothingQuality = "high";

  if (mode === "photo") {
    const targetRatio = width / height;
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  } else {
    ctx.drawImage(image, 0, 0, width, height);
  }

  return ctx.getImageData(0, 0, width, height);
}

function getAdjustments() {
  return {
    brightness: Number.parseInt(els.brightness.value, 10) || 0,
    contrast: Number.parseInt(els.contrast.value, 10) || 0,
    saturation: Number.parseInt(els.saturation.value, 10) || 0,
  };
}

function getCutoutSettings() {
  return {
    mode: els.cutoutMode.value,
    tolerance: Number.parseInt(els.cutoutTolerance.value, 10) || 34,
  };
}

function applyAutoCutout(imageData, cutout) {
  if (cutout.mode !== "corner") return imageData;

  const { width, height, data } = imageData;
  const tolerance = cutout.tolerance;
  const visited = new Uint8Array(width * height);
  const seeds = [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1,
  ].filter((index, position, arr) => index >= 0 && index < width * height && arr.indexOf(index) === position);
  const backgrounds = seeds.map((index) => rgbaAt(data, index));
  const queue = [...seeds];
  let cursor = 0;

  seeds.forEach((index) => {
    visited[index] = 1;
  });

  while (cursor < queue.length) {
    const index = queue[cursor];
    cursor += 1;
    const color = rgbaAt(data, index);
    if (!backgrounds.some((background) => colorDistance(color, background) <= tolerance)) continue;

    data[index * 4 + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];

    neighbors.forEach((neighbor) => {
      if (neighbor >= 0 && !visited[neighbor]) {
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    });
  }

  return imageData;
}

function rgbaAt(data, index) {
  const offset = index * 4;
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function adjustImageData(imageData, adjustments) {
  const { brightness, contrast, saturation } = adjustments;
  if (brightness === 0 && contrast === 0 && saturation === 0) return imageData;

  const data = imageData.data;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const saturationFactor = 1 + saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = contrastFactor * (data[i] - 128) + 128 + brightness;
    let g = contrastFactor * (data[i + 1] - 128) + 128 + brightness;
    let b = contrastFactor * (data[i + 2] - 128) + 128 + brightness;
    const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = grey + (r - grey) * saturationFactor;
    g = grey + (g - grey) * saturationFactor;
    b = grey + (b - grey) * saturationFactor;
    data[i] = clamp(Math.round(r), 0, 255);
    data[i + 1] = clamp(Math.round(g), 0, 255);
    data[i + 2] = clamp(Math.round(b), 0, 255);
  }

  return imageData;
}

function imageDataToRgbPixels(imageData) {
  const pixels = new Array(imageData.width * imageData.height);
  const data = imageData.data;

  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    pixels[j] = data[i + 3] < 32 ? null : compositeOnWhite(data[i], data[i + 1], data[i + 2], data[i + 3]);
  }

  return pixels;
}

function quantizeImageData(imageData, maxColors) {
  const pixels = imageDataToRgbPixels(imageData);
  const colorCount = clamp(maxColors, 8, 96);
  const centers = initializeCenters(pixels, colorCount);

  if (centers.length <= 1) return pixels;

  const assignments = new Int32Array(pixels.length);

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    let changed = 0;
    let activeCount = 0;

    for (let i = 0; i < pixels.length; i += 1) {
      if (!pixels[i]) {
        assignments[i] = -1;
        continue;
      }
      const next = nearestRgbCenter(pixels[i], centers);
      if (assignments[i] !== next) changed += 1;
      activeCount += 1;
      assignments[i] = next;
      sums[next][0] += pixels[i][0];
      sums[next][1] += pixels[i][1];
      sums[next][2] += pixels[i][2];
      sums[next][3] += 1;
    }

    sums.forEach((sum, index) => {
      if (sum[3] > 0) {
        centers[index] = [
          Math.round(sum[0] / sum[3]),
          Math.round(sum[1] / sum[3]),
          Math.round(sum[2] / sum[3]),
        ];
      }
    });

    if (!activeCount || changed / activeCount < 0.01) break;
  }

  return pixels.map((pixel, index) => (pixel ? centers[assignments[index]] : null));
}

function initializeCenters(pixels, maxColors) {
  const unique = new Map();
  pixels.forEach((pixel) => {
    if (!pixel) return;
    unique.set(pixel.join(","), pixel);
  });

  const colors = Array.from(unique.values());
  if (colors.length <= maxColors) return colors;

  colors.sort((a, b) => luminance(a) - luminance(b));
  const centers = [];

  for (let i = 0; i < maxColors; i += 1) {
    const index = Math.round((i * (colors.length - 1)) / (maxColors - 1));
    centers.push([...colors[index]]);
  }

  return centers;
}

function nearestRgbCenter(pixel, centers) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < centers.length; i += 1) {
    const center = centers[i];
    const dr = pixel[0] - center[0];
    const dg = pixel[1] - center[1];
    const db = pixel[2] - center[2];
    const distance = dr * dr + dg * dg + db * db;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function mapPixelsToPalette(pixels) {
  const cache = new Map();
  const cells = new Int32Array(pixels.length);

  for (let i = 0; i < pixels.length; i += 1) {
    if (!pixels[i]) {
      cells[i] = -1;
      continue;
    }
    const key = pixels[i].join(",");
    let paletteIndex = cache.get(key);

    if (paletteIndex === undefined) {
      paletteIndex = nearestPaletteIndex(pixels[i]);
      cache.set(key, paletteIndex);
    }

    cells[i] = paletteIndex;
  }

  return cells;
}

function buildAllowedPaletteIndices(pixels) {
  const allowed = new Set();
  pixels.forEach((pixel) => {
    if (!pixel) return;
    allowed.add(nearestPaletteIndex(pixel));
  });
  return Array.from(allowed);
}

function mapPixelsToPaletteWithDither(pixels, width, height, allowedIndices) {
  const work = pixels.map((pixel) => [pixel[0], pixel[1], pixel[2]]);
  const cells = new Int32Array(pixels.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!work[index]) {
        cells[index] = -1;
        continue;
      }
      const oldPixel = work[index].map((value) => clamp(Math.round(value), 0, 255));
      const paletteIndex = nearestPaletteIndex(oldPixel, allowedIndices);
      const color = state.palette[paletteIndex].rgb;
      cells[index] = paletteIndex;
      const error = [
        oldPixel[0] - color[0],
        oldPixel[1] - color[1],
        oldPixel[2] - color[2],
      ];

      distributeDitherError(work, width, height, x + 1, y, error, 7 / 16);
      distributeDitherError(work, width, height, x - 1, y + 1, error, 3 / 16);
      distributeDitherError(work, width, height, x, y + 1, error, 5 / 16);
      distributeDitherError(work, width, height, x + 1, y + 1, error, 1 / 16);
    }
  }

  return cells;
}

function distributeDitherError(work, width, height, x, y, error, factor) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const index = y * width + x;
  if (!work[index]) return;
  work[index][0] += error[0] * factor;
  work[index][1] += error[1] * factor;
  work[index][2] += error[2] * factor;
}

function nearestPaletteIndex(rgb, candidateIndices = null) {
  const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
  const candidateCount = candidateIndices ? candidateIndices.length : state.paletteLabs.length;
  let bestIndex = candidateIndices ? candidateIndices[0] ?? 0 : 0;
  let bestDistance = Infinity;

  for (let i = 0; i < candidateCount; i += 1) {
    const candidateIndex = candidateIndices ? candidateIndices[i] : i;
    const target = state.paletteLabs[candidateIndex];
    const dl = lab[0] - target[0];
    const da = lab[1] - target[1];
    const db = lab[2] - target[2];
    const distance = dl * dl + da * da + db * db;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = candidateIndex;
    }
  }

  return bestIndex;
}

function denoiseCells(cells, width, height, minSize) {
  let next = new Int32Array(cells);

  for (let pass = 0; pass < 2; pass += 1) {
    const visited = new Uint8Array(next.length);
    const output = new Int32Array(next);

    for (let start = 0; start < next.length; start += 1) {
      if (visited[start]) continue;
      if (next[start] < 0) {
        visited[start] = 1;
        continue;
      }

      const color = next[start];
      const component = [];
      const stack = [start];
      visited[start] = 1;
      const neighborCounts = new Map();

      while (stack.length) {
        const index = stack.pop();
        component.push(index);
        const x = index % width;
        const y = Math.floor(index / width);
        const neighbors = [
          x > 0 ? index - 1 : -1,
          x < width - 1 ? index + 1 : -1,
          y > 0 ? index - width : -1,
          y < height - 1 ? index + width : -1,
        ];

        neighbors.forEach((neighbor) => {
          if (neighbor < 0) return;
          if (next[neighbor] === color && !visited[neighbor]) {
            visited[neighbor] = 1;
            stack.push(neighbor);
          } else if (next[neighbor] !== color) {
            neighborCounts.set(next[neighbor], (neighborCounts.get(next[neighbor]) || 0) + 1);
          }
        });
      }

      if (component.length <= minSize && neighborCounts.size > 0) {
        const replacement = chooseReplacementColor(color, neighborCounts);
        component.forEach((index) => {
          output[index] = replacement;
        });
      }
    }

    next = output;
  }

  return next;
}

function chooseReplacementColor(sourceColor, neighborCounts) {
  let bestColor = sourceColor;
  let bestCount = -1;
  let bestDistance = Infinity;
  const sourceLab = state.paletteLabs[sourceColor];

  neighborCounts.forEach((count, color) => {
    const targetLab = color >= 0 ? state.paletteLabs[color] : null;
    const distance = targetLab ? ((sourceLab[0] - targetLab[0]) ** 2 + (sourceLab[1] - targetLab[1]) ** 2 + (sourceLab[2] - targetLab[2]) ** 2) : Number.MAX_SAFE_INTEGER;

    if (count > bestCount || (count === bestCount && distance < bestDistance)) {
      bestColor = color;
      bestCount = count;
      bestDistance = distance;
    }
  });

  return bestColor;
}

function buildMaterials(cells, total) {
  const counts = new Map();

  cells.forEach((index) => {
    if (index < 0) return;
    counts.set(index, (counts.get(index) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([index, count]) => ({
      ...state.palette[index],
      count,
      percent: total ? count / total : 0,
    }))
    .sort((a, b) => naturalCodeSort(a.code, b.code));
}

function countBeads(cells) {
  let total = 0;
  cells.forEach((index) => {
    if (index >= 0) total += 1;
  });
  return total;
}

function updateColorFilterOptions(materials) {
  const current = els.colorFilter.value;
  els.colorFilter.innerHTML = '<option value="all">全部颜色</option>';

  materials.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.index);
    option.textContent = `${item.code} · ${item.count}颗`;
    els.colorFilter.appendChild(option);
  });

  const stillAvailable = current === "all" || materials.some((item) => String(item.index) === current);
  els.colorFilter.value = stillAvailable ? current : "all";
  els.colorFilter.disabled = false;
}

function getColorFilterIndex() {
  if (!els.colorFilter || els.colorFilter.value === "all") return null;
  const index = Number.parseInt(els.colorFilter.value, 10);
  return Number.isFinite(index) ? index : null;
}

function getColorFilterLabel() {
  const index = getColorFilterIndex();
  return index === null ? "" : `_${state.palette[index].code}`;
}

function renderPattern() {
  const { width, height, cells, materials } = state.pattern;
  updateColorFilterOptions(materials);
  const filterIndex = getColorFilterIndex();
  drawPatternCanvas(els.gridCanvas, width, height, cells, { labels: false, filterIndex });
  drawPatternCanvas(els.codeCanvas, width, height, cells, { labels: true, filterIndex });
  drawLegendCanvas(els.legendCanvas, materials);
  setActiveView(state.activeView);
}

function drawPatternCanvas(canvas, width, height, cells, options = {}) {
  const startX = options.startX || 0;
  const startY = options.startY || 0;
  const viewWidth = options.viewWidth || width;
  const viewHeight = options.viewHeight || height;
  const maxDimension = options.labels ? 1900 : 1400;
  const minCell = options.labels ? 20 : 10;
  const maxCell = options.labels ? 34 : 28;
  const cellSize = options.cellSize || clamp(Math.floor(maxDimension / Math.max(viewWidth, viewHeight)), minCell, maxCell);
  const labelBand = options.coordinates ? 34 : 0;
  const offsetX = labelBand;
  const offsetY = labelBand;

  canvas.width = viewWidth * cellSize + offsetX + 1;
  canvas.height = viewHeight * cellSize + offsetY + 1;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (options.coordinates) {
    drawCoordinateLabels(ctx, startX, startY, viewWidth, viewHeight, cellSize, offsetX, offsetY);
  }

  for (let y = 0; y < viewHeight; y += 1) {
    for (let x = 0; x < viewWidth; x += 1) {
      const colorIndex = cells[(startY + y) * width + startX + x];
      if (colorIndex < 0) continue;
      const isVisible = options.filterIndex === null || options.filterIndex === undefined || colorIndex === options.filterIndex;
      if (!isVisible) continue;
      const color = state.palette[colorIndex];
      ctx.fillStyle = color.hex;
      ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);

      if (options.labels) {
        ctx.fillStyle = luminance(color.rgb) > 150 ? "#151515" : "#ffffff";
        ctx.font = `700 ${Math.max(8, Math.floor(cellSize * 0.38))}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(color.code, offsetX + x * cellSize + cellSize / 2, offsetY + y * cellSize + cellSize / 2);
      }
    }
  }

  drawGridLines(ctx, viewWidth, viewHeight, cellSize, offsetX, offsetY);
}

function drawCoordinateLabels(ctx, startX, startY, width, height, cellSize, offsetX, offsetY) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, offsetX, offsetY);
  ctx.fillStyle = "#4f5d56";
  ctx.font = "700 10px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let x = 0; x < width; x += 1) {
    const label = startX + x + 1;
    if (label === 1 || label % 5 === 0 || x === width - 1) {
      ctx.fillText(String(label), offsetX + x * cellSize + cellSize / 2, offsetY / 2);
    }
  }

  for (let y = 0; y < height; y += 1) {
    const label = startY + y + 1;
    if (label === 1 || label % 5 === 0 || y === height - 1) {
      ctx.fillText(String(label), offsetX / 2, offsetY + y * cellSize + cellSize / 2);
    }
  }
}

function drawGridLines(ctx, width, height, cellSize, offsetX = 0, offsetY = 0) {
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 1) {
    ctx.strokeStyle = x % 10 === 0 ? "rgba(0,0,0,0.42)" : x % 5 === 0 ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(offsetX + x * cellSize + 0.5, offsetY);
    ctx.lineTo(offsetX + x * cellSize + 0.5, offsetY + height * cellSize);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 1) {
    ctx.strokeStyle = y % 10 === 0 ? "rgba(0,0,0,0.42)" : y % 5 === 0 ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + y * cellSize + 0.5);
    ctx.lineTo(offsetX + width * cellSize, offsetY + y * cellSize + 0.5);
    ctx.stroke();
  }
}

function drawLegendCanvas(canvas, materials) {
  const columns = materials.length > 28 ? 4 : materials.length > 14 ? 3 : 2;
  const itemWidth = 210;
  const itemHeight = 36;
  const padding = 24;
  const rows = Math.max(1, Math.ceil(materials.length / columns));
  canvas.width = columns * itemWidth + padding * 2;
  canvas.height = rows * itemHeight + padding * 2 + 36;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#18211d";
  ctx.font = "800 22px Arial, sans-serif";
  ctx.fillText("MARD 色号图例", padding, 34);

  materials.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + col * itemWidth;
    const y = padding + 38 + row * itemHeight;

    ctx.fillStyle = item.hex;
    ctx.fillRect(x, y + 5, 28, 22);
    ctx.strokeStyle = "rgba(0,0,0,0.24)";
    ctx.strokeRect(x, y + 5, 28, 22);
    ctx.fillStyle = "#18211d";
    ctx.font = "700 14px Arial, sans-serif";
    ctx.fillText(item.code, x + 38, y + 16);
    ctx.font = "12px Arial, sans-serif";
    ctx.fillStyle = "#607068";
    ctx.fillText(`${item.hex} · ${item.count} 颗`, x + 82, y + 16);
  });
}

function renderMaterials(materials, total) {
  els.materialsBody.innerHTML = "";
  els.materialTotal.textContent = `${total} 颗`;

  materials.forEach((item) => {
    const row = document.createElement("tr");
    row.classList.toggle("filtered-row", String(item.index) === els.colorFilter.value);
    row.innerHTML = `
      <td><button class="material-filter-btn" type="button" data-color-index="${item.index}">${escapeHtml(item.code)}</button></td>
      <td><span class="swatch" style="background:${item.hex}"></span></td>
      <td>${escapeHtml(item.hex)}</td>
      <td>${item.count}</td>
    `;
    els.materialsBody.appendChild(row);
  });

  els.materialsBody.querySelectorAll(".material-filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      els.colorFilter.value = button.dataset.colorIndex;
      renderPattern();
      renderMaterials(state.pattern.materials, state.pattern.beadCount);
      setActiveView("grid");
    });
  });
}

function clearMaterials() {
  els.materialsBody.innerHTML = `<tr><td colspan="4">暂无材料数据</td></tr>`;
  els.materialTotal.textContent = "0 颗";
  els.patternStats.textContent = "未生成";
  els.colorFilter.innerHTML = '<option value="all">全部颜色</option>';
  els.colorFilter.disabled = true;
}

function setActiveView(view) {
  state.activeView = view;
  els.gridCanvas.hidden = view !== "grid";
  els.codeCanvas.hidden = view !== "code";
  els.legendCanvas.hidden = view !== "legend";

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

function getExportCellSize(width = state.pattern?.width || 58, height = state.pattern?.height || 58) {
  const requested = Number.parseInt(els.exportCellSize.value, 10) || 32;
  const maxCanvasDimension = 12000;
  const maxSafeCell = Math.max(8, Math.floor((maxCanvasDimension - 34) / Math.max(width, height)));
  return Math.min(requested, maxSafeCell);
}

function createExportPatternCanvas(labels, overrides = {}) {
  if (!state.pattern) return document.createElement("canvas");
  const canvas = document.createElement("canvas");
  const viewWidth = overrides.viewWidth || state.pattern.width;
  const viewHeight = overrides.viewHeight || state.pattern.height;
  drawPatternCanvas(canvas, state.pattern.width, state.pattern.height, state.pattern.cells, {
    labels,
    cellSize: getExportCellSize(viewWidth, viewHeight),
    coordinates: true,
    filterIndex: getColorFilterIndex(),
    ...overrides,
  });
  return canvas;
}

function withFilterFilename(filename) {
  const suffix = getColorFilterLabel();
  return suffix ? filename.replace(/(\.[^.]+)$/, `${suffix}$1`) : filename;
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement("a");
  link.download = withFilterFilename(filename);
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function downloadMaterialsCsv() {
  if (!state.pattern) return;

  const lines = ["code,name,hex,count,percent"];
  state.pattern.materials.forEach((item) => {
    lines.push([
      item.code,
      item.name,
      item.hex,
      item.count,
      (item.percent * 100).toFixed(2),
    ].map(csvCell).join(","));
  });

  const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = "materials.csv";
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadPdf() {
  if (!state.pattern) return;

  const jsPdfNamespace = window.jspdf;
  if (!jsPdfNamespace?.jsPDF) {
    setStatus("PDF 组件未载入，PNG 和 CSV 仍可下载。");
    return;
  }

  const { jsPDF } = jsPdfNamespace;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const filterIndex = getColorFilterIndex();
  const filterText = filterIndex === null ? "" : ` · Only ${state.palette[filterIndex].code}`;
  const title = `MARD bead pattern · ${state.pattern.width}x${state.pattern.height}${filterText}`;

  addCanvasPage(doc, title, createExportPatternCanvas(false, { cellSize: Math.max(18, Math.round(getExportCellSize(state.pattern.width, state.pattern.height) * 0.7)) }), true);
  doc.addPage("a4", "landscape");
  addCanvasPage(doc, "MARD code overview", createExportPatternCanvas(true), false);
  addBoardPatternPages(doc);
  doc.addPage("a4", "landscape");
  addCanvasPage(doc, "MARD legend", els.legendCanvas, false);
  addMaterialsPages(doc);
  doc.save(withFilterFilename("pattern.pdf"));
}

function addCanvasPage(doc, title, canvas, includeMeta) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;
  const titleHeight = includeMeta ? 56 : 36;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2 - titleHeight;
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  const imageWidth = canvas.width * scale;
  const imageHeight = canvas.height * scale;
  const x = (pageWidth - imageWidth) / 2;
  const y = margin + titleHeight;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, margin);

  if (includeMeta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const filterIndex = getColorFilterIndex();
    const filterInfo = filterIndex === null ? "All colors" : `Only ${state.palette[filterIndex].code}`;
    doc.text(`Mode: ${state.pattern.mode}  Colors: ${state.pattern.materials.length}  Filter: ${filterInfo}  Source: ${state.sourceFileName}`, margin, margin + 20);
  }

  doc.addImage(canvas.toDataURL("image/png"), "PNG", x, y, imageWidth, imageHeight);
}

function addBoardPatternPages(doc) {
  const boardSize = 29;
  const columns = Math.ceil(state.pattern.width / boardSize);
  const rows = Math.ceil(state.pattern.height / boardSize);

  for (let by = 0; by < rows; by += 1) {
    for (let bx = 0; bx < columns; bx += 1) {
      const startX = bx * boardSize;
      const startY = by * boardSize;
      const viewWidth = Math.min(boardSize, state.pattern.width - startX);
      const viewHeight = Math.min(boardSize, state.pattern.height - startY);
      const boardCanvas = createExportPatternCanvas(true, {
        startX,
        startY,
        viewWidth,
        viewHeight,
        cellSize: Math.max(24, getExportCellSize(viewWidth, viewHeight)),
      });
      doc.addPage("a4", "landscape");
      addCanvasPage(doc, `Board ${by + 1}-${bx + 1} · rows ${startY + 1}-${startY + viewHeight} · cols ${startX + 1}-${startX + viewWidth}`, boardCanvas, false);
    }
  }
}

function addMaterialsPages(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 34;
  const rowHeight = 18;
  const rowsPerPage = Math.floor((pageHeight - margin * 2 - 34) / rowHeight);
  let row = 0;

  state.pattern.materials.forEach((item, index) => {
    if (index % rowsPerPage === 0) {
      doc.addPage("a4", "landscape");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Materials", margin, margin);
      doc.setFontSize(10);
      doc.text("Code", margin, margin + 26);
      doc.text("HEX", margin + 120, margin + 26);
      doc.text("Count", pageWidth - margin - 80, margin + 26);
      row = 0;
    }

    const y = margin + 44 + row * rowHeight;
    doc.setFillColor(item.r, item.g, item.b);
    doc.rect(margin, y - 10, 20, 12, "F");
    doc.setDrawColor(160);
    doc.rect(margin, y - 10, 20, 12);
    doc.setTextColor(24, 33, 29);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(item.code, margin + 30, y);
    doc.text(item.hex, margin + 120, y);
    doc.text(String(item.count), pageWidth - margin - 80, y);
    row += 1;
  });
}

function drawSamplePalette() {
  const canvas = els.sampleCanvas;
  const cols = 16;
  const rows = 8;
  const cell = 22;
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d");

  state.palette.slice(0, cols * rows).forEach((color, index) => {
    const x = (index % cols) * cell;
    const y = Math.floor(index / cols) * cell;
    ctx.fillStyle = color.hex;
    ctx.fillRect(x, y, cell, cell);
  });

  ctx.strokeStyle = "rgba(0,0,0,0.16)";
  for (let x = 0; x <= cols; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, rows * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(cols * cell, y * cell + 0.5);
    ctx.stroke();
  }
}

function updateGenerateButton() {
  els.generateBtn.disabled = !state.sourceImage || !state.palette.length;
}

function updateDownloadButtons() {
  const hasPattern = Boolean(state.pattern);
  [els.downloadGrid, els.downloadCode, els.downloadLegend, els.downloadCsv].forEach((button) => {
    button.disabled = !hasPattern;
  });
  els.downloadPdf.disabled = !hasPattern || !window.jspdf?.jsPDF;
}

function updateDenoiseLabel() {
  const value = Number.parseInt(els.denoiseMin.value, 10);
  els.denoiseValue.textContent = value === 0 ? "关闭" : `≤${value}格`;
}

function updateCutoutLabel() {
  els.cutoutToleranceValue.textContent = els.cutoutTolerance.value;
}

function updateAdjustmentLabels() {
  els.brightnessValue.textContent = els.brightness.value;
  els.contrastValue.textContent = els.contrast.value;
  els.saturationValue.textContent = els.saturation.value;
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function compositeOnWhite(r, g, b, a) {
  if (a >= 250) return [r, g, b];
  const alpha = a / 255;
  return [
    Math.round(r * alpha + 255 * (1 - alpha)),
    Math.round(g * alpha + 255 * (1 - alpha)),
    Math.round(b * alpha + 255 * (1 - alpha)),
  ];
}

function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b);
  const xn = 95.047;
  const yn = 100.0;
  const zn = 108.883;
  const fx = labPivot(x / xn);
  const fy = labPivot(y / yn);
  const fz = labPivot(z / zn);
  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ];
}

function rgbToXyz(r, g, b) {
  const rl = srgbToLinear(r / 255);
  const gl = srgbToLinear(g / 255);
  const bl = srgbToLinear(b / 255);
  return [
    (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) * 100,
    (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) * 100,
    (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) * 100,
  ];
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function labPivot(value) {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

function luminance(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function naturalCodeSort(a, b) {
  const ma = /^([A-Z]+)(\d+)$/.exec(a);
  const mb = /^([A-Z]+)(\d+)$/.exec(b);
  if (!ma || !mb) return a.localeCompare(b);
  if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
  return Number(ma[2]) - Number(mb[2]);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
