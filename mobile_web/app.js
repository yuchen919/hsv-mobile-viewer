const video = document.getElementById("cameraVideo");
const outputCanvas = document.getElementById("outputCanvas");
const outputCtx = outputCanvas.getContext("2d", { alpha: false });
const maskCanvas = document.getElementById("maskCanvas");
const maskCtx = maskCanvas.getContext("2d", { alpha: false });
const edgeCanvas = document.getElementById("edgeCanvas");
const edgeCtx = edgeCanvas.getContext("2d", { alpha: false });
const startButton = document.getElementById("startButton");
const switchButton = document.getElementById("switchButton");
const saveButton = document.getElementById("saveButton");
const resetButton = document.getElementById("resetButton");
const controlList = document.getElementById("controlList");
const modeRow = document.getElementById("modeRow");
const presetRow = document.getElementById("presetRow");
const statusText = document.getElementById("statusText");
const secureHint = document.getElementById("secureHint");

const componentCount = document.getElementById("componentCount");
const coverageValue = document.getElementById("coverageValue");
const largestArea = document.getElementById("largestArea");
const sampleValue = document.getElementById("sampleValue");

const hiddenSourceCanvas = document.createElement("canvas");
const hiddenSourceCtx = hiddenSourceCanvas.getContext("2d", { willReadFrequently: true });
const hiddenOverlayCanvas = document.createElement("canvas");
const hiddenOverlayCtx = hiddenOverlayCanvas.getContext("2d");

const modeDefinitions = [
  {
    id: "color",
    label: "彩色",
    status: "彩色模式会同时参考 H、S、V，适合红绿蓝黄等明显颜色。",
  },
  {
    id: "black",
    label: "黑色",
    status: "黑色模式会弱化 H，主要参考饱和度和明度。",
  },
  {
    id: "white",
    label: "白色",
    status: "白色模式会弱化 H，主要保留低饱和且高亮区域。",
  },
  {
    id: "gray",
    label: "灰色",
    status: "灰色模式适合低饱和的中间亮度区域。",
  },
];

const presetDefinitions = [
  {
    id: "red",
    label: "红色",
    mode: "color",
    textColor: "#ffffff",
    gradient: "linear-gradient(135deg, #ff7d7d, #ff4d60)",
    values: { lowH: 170, highH: 12, lowS: 75, highS: 255, lowV: 70, highV: 255 },
  },
  {
    id: "orange",
    label: "橙色",
    mode: "color",
    textColor: "#ffffff",
    gradient: "linear-gradient(135deg, #ffb067, #ff7c3b)",
    values: { lowH: 8, highH: 24, lowS: 80, highS: 255, lowV: 80, highV: 255 },
  },
  {
    id: "yellow",
    label: "黄色",
    mode: "color",
    textColor: "#433200",
    gradient: "linear-gradient(135deg, #ffe57a, #ffcf47)",
    values: { lowH: 18, highH: 42, lowS: 70, highS: 255, lowV: 90, highV: 255 },
  },
  {
    id: "green",
    label: "绿色",
    mode: "color",
    textColor: "#ffffff",
    gradient: "linear-gradient(135deg, #52ec91, #1bb86b)",
    values: { lowH: 35, highH: 90, lowS: 55, highS: 255, lowV: 55, highV: 255 },
  },
  {
    id: "blue",
    label: "蓝色",
    mode: "color",
    textColor: "#ffffff",
    gradient: "linear-gradient(135deg, #74c1ff, #3279ff)",
    values: { lowH: 90, highH: 140, lowS: 55, highS: 255, lowV: 55, highV: 255 },
  },
  {
    id: "purple",
    label: "紫色",
    mode: "color",
    textColor: "#ffffff",
    gradient: "linear-gradient(135deg, #b07cff, #7d58ff)",
    values: { lowH: 130, highH: 165, lowS: 50, highS: 255, lowV: 55, highV: 255 },
  },
  {
    id: "black",
    label: "黑色",
    mode: "black",
    textColor: "#ffffff",
    gradient: "linear-gradient(135deg, #232c36, #090f14)",
    values: { lowH: 0, highH: 179, lowS: 0, highS: 135, lowV: 0, highV: 85 },
  },
  {
    id: "white",
    label: "白色",
    mode: "white",
    textColor: "#102532",
    gradient: "linear-gradient(135deg, #ffffff, #dbe8f3)",
    values: { lowH: 0, highH: 179, lowS: 0, highS: 68, lowV: 180, highV: 255 },
  },
  {
    id: "gray",
    label: "灰色",
    mode: "gray",
    textColor: "#ffffff",
    gradient: "linear-gradient(135deg, #8c97a5, #59626e)",
    values: { lowH: 0, highH: 179, lowS: 0, highS: 65, lowV: 45, highV: 200 },
  },
];

