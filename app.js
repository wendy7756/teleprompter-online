const MIN_WPM = 10;
const MAX_WPM = 500;
const DEFAULT_SCRIPT = `Welcome to Teleprompter Online.

Paste your script in the panel, choose Teleprompter or Recording mode, and press Play.

The browser version keeps the same WPM-based speed model as the macOS app while using lightweight HTML, CSS, and JavaScript.

Recording mode can open your camera, place a draggable text overlay, and export a WebM video.`;

const state = {
  mode: "teleprompter",
  script: localStorage.getItem("teleprompter.script") || DEFAULT_SCRIPT,
  wpm: clamp(Number(localStorage.getItem("teleprompter.wpm")) || 180, MIN_WPM, MAX_WPM),
  fontSize: clamp(Number(localStorage.getItem("teleprompter.fontSize")) || 42, 18, 120),
  lineSpacing: clamp(Number(localStorage.getItem("teleprompter.lineSpacing")) || 1.2, 1, 2.5),
  textWidth: clamp(Number(localStorage.getItem("teleprompter.textWidth")) || 86, 35, 100),
  textColor: localStorage.getItem("teleprompter.textColor") || "#ffffff",
  backgroundColor: localStorage.getItem("teleprompter.backgroundColor") || "#05070a",
  align: localStorage.getItem("teleprompter.align") || "left",
  flipX: localStorage.getItem("teleprompter.flipX") === "true",
  flipY: localStorage.getItem("teleprompter.flipY") === "true",
  overlayWidth: Number(localStorage.getItem("teleprompter.overlayWidth")) || 520,
  overlayHeight: Number(localStorage.getItem("teleprompter.overlayHeight")) || 280,
  scrollOffset: 0,
  playing: false,
  recording: false,
  lastTick: 0,
  cameraStream: null,
  audioStream: null,
  recorder: null,
  recordedChunks: [],
  drawLoop: 0,
  drag: null
};

const els = {
  body: document.body,
  stage: document.getElementById("stage"),
  cameraPreview: document.getElementById("cameraPreview"),
  recordCanvas: document.getElementById("recordCanvas"),
  prompterLayer: document.getElementById("prompterLayer"),
  prompterContent: document.getElementById("prompterContent"),
  teleprompterMode: document.getElementById("teleprompterMode"),
  recordingMode: document.getElementById("recordingMode"),
  settingsButton: document.getElementById("settingsButton"),
  scriptButton: document.getElementById("scriptButton"),
  closePanelButton: document.getElementById("closePanelButton"),
  panel: document.getElementById("settingsPanel"),
  scriptInput: document.getElementById("scriptInput"),
  speedInput: document.getElementById("speedInput"),
  fontInput: document.getElementById("fontInput"),
  lineInput: document.getElementById("lineInput"),
  widthInput: document.getElementById("widthInput"),
  textColorInput: document.getElementById("textColorInput"),
  backgroundColorInput: document.getElementById("backgroundColorInput"),
  flipXInput: document.getElementById("flipXInput"),
  flipYInput: document.getElementById("flipYInput"),
  overlayWidthInput: document.getElementById("overlayWidthInput"),
  overlayHeightInput: document.getElementById("overlayHeightInput"),
  speedValue: document.getElementById("speedValue"),
  fontValue: document.getElementById("fontValue"),
  lineValue: document.getElementById("lineValue"),
  widthValue: document.getElementById("widthValue"),
  overlayWidthValue: document.getElementById("overlayWidthValue"),
  overlayHeightValue: document.getElementById("overlayHeightValue"),
  playButton: document.getElementById("playButton"),
  restartButton: document.getElementById("restartButton"),
  previousButton: document.getElementById("previousButton"),
  nextButton: document.getElementById("nextButton"),
  speedButton: document.getElementById("speedButton"),
  textButton: document.getElementById("textButton"),
  cameraButton: document.getElementById("cameraButton"),
  recordButton: document.getElementById("recordButton"),
  recordControls: document.getElementById("recordControls"),
  downloadLink: document.getElementById("downloadLink"),
  countdown: document.getElementById("countdown")
};

