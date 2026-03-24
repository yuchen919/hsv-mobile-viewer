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
};

const presetMap = {
  red: {
    lowH: 170,
    highH: 10,
    lowS: 80,
    highS: 255,
    lowV: 80,
    highV: 255,
  },
  green: {
    lowH: 35,
    highH: 90,
    lowS: 60,
    highS: 255,
    lowV: 60,
    highV: 255,
  },
  blue: {
    lowH: 90,
    highH: 140,
    lowS: 60,
    highS: 255,
    lowV: 60,
    highV: 255,
  },
};

const controls = [
  {
    key: "lowH",
    label: "色相下限 H",
    min: 0,
    max: 179,
    step: 1,
    hint: "H 表示颜色类别。大致可理解成 0 红、30 黄、60 绿、90 青、120 蓝、150 紫。",
  },
  {
    key: "highH",
    label: "色相上限 H",
    min: 0,
    max: 179,
    step: 1,
    hint: "如果做红色检测，下限比上限大是正常的，表示色相跨过 0 度。",
  },
  {
    key: "lowS",
    label: "饱和下限 S",
    min: 0,
    max: 255,
    step: 1,
    hint: "S 越大颜色越纯，越小越接近灰白。",
  },
  {
    key: "highS",
    label: "饱和上限 S",
    min: 0,
    max: 255,
    step: 1,
    hint: "通常保持较高即可，主要用下限去卡掉偏灰区域。",
  },
  {
    key: "lowV",
    label: "明度下限 V",
    min: 0,
    max: 255,
    step: 1,
    hint: "V 越小越暗。环境光不稳定时，先调这个最有效。",
  },
  {
    key: "highV",
    label: "明度上限 V",
    min: 0,
    max: 255,
    step: 1,
    hint: "通常会放高一点，避免亮部目标被截断。",
  },
  {
    key: "openIterations",
    label: "去噪强度",
    min: 0,
    max: 3,
    step: 1,
    hint: "开运算次数，适合清掉零散小点。",
  },
  {
    key: "closeIterations",
    label: "补洞强度",
    min: 0,
    max: 3,
    step: 1,
    hint: "闭运算次数，适合补齐轮廓里的小黑洞。",
  },
  {
    key: "minArea",
    label: "最小面积",
    min: 0,
    max: 4000,
    step: 10,
    hint: "过滤太小的误检色块。数值越大，越只保留大目标。",
  },
  {
    key: "processWidth",
    label: "处理宽度",
    min: 160,
    max: 480,
    step: 16,
    hint: "越大越精细，但手机压力也越大。卡顿时把它调低。",
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

renderControls();
bindEvents();
updateStatus("等待启动摄像头");
initSecureHint();

function loadConfig() {
  try {
    const saved = localStorage.getItem("mobile-hsv-config");
    if (!saved) {
      return { ...defaultConfig };
    }
    return { ...defaultConfig, ...JSON.parse(saved) };
  } catch (_error) {
    return { ...defaultConfig };
  }
}

function saveConfigToStorage() {
  localStorage.setItem("mobile-hsv-config", JSON.stringify(state.config));
}

function renderControls() {
  const fragment = document.createDocumentFragment();

  controls.forEach((control) => {
    const wrapper = document.createElement("div");
    wrapper.className = "control-item";

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
      state.config[control.key] = Number(input.value);
      value.textContent = input.value;
      saveConfigToStorage();
      if (control.key === "processWidth" && state.running) {
        configureProcessingSize();
      }
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
    state.config = { ...defaultConfig };
    syncControls();
    saveConfigToStorage();
    if (state.running) {
      configureProcessingSize();
    }
    updateStatus("参数已恢复默认值");
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = presetMap[button.dataset.preset];
      state.config = { ...state.config, ...preset };
      syncControls();
      saveConfigToStorage();
      updateStatus(`已切到${button.textContent}预设`);
    });
  });

  outputCanvas.addEventListener("pointerdown", handleCanvasSample);

  window.addEventListener("beforeunload", () => {
    stopStream();
    cancelAnimationFrame(state.frameHandle);
  });
}

function syncControls() {
  controls.forEach((control) => {
    const input = document.getElementById(control.key);
    const output = document.getElementById(`${control.key}Value`);
    if (input) {
      input.value = String(state.config[control.key]);
    }
    if (output) {
      output.textContent = String(state.config[control.key]);
    }
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
    hiddenSourceCtx.drawImage(video, 0, 0, hiddenSourceCanvas.width, hiddenSourceCanvas.height);
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
    paintPreviews(hiddenSourceCanvas.width, hiddenSourceCanvas.height);
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

    const hueMatch =
      config.lowH <= config.highH
        ? h >= config.lowH && h <= config.highH
        : h >= config.lowH || h <= config.highH;
    const satMatch = s >= config.lowS && s <= config.highS;
    const valMatch = v >= config.lowV && v <= config.highV;
    mask[index] = hueMatch && satMatch && valMatch ? 1 : 0;
  }

  const morphed = applyMorphology(mask, width, height, config.openIterations, config.closeIterations);
  const components = filterComponents(morphed, width, height, config.minArea);
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

function filterComponents(mask, width, height, minArea) {
  state.visited.fill(0);
  state.filteredMask.fill(0);

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

    for (let i = 0; i < tail; i += 1) {
      state.filteredMask[state.queue[i]] = 1;
    }

    components.push({
      area: tail,
      minX,
      minY,
      maxX,
      maxY,
      centerX: sumX / tail,
      centerY: sumY / tail,
    });
  }

  components.sort((a, b) => b.area - a.area);
  return components;
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

function paintPreviews(width, height) {
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
    outputCtx.fillRect(x, Math.max(0, y - 28), 110, 24);
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

  const pixelIndex = (y * state.lastProcessWidth + x) * 4;
  const [h, s, v] = rgbToHsv(
    state.lastSourcePixels[pixelIndex],
    state.lastSourcePixels[pixelIndex + 1],
    state.lastSourcePixels[pixelIndex + 2]
  );

  state.lastSample = { h, s, v };
  applySampleToConfig(h, s, v);
  syncControls();
  saveConfigToStorage();
  updateStatus(`已吸取颜色：H${h} S${s} V${v}`);
}

function applySampleToConfig(h, s, v) {
  const hMargin = 12;
  const svMargin = 60;

  state.config.lowH = ((h - hMargin) + 180) % 180;
  state.config.highH = (h + hMargin) % 180;
  state.config.lowS = clamp(s - svMargin, 0, 255);
  state.config.highS = clamp(s + svMargin, 0, 255);
  state.config.lowV = clamp(v - svMargin, 0, 255);
  state.config.highV = clamp(v + svMargin, 0, 255);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateStatus(text) {
  statusText.textContent = text;
}