const defaultConfig = {
  lowH: 20,
  highH: 40,
  lowS: 80,
  highS: 255,
  lowV: 80,
  highV: 255,
  openIterations: 1,
  closeIterations: 1,
  minArea: 180,
  processWidth: 256,
  maskOpacity: 38,
  boxThickness: 3,
  blurStrength: 1,
  maxComponents: 3,
  sampleRadius: 2,
  sampleHueMargin: 12,
  sampleSMargin: 48,
  sampleVMargin: 48,
  detectionMode: "color",
};

const controls = [
  {
    key: "lowH",
    label: "色相下限 H",
    min: 0,
    max: 179,
    step: 1,
    hint: "彩色模式下表示颜色范围起点。红色跨过 0 度时，下限可以比上限大。",
  },
  {
    key: "highH",
    label: "色相上限 H",
    min: 0,
    max: 179,
    step: 1,
    hint: "彩色模式下表示颜色范围终点。黑白灰模式下会自动忽略这一项。",
  },
  {
    key: "lowS",
    label: "饱和下限 S",
    min: 0,
    max: 255,
    step: 1,
    hint: "S 越大颜色越纯。做彩色分割时，下限常用于排除偏灰区域。",
  },
  {
    key: "highS",
    label: "饱和上限 S",
    min: 0,
    max: 255,
    step: 1,
    hint: "黑白灰模式更依赖这一项。做白色和灰色时，通常要把它压低一些。",
  },
  {
    key: "lowV",
    label: "明度下限 V",
    min: 0,
    max: 255,
    step: 1,
    hint: "V 越小越暗。做黑色时可以把上限压低，做白色时可以把下限拉高。",
  },
  {
    key: "highV",
    label: "明度上限 V",
    min: 0,
    max: 255,
    step: 1,
    hint: "和明度下限一起决定亮度范围，环境光变化大时这一组最关键。",
  },
  {
    key: "blurStrength",
    label: "预模糊",
    min: 0,
    max: 3,
    step: 1,
    hint: "先做一点轻量模糊，能减少噪点和锯齿抖动。一般 1 到 2 就够了。",
  },
  {
    key: "openIterations",
    label: "去噪强度",
    min: 0,
    max: 3,
    step: 1,
    hint: "开运算次数，适合清理零散小噪点。",
  },
  {
    key: "closeIterations",
    label: "补洞强度",
    min: 0,
    max: 3,
    step: 1,
    hint: "闭运算次数，适合把轮廓内部的小黑洞补起来。",
  },
  {
    key: "minArea",
    label: "最小面积",
    min: 0,
    max: 5000,
    step: 10,
    hint: "过滤太小的误检色块。框太多时先调高这一项。",
  },
  {
    key: "maxComponents",
    label: "显示前几个目标",
    min: 1,
    max: 8,
    step: 1,
    hint: "按面积从大到小保留前几个目标，能明显减少画面里乱框的问题。",
  },
  {
    key: "processWidth",
    label: "处理宽度",
    min: 160,
    max: 512,
    step: 16,
    hint: "越大越精细，但手机压力也越大。卡顿时把它调低。",
  },
  {
    key: "sampleRadius",
    label: "取样半径",
    min: 0,
    max: 8,
    step: 1,
    hint: "点击取样时，会在点击点周围一起取样。越大越稳，但也更容易把邻近颜色一起吸进去。",
  },
  {
    key: "sampleHueMargin",
    label: "取样色相容差",
    min: 2,
    max: 40,
    step: 1,
    hint: "点击取样后，H 范围会按这个容差展开。想更精细就把它调小。",
  },
  {
    key: "sampleSMargin",
    label: "取样饱和容差",
    min: 4,
    max: 120,
    step: 1,
    hint: "点击取样后，S 范围会按这个容差展开。反光多时适当调大。",
  },
  {
    key: "sampleVMargin",
    label: "取样明度容差",
    min: 4,
    max: 120,
    step: 1,
    hint: "点击取样后，V 范围会按这个容差展开。亮暗变化大时适当调大。",
  },
  {
    key: "maskOpacity",
    label: "掩膜透明度",
    min: 0,
    max: 80,
    step: 1,
    hint: "调整主画面上绿色识别区域的透明度。",
  },
  {
    key: "boxThickness",
    label: "框线粗细",
    min: 1,
    max: 6,
    step: 1,
    hint: "控制轮廓框和中心点显示粗细。",
  },
];