init();

function init() {
  hydrateControls();
  bindEvents();
  setMode(state.mode);
  render();
  requestAnimationFrame(tick);
}

function bindEvents() {
  els.teleprompterMode.addEventListener("click", () => setMode("teleprompter"));
  els.recordingMode.addEventListener("click", () => setMode("recording"));
  els.settingsButton.addEventListener("click", () => els.body.classList.toggle("panel-collapsed"));
  els.closePanelButton.addEventListener("click", () => els.body.classList.add("panel-collapsed"));
  els.scriptButton.addEventListener("click", () => {
    els.body.classList.remove("panel-collapsed");
    els.scriptInput.focus();
  });

  els.playButton.addEventListener("click", () => togglePlay());
  els.restartButton.addEventListener("click", restart);
  els.previousButton.addEventListener("click", () => jumpLines(-3));
  els.nextButton.addEventListener("click", () => jumpLines(3));
  els.speedButton.addEventListener("click", () => {
    els.body.classList.remove("panel-collapsed");
    els.speedInput.focus();
  });
  els.textButton.addEventListener("click", () => {
    els.body.classList.remove("panel-collapsed");
    els.fontInput.focus();
  });

  els.cameraButton.addEventListener("click", startCamera);
  els.recordButton.addEventListener("click", toggleRecording);

  els.scriptInput.addEventListener("input", () => {
    state.script = els.scriptInput.value;
    state.scrollOffset = 0;
    save("script", state.script);
    render();
  });

  bindRange(els.speedInput, "wpm", MIN_WPM, MAX_WPM, updateLabels);
  bindRange(els.fontInput, "fontSize", 18, 120, updateLabels);
  bindRange(els.lineInput, "lineSpacing", 1, 2.5, updateLabels);
  bindRange(els.widthInput, "textWidth", 35, 100, updateLabels);
  bindRange(els.overlayWidthInput, "overlayWidth", 260, 1100, updateOverlay);
  bindRange(els.overlayHeightInput, "overlayHeight", 160, 760, updateOverlay);

  els.textColorInput.addEventListener("input", () => {
    state.textColor = els.textColorInput.value;
    save("textColor", state.textColor);
    render();
  });
  els.backgroundColorInput.addEventListener("input", () => {
    state.backgroundColor = els.backgroundColorInput.value;
    save("backgroundColor", state.backgroundColor);
    render();
  });
  els.flipXInput.addEventListener("change", () => {
    state.flipX = els.flipXInput.checked;
    save("flipX", state.flipX);
    render();
  });
  els.flipYInput.addEventListener("change", () => {
    state.flipY = els.flipYInput.checked;
    save("flipY", state.flipY);
    render();
  });

  document.querySelectorAll("[data-align]").forEach((button) => {
    button.addEventListener("click", () => {
      state.align = button.dataset.align;
      save("align", state.align);
      render();
    });
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  els.prompterLayer.addEventListener("pointerdown", beginDrag);
  window.addEventListener("pointermove", dragMove);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("resize", () => {
    clampOverlay();
    render();
  });

  window.addEventListener("keydown", (event) => {
    if (event.target.matches("textarea,input")) return;
    if (event.code === "Space") {
      event.preventDefault();
      togglePlay();
    }
    if (event.key === "r") restart();
    if (event.key === "ArrowUp") jumpLines(-3);
    if (event.key === "ArrowDown") jumpLines(3);
  });
}

function hydrateControls() {
  els.scriptInput.value = state.script;
  els.speedInput.value = state.wpm;
  els.fontInput.value = state.fontSize;
  els.lineInput.value = state.lineSpacing;
  els.widthInput.value = state.textWidth;
  els.textColorInput.value = state.textColor;
  els.backgroundColorInput.value = state.backgroundColor;
  els.flipXInput.checked = state.flipX;
  els.flipYInput.checked = state.flipY;
  els.overlayWidthInput.value = state.overlayWidth;
  els.overlayHeightInput.value = state.overlayHeight;
  updateLabels();
}

function bindRange(input, key, min, max, afterChange) {
  input.addEventListener("input", () => {
    state[key] = clamp(Number(input.value), min, max);
    save(key, state[key]);
    afterChange();
    render();
  });
}

function setMode(mode) {
  state.mode = mode;
  state.playing = false;
  state.scrollOffset = 0;
  els.stage.classList.toggle("recording", mode === "recording");
  els.teleprompterMode.classList.toggle("is-active", mode === "teleprompter");
  els.recordingMode.classList.toggle("is-active", mode === "recording");
  els.playButton.textContent = "Play";
  if (mode === "recording") {
    applyPreset("top");
  } else {
    els.prompterLayer.style.left = "";
    els.prompterLayer.style.top = "";
    els.prompterLayer.style.width = "";
    els.prompterLayer.style.height = "";
  }
  render();
}

function togglePlay() {
  if (state.playing) {
    state.playing = false;
    els.playButton.textContent = "Play";
    return;
  }
  startCountdown(() => {
    state.playing = true;
    state.lastTick = performance.now();
    els.playButton.textContent = "Pause";
  });
}

function restart() {
  state.scrollOffset = -lineStep();
  state.playing = false;
  els.playButton.textContent = "Play";
  render();
}

function jumpLines(count) {
  state.scrollOffset = clamp(state.scrollOffset + count * lineStep(), -lineStep(), maxScrollOffset());
  render();
}

function tick(now) {
  if (state.playing) {
    const elapsed = Math.min(0.25, Math.max(0, (now - state.lastTick) / 1000));
    state.lastTick = now;
    state.scrollOffset += scrollSpeedPointsPerSecond() * elapsed;
    clampScrollForMode();
    render();
  }
  requestAnimationFrame(tick);
}

function clampScrollForMode() {
  if (!state.script.trim()) {
    state.scrollOffset = 0;
    state.playing = false;
    return;
  }

  if (state.mode === "teleprompter") {
    if (state.scrollOffset >= lastTextBottom()) {
      state.scrollOffset = 0;
      state.playing = false;
      els.playButton.textContent = "Play";
    }
    return;
  }

  const end = maxScrollOffset();
  if (state.scrollOffset >= end) {
    state.scrollOffset = end;
    state.playing = false;
    els.playButton.textContent = "Play";
  }
}

function scrollSpeedPointsPerSecond() {
  const wordsPerSecond = state.wpm / 60;
  const words = Math.max(1, state.script.trim().split(/\s+/).filter(Boolean).length);
  const textHeight = Math.max(1, els.prompterContent.scrollHeight);
  const pointsPerWord = Math.min(120, Math.max(0.25, textHeight / words));
  return Math.max(0, wordsPerSecond * pointsPerWord);
}

function lineStep() {
  return Math.max(1, state.fontSize * Math.max(1.08, state.lineSpacing * 1.12) * 3);
}

function maxScrollOffset() {
  return Math.max(0, lastTextBottom() - els.prompterLayer.clientHeight);
}

function lastTextBottom() {
  return Math.max(0, els.prompterContent.scrollHeight - 32);
}

function render() {
  els.prompterContent.textContent = state.script || " ";
  els.stage.style.background = state.backgroundColor;
  els.prompterLayer.style.color = state.textColor;
  els.prompterLayer.style.transform = `scale(${state.flipX ? -1 : 1}, ${state.flipY ? -1 : 1})`;
  els.prompterContent.style.fontSize = `${state.fontSize}px`;
  els.prompterContent.style.lineHeight = state.lineSpacing;
  els.prompterContent.style.width = `${state.textWidth}%`;
  els.prompterContent.style.textAlign = state.align;
  els.prompterContent.style.transform = `translate3d(0, ${-state.scrollOffset}px, 0)`;
  document.querySelectorAll("[data-align]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.align === state.align);
  });
  updateLabels();
}

function updateLabels() {
  els.speedValue.textContent = `${Math.round(state.wpm)} WPM`;
  els.fontValue.textContent = `${Math.round(state.fontSize)} px`;
  els.lineValue.textContent = `${Number(state.lineSpacing).toFixed(1)}x`;
  els.widthValue.textContent = `${Math.round(state.textWidth)}%`;
  els.overlayWidthValue.textContent = `${Math.round(state.overlayWidth)} px`;
  els.overlayHeightValue.textContent = `${Math.round(state.overlayHeight)} px`;
}

function updateOverlay() {
  els.prompterLayer.style.width = `${state.overlayWidth}px`;
  els.prompterLayer.style.height = `${state.overlayHeight}px`;
  save("overlayWidth", state.overlayWidth);
  save("overlayHeight", state.overlayHeight);
  clampOverlay();
  updateLabels();
}

async function startCamera() {
  if (state.cameraStream) {
    stopCamera();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });
    state.cameraStream = stream;
    els.cameraPreview.srcObject = stream;
    await els.cameraPreview.play();
    els.cameraButton.textContent = "Stop camera";
    drawRecordingFrame();
  } catch (error) {
    alert("Camera permission is required for Recording mode.");
  }
}

