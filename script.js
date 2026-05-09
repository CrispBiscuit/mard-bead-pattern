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
    "customWidth",
    "customHeight",
    "denoiseMin",
    "denoiseValue",
    "maxColors",
    "generateBtn",
    "downloadGrid",
    "downloadCode",
    "downloadLegend",
    "downloadCsv",
    "downloadPdf",
    "statusText",
    "patternStats",
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
    els.customSizeRow.hidden = els.sizePreset.value !== "custom";
  });

  document.querySelectorAll("input[name='mode']").forEach((input) => {
    input.addEventListener("change", () => {
      els.denoiseMin.value = input.value === "photo" ? "2" : "0";
      updateDenoiseLabel();
    });
  });

  els.denoiseMin.addEventListener("input", updateDenoiseLabel);
  els.generateBtn.addEventListener("click", generatePattern);
  els.downloadGrid.addEventListener("click", () => downloadCanvas(els.gridCanvas, "pattern_grid.png"));
  els.downloadCode.addEventListener("click", () => downloadCanvas(els.codeCanvas, "pattern_code.png"));
  els.downloadLegend.addEventListener("click", () => downloadCanvas(els.legendCanvas, "legend.png"));
  els.downloadCsv.addEventListener("click", downloadMaterialsCsv);
  els.downloadPdf.addEventListener("click", downloadPdf);

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

function getRequestedSize() {
  if (els.sizePreset.value !== "custom") {
    const [width, height] = els.sizePreset.value.split("x").map(Number);
    return { width, height };
  }

  const width = clamp(Number.parseInt(els.customWidth.value, 10) || 58, 8, 160);
  const height = clamp(Number.parseInt(els.customHeight.value, 10) || 58, 8, 160);
  els.customWidth.value = String(width);
  els.customHeight.value = String(height);
  return { width, height };
}

function generatePattern() {
  if (!state.sourceImage || !state.palette.length) return;

  const mode = getMode();
  const { width, height } = getRequestedSize();
  const denoiseMin = Number.parseInt(els.denoiseMin.value, 10);
  const maxColors = Number.parseInt(els.maxColors.value, 10);

  setStatus("正在生成图纸...");

  window.setTimeout(() => {
    try {
      const imageData = renderSourceToImageData(state.sourceImage, width, height, mode);
      const pixels = mode === "photo" ? quantizeImageData(imageData, maxColors) : imageDataToRgbPixels(imageData);
      let cells = mapPixelsToPalette(pixels);

      if (denoiseMin > 0) {
        cells = denoiseCells(cells, width, height, denoiseMin);
      }

      const materials = buildMaterials(cells, width * height);
      state.pattern = { width, height, cells, materials, mode, denoiseMin };

      renderPattern();
      renderMaterials(materials, width * height);
      els.emptyState.hidden = true;
      els.patternStats.textContent = `${width}x${height} · ${width * height} 颗 · ${materials.length} 色`;
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

function imageDataToRgbPixels(imageData) {
  const pixels = new Array(imageData.width * imageData.height);
  const data = imageData.data;

  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    pixels[j] = compositeOnWhite(data[i], data[i + 1], data[i + 2], data[i + 3]);
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

    for (let i = 0; i < pixels.length; i += 1) {
      const next = nearestRgbCenter(pixels[i], centers);
      if (assignments[i] !== next) changed += 1;
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

    if (changed / pixels.length < 0.01) break;
  }

  return pixels.map((_, index) => centers[assignments[index]]);
}

function initializeCenters(pixels, maxColors) {
  const unique = new Map();
  pixels.forEach((pixel) => {
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

function nearestPaletteIndex(rgb) {
  const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < state.paletteLabs.length; i += 1) {
    const target = state.paletteLabs[i];
    const dl = lab[0] - target[0];
    const da = lab[1] - target[1];
    const db = lab[2] - target[2];
    const distance = dl * dl + da * da + db * db;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
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
    const targetLab = state.paletteLabs[color];
    const dl = sourceLab[0] - targetLab[0];
    const da = sourceLab[1] - targetLab[1];
    const db = sourceLab[2] - targetLab[2];
    const distance = dl * dl + da * da + db * db;

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
    counts.set(index, (counts.get(index) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([index, count]) => ({
      ...state.palette[index],
      count,
      percent: count / total,
    }))
    .sort((a, b) => naturalCodeSort(a.code, b.code));
}

function renderPattern() {
  const { width, height, cells, materials } = state.pattern;
  drawPatternCanvas(els.gridCanvas, width, height, cells, { labels: false });
  drawPatternCanvas(els.codeCanvas, width, height, cells, { labels: true });
  drawLegendCanvas(els.legendCanvas, materials);
  setActiveView(state.activeView);
}

function drawPatternCanvas(canvas, width, height, cells, options) {
  const maxDimension = options.labels ? 1900 : 1400;
  const minCell = options.labels ? 20 : 10;
  const maxCell = options.labels ? 34 : 28;
  const cellSize = clamp(Math.floor(maxDimension / Math.max(width, height)), minCell, maxCell);
  const dpr = 1;

  canvas.width = width * cellSize + 1;
  canvas.height = height * cellSize + 1;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = state.palette[cells[y * width + x]];
      ctx.fillStyle = color.hex;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

      if (options.labels) {
        ctx.fillStyle = luminance(color.rgb) > 150 ? "#151515" : "#ffffff";
        ctx.font = `700 ${Math.max(7, Math.floor(cellSize * 0.36 * dpr))}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(color.code, x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
      }
    }
  }

  drawGridLines(ctx, width, height, cellSize);
}

function drawGridLines(ctx, width, height, cellSize) {
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 1) {
    ctx.strokeStyle = x % 10 === 0 ? "rgba(0,0,0,0.42)" : x % 5 === 0 ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(x * cellSize + 0.5, 0);
    ctx.lineTo(x * cellSize + 0.5, height * cellSize);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 1) {
    ctx.strokeStyle = y % 10 === 0 ? "rgba(0,0,0,0.42)" : y % 5 === 0 ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize + 0.5);
    ctx.lineTo(width * cellSize, y * cellSize + 0.5);
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
    row.innerHTML = `
      <td><strong>${escapeHtml(item.code)}</strong></td>
      <td><span class="swatch" style="background:${item.hex}"></span></td>
      <td>${escapeHtml(item.hex)}</td>
      <td>${item.count}</td>
    `;
    els.materialsBody.appendChild(row);
  });
}

function clearMaterials() {
  els.materialsBody.innerHTML = `<tr><td colspan="4">暂无材料数据</td></tr>`;
  els.materialTotal.textContent = "0 颗";
  els.patternStats.textContent = "未生成";
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

function downloadCanvas(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
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
  const title = `MARD 拼豆图纸 · ${state.pattern.width}x${state.pattern.height}`;

  addCanvasPage(doc, title, els.gridCanvas, true);
  doc.addPage("a4", "landscape");
  addCanvasPage(doc, "MARD 色号图", els.codeCanvas, false);
  doc.addPage("a4", "landscape");
  addCanvasPage(doc, "MARD 色号图例", els.legendCanvas, false);
  addMaterialsPages(doc);
  doc.save("pattern.pdf");
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
    doc.text(`Mode: ${state.pattern.mode}  Colors: ${state.pattern.materials.length}  Source: ${state.sourceFileName}`, margin, margin + 20);
  }

  doc.addImage(canvas.toDataURL("image/png"), "PNG", x, y, imageWidth, imageHeight);
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