const state = {
  config: loadConfig(),
  currentFacingMode: "environment",
  currentPresetId: null,
  stream: null,
  frameHandle: 0,
  running: false,
  bufferSize: 0,
  scratchA: null,
  scratchB: null,
  filteredMask: null,
  edgeMask: null,
  visited: null,
  queue: null,
  overlayImageData: null,
  maskImageData: null,
  edgeImageData: null,
  lastSourcePixels: null,
  lastProcessWidth: 0,
  lastProcessHeight: 0,
  lastSample: null,
};

renderModeButtons();
renderPresetButtons();
renderControls();
bindEvents();
syncControls();
updateStatus("等待启动摄像头");
initSecureHint();

function loadConfig() {
  try {
    const saved = localStorage.getItem("mobile-hsv-config");
    if (!saved) {
      return { ...defaultConfig };
    }

    const merged = { ...defaultConfig, ...JSON.parse(saved) };
    if (!modeDefinitions.some((mode) => mode.id === merged.detectionMode)) {
      merged.detectionMode = defaultConfig.detectionMode;
    }
    return merged;
  } catch (_error) {
    return { ...defaultConfig };
  }
}

function saveConfigToStorage() {
  localStorage.setItem("mobile-hsv-config", JSON.stringify(state.config));
}

function renderModeButtons() {
  const fragment = document.createDocumentFragment();

  modeDefinitions.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mode-button";
    button.textContent = mode.label;
    button.dataset.mode = mode.id;
    button.addEventListener("click", () => {
      state.currentPresetId = null;
      state.config.detectionMode = mode.id;
      syncControls();
      saveConfigToStorage();
      updateStatus(mode.status);
    });
    fragment.append(button);
  });

  modeRow.innerHTML = "";
  modeRow.append(fragment);
}

function renderPresetButtons() {
  const fragment = document.createDocumentFragment();

  presetDefinitions.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-button";
    button.textContent = preset.label;
    button.dataset.preset = preset.id;
    button.style.background = preset.gradient;
    button.style.color = preset.textColor;
    button.addEventListener("click", () => {
      applyPreset(preset.id);
    });
    fragment.append(button);
  });

  presetRow.innerHTML = "";
  presetRow.append(fragment);
}

function applyPreset(presetId) {
  const preset = presetDefinitions.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }

  state.currentPresetId = presetId;
  state.config = {
    ...state.config,
    ...preset.values,
    detectionMode: preset.mode,
  };
  syncControls();
  saveConfigToStorage();
  updateStatus(`已切到${preset.label}预设，可继续用滑条精细调整`);
}