function stopCamera() {
  if (!state.cameraStream) return;
  state.cameraStream.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
  els.cameraPreview.srcObject = null;
  els.cameraButton.textContent = "Start camera";
  cancelAnimationFrame(state.drawLoop);
}

async function toggleRecording() {
  if (state.recording) {
    stopRecording();
    return;
  }
  if (!state.cameraStream) {
    await startCamera();
  }
  if (!state.cameraStream) return;
  startCountdown(startRecording);
}

function startRecording() {
  state.recordedChunks = [];
  const canvasStream = els.recordCanvas.captureStream(30);
  const audioTracks = state.cameraStream.getAudioTracks();
  audioTracks.forEach((track) => canvasStream.addTrack(track));

  state.recorder = new MediaRecorder(canvasStream, { mimeType: supportedMimeType() });
  state.recorder.ondataavailable = (event) => {
    if (event.data.size) state.recordedChunks.push(event.data);
  };
  state.recorder.onstop = finishRecording;
  state.recorder.start();
  state.recording = true;
  els.recordButton.classList.add("is-recording");
  state.playing = true;
  state.lastTick = performance.now();
  els.playButton.textContent = "Pause";
}

function stopRecording() {
  if (!state.recorder || state.recorder.state === "inactive") return;
  state.recorder.stop();
  state.recording = false;
  state.playing = false;
  els.recordButton.classList.remove("is-recording");
  els.playButton.textContent = "Play";
}