function renderControls() {
  const fragment = document.createDocumentFragment();

  controls.forEach((control) => {
    const wrapper = document.createElement("div");
    wrapper.className = "control-item";
    wrapper.dataset.controlKey = control.key;

    const top = document.createElement("div");
    top.className = "control-top";

    const label = document.createElement("label");
    label.className = "control-label";
    label.htmlFor = control.key;
    label.textContent = control.label;

    const value = document.createElement("span");
    value.className = "control-value";
    value.id = `${control.key}Value`;
    value.textContent = String(state.config[control.key]);

    const hint = document.createElement("p");
    hint.className = "control-hint";
    hint.textContent = control.hint;

    const input = document.createElement("input");
    input.className = "control-slider";
    input.type = "range";
    input.id = control.key;
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    input.value = String(state.config[control.key]);
    input.addEventListener("input", () => {
      state.currentPresetId = null;
      state.config[control.key] = Number(input.value);
      value.textContent = input.value;
      if (control.key === "processWidth" && state.running) {
        configureProcessingSize();
      }
      saveConfigToStorage();
      syncControls();
    });

    top.append(label, value);
    wrapper.append(top, hint, input);
    fragment.append(wrapper);
  });

  controlList.innerHTML = "";
  controlList.append(fragment);
}

function bindEvents() {
  startButton.addEventListener("click", async () => {
    await startCamera();
  });

  switchButton.addEventListener("click", async () => {
    state.currentFacingMode =
      state.currentFacingMode === "environment" ? "user" : "environment";
    if (state.running) {
      await startCamera();
    } else {
      updateStatus(
        state.currentFacingMode === "environment"
          ? "已切换到后置摄像头模式，等待启动"
          : "已切换到前置摄像头模式，等待启动"
      );
    }
  });

  saveButton.addEventListener("click", () => {
    saveConfigToStorage();
    updateStatus("当前参数已保存到浏览器本地");
  });

  resetButton.addEventListener("click", () => {
    state.currentPresetId = null;
    state.config = { ...defaultConfig };
    syncControls();
    saveConfigToStorage();
    if (state.running) {
      configureProcessingSize();
    }
    updateStatus("参数已恢复默认值");
  });

  outputCanvas.addEventListener("pointerdown", handleCanvasSample);

  window.addEventListener("beforeunload", () => {
    stopStream();
    cancelAnimationFrame(state.frameHandle);
  });
}

function syncControls() {
  const hueDisabled = state.config.detectionMode !== "color";

  controls.forEach((control) => {
    const input = document.getElementById(control.key);
    const output = document.getElementById(`${control.key}Value`);
    if (!input || !output) {
      return;
    }

    input.value = String(state.config[control.key]);
    output.textContent = String(state.config[control.key]);

    const shouldDisable =
      hueDisabled &&
      (control.key === "lowH" ||
        control.key === "highH" ||
        control.key === "sampleHueMargin");
    input.disabled = shouldDisable;
    input.closest(".control-item")?.classList.toggle("is-disabled", shouldDisable);
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.config.detectionMode);
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === state.currentPresetId);
  });
}

function initSecureHint() {
  const secure =
    window.isSecureContext ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (secure) {
    secureHint.textContent = "当前环境允许浏览器申请摄像头权限。";
    return;
  }

  secureHint.textContent =
    "当前不是 HTTPS / localhost。很多手机浏览器会拒绝摄像头权限，建议部署到 HTTPS 后再用手机打开。";
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    updateStatus("当前浏览器不支持摄像头接口");
    return;
  }

  stopStream();

  try {
    updateStatus("正在请求摄像头权限...");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.currentFacingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    state.stream = stream;
    video.srcObject = stream;
    await video.play();

    configureDisplaySize();
    configureProcessingSize();
    state.running = true;
    cancelAnimationFrame(state.frameHandle);
    state.frameHandle = requestAnimationFrame(renderLoop);

    updateStatus(
      state.currentFacingMode === "environment"
        ? "后置摄像头已启动"
        : "前置摄像头已启动"
    );
  } catch (error) {
    console.error(error);
    updateStatus("摄像头启动失败，请检查权限或 HTTPS 环境");
  }
}

function stopStream() {
  if (!state.stream) {
    return;
  }

  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  state.running = false;
}

function configureDisplaySize() {
  const width = video.videoWidth || 720;
  const height = video.videoHeight || 960;
  outputCanvas.width = width;
  outputCanvas.height = height;
  outputCtx.imageSmoothingEnabled = true;
}

function configureProcessingSize() {
  const sourceWidth = video.videoWidth || 720;
  const sourceHeight = video.videoHeight || 960;
  const processWidth = Math.min(state.config.processWidth, sourceWidth);
  const processHeight = Math.max(1, Math.round((processWidth / sourceWidth) * sourceHeight));

  hiddenSourceCanvas.width = processWidth;
  hiddenSourceCanvas.height = processHeight;
  hiddenOverlayCanvas.width = processWidth;
  hiddenOverlayCanvas.height = processHeight;
  maskCanvas.width = processWidth;
  maskCanvas.height = processHeight;
  edgeCanvas.width = processWidth;
  edgeCanvas.height = processHeight;

  hiddenOverlayCtx.imageSmoothingEnabled = false;
  maskCtx.imageSmoothingEnabled = false;
  edgeCtx.imageSmoothingEnabled = false;

  state.lastProcessWidth = processWidth;
  state.lastProcessHeight = processHeight;
  ensureBuffers(processWidth * processHeight, processWidth, processHeight);
}

function ensureBuffers(size, width, height) {
  if (state.bufferSize === size) {
    return;
  }

  state.bufferSize = size;
  state.scratchA = new Uint8Array(size);
  state.scratchB = new Uint8Array(size);
  state.filteredMask = new Uint8Array(size);
  state.edgeMask = new Uint8Array(size);
  state.visited = new Uint8Array(size);
  state.queue = new Int32Array(size);
  state.overlayImageData = hiddenOverlayCtx.createImageData(width, height);
  state.maskImageData = maskCtx.createImageData(width, height);
  state.edgeImageData = edgeCtx.createImageData(width, height);
}

function renderLoop() {
  if (!state.running) {
    return;
  }

  if (video.readyState >= 2) {
    hiddenSourceCtx.filter =
      state.config.blurStrength > 0 ? `blur(${state.config.blurStrength}px)` : "none";
    hiddenSourceCtx.drawImage(video, 0, 0, hiddenSourceCanvas.width, hiddenSourceCanvas.height);
    hiddenSourceCtx.filter = "none";

    const frame = hiddenSourceCtx.getImageData(
      0,
      0,
      hiddenSourceCanvas.width,
      hiddenSourceCanvas.height
    );
    state.lastSourcePixels = frame.data;

    const analysis = analyzeFrame(
      frame.data,
      hiddenSourceCanvas.width,
      hiddenSourceCanvas.height,
      state.config
    );
    paintPreviews();
    paintOutput(analysis, hiddenSourceCanvas.width, hiddenSourceCanvas.height);
    updateStats(analysis);
  }

  state.frameHandle = requestAnimationFrame(renderLoop);
}

function analyzeFrame(pixels, width, height, config) {
  const mask = state.scratchA;
  mask.fill(0);

  for (let index = 0, pixelIndex = 0; index < mask.length; index += 1, pixelIndex += 4) {
    const [h, s, v] = rgbToHsv(pixels[pixelIndex], pixels[pixelIndex + 1], pixels[pixelIndex + 2]);
    mask[index] = pixelMatches(h, s, v, config) ? 1 : 0;
  }

  const morphed = applyMorphology(mask, width, height, config.openIterations, config.closeIterations);
  const components = filterComponents(morphed, width, height, config.minArea, config.maxComponents);
  buildEdgeMask(state.filteredMask, width, height, state.edgeMask);

  let matchedPixels = 0;
  for (let i = 0; i < state.filteredMask.length; i += 1) {
    matchedPixels += state.filteredMask[i];
  }

  const largest = components[0] ?? null;
  return {
    components,
    matchedPixels,
    largestArea: largest ? largest.area : 0,
  };
}