function finishRecording() {
  const blob = new Blob(state.recordedChunks, { type: state.recorder.mimeType || "video/webm" });
  const url = URL.createObjectURL(blob);
  els.downloadLink.href = url;
  els.downloadLink.download = `teleprompter-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  els.downloadLink.hidden = false;
}

function drawRecordingFrame() {
  const ctx = els.recordCanvas.getContext("2d");
  const draw = () => {
    const w = els.recordCanvas.width;
    const h = els.recordCanvas.height;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, w, h);

    if (state.cameraStream && els.cameraPreview.videoWidth) {
      drawCover(ctx, els.cameraPreview, 0, 0, w, h);
    }

    const stageRect = els.stage.getBoundingClientRect();
    const layerRect = els.prompterLayer.getBoundingClientRect();
    const scaleX = w / stageRect.width;
    const scaleY = h / stageRect.height;
    const box = {
      x: (layerRect.left - stageRect.left) * scaleX,
      y: (layerRect.top - stageRect.top) * scaleY,
      width: layerRect.width * scaleX,
      height: layerRect.height * scaleY
    };
    drawScript(ctx, box, scaleX, scaleY);
    state.drawLoop = requestAnimationFrame(draw);
  };
  cancelAnimationFrame(state.drawLoop);
  draw();
}

function drawCover(ctx, video, x, y, w, h) {
  const videoRatio = video.videoWidth / video.videoHeight;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = video.videoWidth;
  let sh = video.videoHeight;
  if (videoRatio > boxRatio) {
    sw = video.videoHeight * boxRatio;
    sx = (video.videoWidth - sw) / 2;
  } else {
    sh = video.videoWidth / boxRatio;
    sy = (video.videoHeight - sh) / 2;
  }
  ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
}

function drawScript(ctx, box, scaleX, scaleY) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.fillStyle = state.textColor;
  ctx.font = `${state.fontSize * scaleY}px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = state.align === "right" ? "right" : state.align === "center" ? "center" : "left";

  const padding = 18 * scaleY;
  const lineHeight = state.fontSize * state.lineSpacing * scaleY;
  const maxWidth = box.width - padding * 2;
  const lines = wrapText(ctx, state.script, maxWidth);
  const alignX = state.align === "right" ? box.x + box.width - padding : state.align === "center" ? box.x + box.width / 2 : box.x + padding;
  let y = box.y + padding - state.scrollOffset * scaleY;
  for (const line of lines) {
    ctx.fillText(line, alignX, y);
    y += lineHeight;
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const output = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim() ? paragraph.split(/\s+/) : [""];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        output.push(line);
        line = word;
      }
    }
    output.push(line);
  }
  return output;
}