function pixelMatches(h, s, v, config) {
  const satMatch = s >= config.lowS && s <= config.highS;
  const valMatch = v >= config.lowV && v <= config.highV;

  if (config.detectionMode !== "color") {
    return satMatch && valMatch;
  }

  const hueMatch =
    config.lowH <= config.highH
      ? h >= config.lowH && h <= config.highH
      : h >= config.lowH || h <= config.highH;

  return hueMatch && satMatch && valMatch;
}

function rgbToHsv(r, g, b) {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === rf) {
      hue = ((gf - bf) / delta) % 6;
    } else if (max === gf) {
      hue = (bf - rf) / delta + 2;
    } else {
      hue = (rf - gf) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation = max === 0 ? 0 : (delta / max) * 255;
  const value = max * 255;

  return [Math.round(hue / 2), Math.round(saturation), Math.round(value)];
}

function applyMorphology(sourceMask, width, height, openIterations, closeIterations) {
  state.scratchA.set(sourceMask);
  let current = state.scratchA;
  let next = state.scratchB;

  for (let i = 0; i < openIterations; i += 1) {
    erodeBinary(current, next, width, height);
    [current, next] = [next, current];
    dilateBinary(current, next, width, height);
    [current, next] = [next, current];
  }

  for (let i = 0; i < closeIterations; i += 1) {
    dilateBinary(current, next, width, height);
    [current, next] = [next, current];
    erodeBinary(current, next, width, height);
    [current, next] = [next, current];
  }

  return current;
}

function erodeBinary(src, dst, width, height) {
  dst.fill(0);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      let keep = 1;
      for (let dy = -1; dy <= 1 && keep; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (src[index + dy * width + dx] === 0) {
            keep = 0;
            break;
          }
        }
      }
      dst[index] = keep;
    }
  }
}

function dilateBinary(src, dst, width, height) {
  dst.fill(0);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      let fill = 0;
      for (let dy = -1; dy <= 1 && !fill; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (src[index + dy * width + dx] !== 0) {
            fill = 1;
            break;
          }
        }
      }
      dst[index] = fill;
    }
  }
}

function filterComponents(mask, width, height, minArea, maxComponents) {
  state.visited.fill(0);

  const components = [];

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0 || state.visited[index] !== 0) {
      continue;
    }

    let head = 0;
    let tail = 0;
    state.queue[tail] = index;
    tail += 1;
    state.visited[index] = 1;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;

    while (head < tail) {
      const current = state.queue[head];
      head += 1;

      const x = current % width;
      const y = (current - x) / width;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            continue;
          }

          const neighborIndex = ny * width + nx;
          if (mask[neighborIndex] === 0 || state.visited[neighborIndex] !== 0) {
            continue;
          }

          state.visited[neighborIndex] = 1;
          state.queue[tail] = neighborIndex;
          tail += 1;
        }
      }
    }

    if (tail < minArea) {
      continue;
    }

    components.push({
      area: tail,
      minX,
      minY,
      maxX,
      maxY,
      centerX: sumX / tail,
      centerY: sumY / tail,
      pixels: state.queue.slice(0, tail),
    });
  }

  components.sort((a, b) => b.area - a.area);

  const selected = components.slice(0, Math.max(1, maxComponents));
  state.filteredMask.fill(0);

  selected.forEach((component) => {
    for (let i = 0; i < component.pixels.length; i += 1) {
      state.filteredMask[component.pixels[i]] = 1;
    }
  });

  return selected.map(({ pixels, ...component }) => component);
}

function buildEdgeMask(mask, width, height, edgeMask) {
  edgeMask.fill(0);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (mask[index] === 0) {
        continue;
      }

      if (
        mask[index - 1] === 0 ||
        mask[index + 1] === 0 ||
        mask[index - width] === 0 ||
        mask[index + width] === 0 ||
        mask[index - width - 1] === 0 ||
        mask[index - width + 1] === 0 ||
        mask[index + width - 1] === 0 ||
        mask[index + width + 1] === 0
      ) {
        edgeMask[index] = 1;
      }
    }
  }
}

function paintPreviews() {
  const overlayPixels = state.overlayImageData.data;
  const maskPixels = state.maskImageData.data;
  const edgePixels = state.edgeImageData.data;
  const alpha = Math.round((state.config.maskOpacity / 100) * 255);

  for (let index = 0, rgba = 0; index < state.filteredMask.length; index += 1, rgba += 4) {
    const active = state.filteredMask[index] !== 0;
    const edge = state.edgeMask[index] !== 0;

    if (active) {
      overlayPixels[rgba] = 26;
      overlayPixels[rgba + 1] = 223;
      overlayPixels[rgba + 2] = 153;
      overlayPixels[rgba + 3] = alpha;

      maskPixels[rgba] = 255;
      maskPixels[rgba + 1] = 255;
      maskPixels[rgba + 2] = 255;
      maskPixels[rgba + 3] = 255;
    } else {
      overlayPixels[rgba] = 0;
      overlayPixels[rgba + 1] = 0;
      overlayPixels[rgba + 2] = 0;
      overlayPixels[rgba + 3] = 0;

      maskPixels[rgba] = 8;
      maskPixels[rgba + 1] = 10;
      maskPixels[rgba + 2] = 15;
      maskPixels[rgba + 3] = 255;
    }

    if (edge) {
      overlayPixels[rgba] = 255;
      overlayPixels[rgba + 1] = 213;
      overlayPixels[rgba + 2] = 72;
      overlayPixels[rgba + 3] = 255;

      edgePixels[rgba] = 255;
      edgePixels[rgba + 1] = 255;
      edgePixels[rgba + 2] = 255;
      edgePixels[rgba + 3] = 255;
    } else {
      edgePixels[rgba] = 8;
      edgePixels[rgba + 1] = 10;
      edgePixels[rgba + 2] = 15;
      edgePixels[rgba + 3] = 255;
    }
  }

  hiddenOverlayCtx.putImageData(state.overlayImageData, 0, 0);
  maskCtx.putImageData(state.maskImageData, 0, 0);
  edgeCtx.putImageData(state.edgeImageData, 0, 0);
}

function paintOutput(analysis, processWidth, processHeight) {
  outputCtx.drawImage(video, 0, 0, outputCanvas.width, outputCanvas.height);
  outputCtx.drawImage(hiddenOverlayCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

  const scaleX = outputCanvas.width / processWidth;
  const scaleY = outputCanvas.height / processHeight;

  analysis.components.forEach((component, index) => {
    const x = component.minX * scaleX;
    const y = component.minY * scaleY;
    const width = (component.maxX - component.minX + 1) * scaleX;
    const height = (component.maxY - component.minY + 1) * scaleY;
    const isLargest = index === 0;

    outputCtx.strokeStyle = isLargest ? "#ff6374" : "#62ffbe";
    outputCtx.lineWidth = state.config.boxThickness;
    outputCtx.strokeRect(x, y, width, height);

    outputCtx.fillStyle = isLargest ? "#ff6374" : "#ffffff";
    outputCtx.beginPath();
    outputCtx.arc(
      component.centerX * scaleX,
      component.centerY * scaleY,
      4 + state.config.boxThickness,
      0,
      Math.PI * 2
    );
    outputCtx.fill();

    outputCtx.fillStyle = "rgba(5, 12, 19, 0.78)";
    outputCtx.fillRect(x, Math.max(0, y - 28), 120, 24);
    outputCtx.fillStyle = "#ecf6fb";
    outputCtx.font = "16px 'Avenir Next', 'PingFang SC', sans-serif";
    outputCtx.fillText(`面积 ${component.area}`, x + 8, Math.max(18, y - 10));
  });
}

function updateStats(analysis) {
  componentCount.textContent = String(analysis.components.length);
  const total = state.lastProcessWidth * state.lastProcessHeight || 1;
  coverageValue.textContent = `${((analysis.matchedPixels / total) * 100).toFixed(2)}%`;
  largestArea.textContent = String(analysis.largestArea);

  if (state.lastSample) {
    sampleValue.textContent = `H${state.lastSample.h} S${state.lastSample.s} V${state.lastSample.v}`;
  }
}

function handleCanvasSample(event) {
  if (!state.lastSourcePixels) {
    return;
  }

  const rect = outputCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * state.lastProcessWidth);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * state.lastProcessHeight);

  if (x < 0 || y < 0 || x >= state.lastProcessWidth || y >= state.lastProcessHeight) {
    return;
  }

  const sample = sampleNeighborhoodHsv(x, y);
  const sampledMode = inferModeFromSample(sample);

  state.currentPresetId = null;
  state.lastSample = sample;
  state.config.detectionMode = sampledMode;
  applySampleToConfig(sample, sampledMode);
  syncControls();
  saveConfigToStorage();

  const modeLabel = modeDefinitions.find((mode) => mode.id === sampledMode)?.label ?? "当前";
  updateStatus(`已区域取样：H${sample.h} S${sample.s} V${sample.v}，自动切到${modeLabel}模式`);
}