function supportedMimeType() {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function startCountdown(done) {
  let n = 3;
  els.countdown.hidden = false;
  els.countdown.textContent = n;
  const timer = setInterval(() => {
    n -= 1;
    if (n > 0) {
      els.countdown.textContent = n;
      return;
    }
    clearInterval(timer);
    els.countdown.hidden = true;
    done();
  }, 700);
}

function beginDrag(event) {
  if (state.mode !== "recording") return;
  state.drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: els.prompterLayer.offsetLeft,
    top: els.prompterLayer.offsetTop
  };
  els.prompterLayer.setPointerCapture(event.pointerId);
}

function dragMove(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;
  els.prompterLayer.style.left = `${state.drag.left + event.clientX - state.drag.startX}px`;
  els.prompterLayer.style.top = `${state.drag.top + event.clientY - state.drag.startY}px`;
  clampOverlay();
}

function endDrag() {
  state.drag = null;
}

function applyPreset(preset) {
  if (state.mode !== "recording") return;
  updateOverlay();
  const stage = els.stage.getBoundingClientRect();
  const box = els.prompterLayer.getBoundingClientRect();
  const pad = 44;
  const positions = {
    top: [(stage.width - box.width) / 2, pad],
    bottom: [(stage.width - box.width) / 2, stage.height - box.height - pad],
    left: [pad, (stage.height - box.height) / 2],
    right: [stage.width - box.width - pad, (stage.height - box.height) / 2],
    center: [(stage.width - box.width) / 2, (stage.height - box.height) / 2]
  };
  const [left, top] = positions[preset] || positions.center;
  els.prompterLayer.style.left = `${left}px`;
  els.prompterLayer.style.top = `${top}px`;
  clampOverlay();
}

function clampOverlay() {
  if (state.mode !== "recording") return;
  const maxLeft = Math.max(0, els.stage.clientWidth - els.prompterLayer.offsetWidth);
  const maxTop = Math.max(0, els.stage.clientHeight - els.prompterLayer.offsetHeight);
  const left = clamp(els.prompterLayer.offsetLeft, 0, maxLeft);
  const top = clamp(els.prompterLayer.offsetTop, 0, maxTop);
  els.prompterLayer.style.left = `${left}px`;
  els.prompterLayer.style.top = `${top}px`;
}

function save(key, value) {
  localStorage.setItem(`teleprompter.${key}`, String(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