function sampleNeighborhoodHsv(centerX, centerY) {
  const radius = state.config.sampleRadius;
  const sValues = [];
  const vValues = [];
  let sumHueX = 0;
  let sumHueY = 0;
  let hueCount = 0;

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = clamp(centerX + dx, 0, state.lastProcessWidth - 1);
      const y = clamp(centerY + dy, 0, state.lastProcessHeight - 1);
      const pixelIndex = (y * state.lastProcessWidth + x) * 4;

      const [h, s, v] = rgbToHsv(
        state.lastSourcePixels[pixelIndex],
        state.lastSourcePixels[pixelIndex + 1],
        state.lastSourcePixels[pixelIndex + 2]
      );

      sValues.push(s);
      vValues.push(v);

      if (s >= 18 && v >= 18) {
        const angle = (h * 2 * Math.PI) / 180;
        sumHueX += Math.cos(angle);
        sumHueY += Math.sin(angle);
        hueCount += 1;
      }
    }
  }

  const medianS = median(sValues);
  const medianV = median(vValues);

  let hue = state.config.lowH;
  if (hueCount > 0) {
    const angle = Math.atan2(sumHueY, sumHueX);
    hue = Math.round((((angle * 180) / Math.PI) + 360) % 360 / 2);
  }

  return {
    h: hue,
    s: medianS,
    v: medianV,
  };
}

function inferModeFromSample(sample) {
  if (sample.s <= 40) {
    if (sample.v <= 70) {
      return "black";
    }
    if (sample.v >= 200) {
      return "white";
    }
    return "gray";
  }
  return "color";
}

function applySampleToConfig(sample, mode) {
  const hueMargin = state.config.sampleHueMargin;
  const satMargin = state.config.sampleSMargin;
  const valMargin = state.config.sampleVMargin;

  if (mode === "color") {
    state.config.lowH = wrapHue(sample.h - hueMargin);
    state.config.highH = wrapHue(sample.h + hueMargin);
    state.config.lowS = clamp(sample.s - satMargin, 0, 255);
    state.config.highS = clamp(sample.s + satMargin, 0, 255);
    state.config.lowV = clamp(sample.v - valMargin, 0, 255);
    state.config.highV = clamp(sample.v + valMargin, 0, 255);
    return;
  }

  state.config.lowH = 0;
  state.config.highH = 179;
  state.config.lowS = 0;
  state.config.highS = clamp(sample.s + satMargin, 0, 255);

  if (mode === "black") {
    state.config.lowV = 0;
    state.config.highV = clamp(sample.v + valMargin, 0, 255);
    return;
  }

  if (mode === "white") {
    state.config.lowV = clamp(sample.v - valMargin, 0, 255);
    state.config.highV = 255;
    return;
  }

  state.config.lowV = clamp(sample.v - valMargin, 0, 255);
  state.config.highV = clamp(sample.v + valMargin, 0, 255);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function wrapHue(value) {
  return ((Math.round(value) % 180) + 180) % 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateStatus(text) {
  statusText.textContent = text;
}
