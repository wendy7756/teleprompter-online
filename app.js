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
  letterSpacing: clamp(Number(localStorage.getItem("teleprompter.letterSpacing")) || 0, 0, 8),
  textColor: localStorage.getItem("teleprompter.textColor") || "#ffffff",
  backgroundColor: localStorage.getItem("teleprompter.backgroundColor") || "#05070a",
  align: localStorage.getItem("teleprompter.align") || "left",
  flipX: localStorage.getItem("teleprompter.flipX") === "true",
  flipY: localStorage.getItem("teleprompter.flipY") === "true",
  overlayWidth: Number(localStorage.getItem("teleprompter.overlayWidth")) || 520,
  overlayHeight: Number(localStorage.getItem("teleprompter.overlayHeight")) || 280,
  overlayCenterXRatio: clamp(Number(localStorage.getItem("teleprompter.overlayCenterXRatio")) || 0.5, 0, 1),
  overlayCenterYRatio: clamp(Number(localStorage.getItem("teleprompter.overlayCenterYRatio")) || 0.5, 0, 1),
  scrollOffset: 0,
  playing: false,
  recording: false,
  lastTick: 0,
  cameraStream: null,
  audioStream: null,
  recorder: null,
  recordedChunks: [],
  drawLoop: 0,
  drag: null,
  activePreset: localStorage.getItem("teleprompter.activePreset") || "center",
  voiceListening: false,
  speechRecognition: null,
  restartingSpeech: false
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
  cameraToggleWrap: document.getElementById("cameraToggleWrap"),
  cameraToggle: document.getElementById("cameraToggle"),
  voiceControlWrap: document.getElementById("voiceControlWrap"),
  voiceToggleButton: document.getElementById("voiceToggleButton"),
  voiceHelpButton: document.getElementById("voiceHelpButton"),
  closePanelButton: document.getElementById("closePanelButton"),
  scriptModal: document.getElementById("scriptModal"),
  voiceModal: document.getElementById("voiceModal"),
  saveScriptButton: document.getElementById("saveScriptButton"),
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
  overlayCenterXInput: document.getElementById("overlayCenterXInput"),
  overlayCenterYInput: document.getElementById("overlayCenterYInput"),
  speedValue: document.getElementById("speedValue"),
  fontValue: document.getElementById("fontValue"),
  lineValue: document.getElementById("lineValue"),
  widthValue: document.getElementById("widthValue"),
  overlayWidthValue: document.getElementById("overlayWidthValue"),
  overlayHeightValue: document.getElementById("overlayHeightValue"),
  overlayCenterXValue: document.getElementById("overlayCenterXValue"),
  overlayCenterYValue: document.getElementById("overlayCenterYValue"),
  playButton: document.getElementById("playButton"),
  restartButton: document.getElementById("restartButton"),
  previousButton: document.getElementById("previousButton"),
  nextButton: document.getElementById("nextButton"),
  speedButton: document.getElementById("speedButton"),
  textButton: document.getElementById("textButton"),
  recordButton: document.getElementById("recordButton"),
  recordControls: document.getElementById("recordControls"),
  downloadLink: document.getElementById("downloadLink"),
  countdown: document.getElementById("countdown")
};

const playSvg = '<svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const pauseSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14"/><path d="M15 5v14"/></svg>';

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
  els.settingsButton?.addEventListener("click", () => els.body.classList.toggle("panel-collapsed"));
  els.closePanelButton?.addEventListener("click", () => els.body.classList.add("panel-collapsed"));
  els.scriptButton.addEventListener("click", openScriptModal);
  els.voiceToggleButton.addEventListener("click", toggleVoiceControl);
  els.voiceHelpButton.addEventListener("click", openVoiceModal);
  els.saveScriptButton.addEventListener("click", saveScriptFromModal);
  document.querySelectorAll("[data-close-script]").forEach((button) => {
    button.addEventListener("click", closeScriptModal);
  });
  document.querySelectorAll("[data-close-voice]").forEach((button) => {
    button.addEventListener("click", closeVoiceModal);
  });
  els.scriptModal.addEventListener("click", (event) => {
    if (event.target === els.scriptModal) closeScriptModal();
  });
  els.voiceModal.addEventListener("click", (event) => {
    if (event.target === els.voiceModal) closeVoiceModal();
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

  els.cameraToggle.addEventListener("change", toggleCameraFromSwitch);
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
  bindRange(els.widthInput, "letterSpacing", 0, 8, updateLabels);
  bindRange(els.overlayWidthInput, "overlayWidth", 260, 1100, updateOverlay);
  bindRange(els.overlayHeightInput, "overlayHeight", 160, 760, updateOverlay);
  bindOverlayCenter(els.overlayCenterXInput, "x");
  bindOverlayCenter(els.overlayCenterYInput, "y");

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
    updateVideoFrame();
    if (state.mode === "recording" && !state.drag) {
      applyOverlayCenterFromState();
      updateOverlayControls();
      return;
    }
    clampOverlay();
    render();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.scriptModal.hidden) {
      closeScriptModal();
      return;
    }
    if (event.key === "Escape" && !els.voiceModal.hidden) {
      closeVoiceModal();
      return;
    }
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

function openScriptModal() {
  els.scriptInput.value = state.script;
  els.scriptModal.hidden = false;
  requestAnimationFrame(() => els.scriptInput.focus());
}

function closeScriptModal() {
  els.scriptModal.hidden = true;
}

function openVoiceModal() {
  els.voiceModal.hidden = false;
}

function closeVoiceModal() {
  els.voiceModal.hidden = true;
}

function saveScriptFromModal() {
  state.script = els.scriptInput.value;
  state.scrollOffset = 0;
  save("script", state.script);
  render();
  closeScriptModal();
}

function toggleVoiceControl() {
  if (state.voiceListening) {
    stopVoiceControl();
  } else {
    startVoiceControl();
  }
}

function startVoiceControl() {
  if (state.mode !== "teleprompter") return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Voice control is not supported in this browser. Try Chrome or Edge.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      if (event.results[i].isFinal) {
        handleVoiceTranscript(event.results[i][0].transcript);
      }
    }
  };
  recognition.onerror = () => {
    stopVoiceControl();
  };
  recognition.onend = () => {
    if (state.voiceListening && state.mode === "teleprompter" && !state.restartingSpeech) {
      state.restartingSpeech = true;
      setTimeout(() => {
        state.restartingSpeech = false;
        try {
          recognition.start();
        } catch {
          stopVoiceControl();
        }
      }, 250);
    }
  };

  state.speechRecognition = recognition;
  state.voiceListening = true;
  updateVoiceControlUI();
  try {
    recognition.start();
  } catch {
    stopVoiceControl();
  }
}

function stopVoiceControl() {
  state.voiceListening = false;
  state.restartingSpeech = false;
  if (state.speechRecognition) {
    try {
      state.speechRecognition.stop();
    } catch {
      // Recognition may already be stopped.
    }
  }
  state.speechRecognition = null;
  updateVoiceControlUI();
}

function updateVoiceControlUI() {
  els.voiceControlWrap.classList.toggle("is-listening", state.voiceListening);
  els.voiceToggleButton.title = state.voiceListening ? "Voice control on" : "Voice control off";
  els.voiceToggleButton.setAttribute("aria-label", state.voiceListening ? "Voice control on" : "Voice control off");
}

function handleVoiceTranscript(transcript) {
  const text = transcript.toLowerCase().trim();
  if (/\bnext\b/.test(text)) {
    jumpLines(3);
  } else if (/\b(previous|back)\b/.test(text)) {
    jumpLines(-3);
  } else if (/\b(pause|stop)\b/.test(text)) {
    state.playing = false;
    els.playButton.innerHTML = playSvg;
  } else if (/\b(continue|resume|start|play)\b/.test(text)) {
    startPlayingImmediately();
  } else if (/\brestart\b/.test(text)) {
    state.scrollOffset = -lineStep();
    startPlayingImmediately();
  }
}

function startPlayingImmediately() {
  state.playing = true;
  state.lastTick = performance.now();
  els.playButton.innerHTML = pauseSvg;
}

function hydrateControls() {
  els.scriptInput.value = state.script;
  els.speedInput.value = state.wpm;
  els.fontInput.value = state.fontSize;
  els.lineInput.value = state.lineSpacing;
  els.widthInput.value = state.letterSpacing;
  els.textColorInput.value = state.textColor;
  els.backgroundColorInput.value = state.backgroundColor;
  els.flipXInput.checked = state.flipX;
  els.flipYInput.checked = state.flipY;
  els.overlayWidthInput.value = state.overlayWidth;
  els.overlayHeightInput.value = state.overlayHeight;
  updateOverlayControls();
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

function bindOverlayCenter(input, axis) {
  input.addEventListener("input", () => {
    const frame = getVideoFrameRect();
    const value = Number(input.value);
    if (axis === "x") {
      state.overlayCenterXRatio = clamp(value / frame.width, 0, 1);
      save("overlayCenterXRatio", state.overlayCenterXRatio);
    } else {
      state.overlayCenterYRatio = clamp(value / frame.height, 0, 1);
      save("overlayCenterYRatio", state.overlayCenterYRatio);
    }
    state.activePreset = "custom";
    save("activePreset", state.activePreset);
    applyOverlayCenterFromState();
    updateOverlayControls();
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
  updateVideoFrame();
  els.cameraToggleWrap.hidden = mode !== "recording";
  if (mode === "recording") {
    stopVoiceControl();
  }
  els.playButton.innerHTML = playSvg;
  if (mode === "recording") {
    if (state.activePreset === "custom") {
      applyOverlayCenterFromState();
      updateOverlayControls();
    } else {
      applyPreset(state.activePreset || "center");
    }
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
    els.playButton.innerHTML = playSvg;
    return;
  }
  startCountdown(() => {
    state.playing = true;
    state.lastTick = performance.now();
    els.playButton.innerHTML = pauseSvg;
  });
}

function restart() {
  state.scrollOffset = -lineStep();
  state.playing = false;
  els.playButton.innerHTML = playSvg;
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
      els.playButton.innerHTML = playSvg;
    }
    return;
  }

  const end = maxScrollOffset();
  if (state.scrollOffset >= end) {
    state.scrollOffset = end;
    state.playing = false;
    els.playButton.innerHTML = playSvg;
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
  els.prompterContent.style.width = "100%";
  els.prompterContent.style.letterSpacing = `${state.letterSpacing}px`;
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
  els.widthValue.textContent = `${Number(state.letterSpacing).toFixed(1)} px`;
  els.overlayWidthValue.textContent = `${Math.round(state.overlayWidth)} px`;
  els.overlayHeightValue.textContent = `${Math.round(state.overlayHeight)} px`;
  const frame = getVideoFrameRect();
  els.overlayCenterXValue.textContent = `${Math.round(state.overlayCenterXRatio * frame.width)} px`;
  els.overlayCenterYValue.textContent = `${Math.round(state.overlayCenterYRatio * frame.height)} px`;
}

function updateOverlay() {
  fitOverlayToVideoFrame();
  els.prompterLayer.style.width = `${state.overlayWidth}px`;
  els.prompterLayer.style.height = `${state.overlayHeight}px`;
  els.overlayWidthInput.value = state.overlayWidth;
  els.overlayHeightInput.value = state.overlayHeight;
  save("overlayWidth", state.overlayWidth);
  save("overlayHeight", state.overlayHeight);
  applyOverlayCenterFromState();
  updateOverlayControls();
  updateLabels();
}

function updateOverlayControls() {
  const frame = getVideoFrameRect();
  const centerX = Math.round(state.overlayCenterXRatio * frame.width);
  const centerY = Math.round(state.overlayCenterYRatio * frame.height);
  els.overlayCenterXInput.max = Math.round(frame.width);
  els.overlayCenterYInput.max = Math.round(frame.height);
  els.overlayCenterXInput.value = centerX;
  els.overlayCenterYInput.value = centerY;
  els.overlayCenterXValue.textContent = `${centerX} px`;
  els.overlayCenterYValue.textContent = `${centerY} px`;
}

async function startCamera() {
  if (state.cameraStream) {
    stopCamera();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 3840 },
        height: { ideal: 2160 },
        frameRate: { ideal: 60 }
      },
      audio: true
    });
    await preferHighestCameraResolution(stream);
    state.cameraStream = stream;
    els.cameraPreview.srcObject = stream;
    await els.cameraPreview.play();
    await waitForVideoMetadata();
    syncRecordCanvasResolution();
    updateVideoFrame();
    els.cameraToggle.checked = true;
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
  els.cameraToggle.checked = false;
  cancelAnimationFrame(state.drawLoop);
}

async function toggleCameraFromSwitch() {
  if (els.cameraToggle.checked) {
    await startCamera();
  } else {
    stopCamera();
  }
}

async function preferHighestCameraResolution(stream) {
  const [track] = stream.getVideoTracks();
  if (!track || typeof track.getCapabilities !== "function") return;
  const capabilities = track.getCapabilities();
  const constraints = {};
  if (capabilities.width?.max) constraints.width = { ideal: capabilities.width.max };
  if (capabilities.height?.max) constraints.height = { ideal: capabilities.height.max };
  if (capabilities.frameRate?.max) constraints.frameRate = { ideal: capabilities.frameRate.max };
  if (!Object.keys(constraints).length) return;
  try {
    await track.applyConstraints(constraints);
  } catch {
    // Some cameras advertise combinations they cannot stream together; keep the browser-selected stream.
  }
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
  els.playButton.innerHTML = pauseSvg;
}

function stopRecording() {
  if (!state.recorder || state.recorder.state === "inactive") return;
  state.recorder.stop();
  state.recording = false;
  state.playing = false;
  els.recordButton.classList.remove("is-recording");
  els.playButton.innerHTML = playSvg;
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

    const frameRect = getVideoFrameRect();
    const layerRect = els.prompterLayer.getBoundingClientRect();
    const scaleX = w / frameRect.width;
    const scaleY = h / frameRect.height;
    const box = {
      x: (layerRect.left - frameRect.pageLeft) * scaleX,
      y: (layerRect.top - frameRect.pageTop) * scaleY,
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
  state.activePreset = "custom";
  save("activePreset", state.activePreset);
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
  syncOverlayCenterFromPosition();
  updateOverlayControls();
}

function endDrag() {
  syncOverlayCenterFromPosition();
  updateOverlayControls();
  state.drag = null;
}

function applyPreset(preset) {
  if (state.mode !== "recording") return;
  state.activePreset = preset;
  save("activePreset", state.activePreset);
  applyPresetLayout(preset);
  updateOverlay();
  const frame = getVideoFrameRect();
  const box = els.prompterLayer.getBoundingClientRect();
  const pad = 44;
  const positions = {
    top: [frame.left + (frame.width - box.width) / 2, frame.top + pad],
    bottom: [frame.left + (frame.width - box.width) / 2, frame.top + frame.height - box.height - pad],
    left: [frame.left + pad, frame.top + (frame.height - box.height) / 2],
    right: [frame.left + frame.width - box.width - pad, frame.top + (frame.height - box.height) / 2],
    center: [frame.left + (frame.width - box.width) / 2, frame.top + (frame.height - box.height) / 2]
  };
  const [left, top] = positions[preset] || positions.center;
  els.prompterLayer.style.left = `${left}px`;
  els.prompterLayer.style.top = `${top}px`;
  clampOverlay();
  syncOverlayCenterFromPosition();
  updateOverlayControls();
  render();
}

function applyPresetLayout(preset) {
  const frame = getVideoFrameRect();
  const layouts = {
    top: { width: 0.72, height: 0.24, align: "center" },
    bottom: { width: 0.72, height: 0.24, align: "center" },
    left: { width: 0.32, height: 0.62, align: "left" },
    right: { width: 0.32, height: 0.62, align: "left" },
    center: { width: 0.50, height: 0.34, align: "center" }
  };
  const layout = layouts[preset] || layouts.center;
  state.overlayWidth = Math.round(frame.width * layout.width);
  state.overlayHeight = Math.round(frame.height * layout.height);
  state.align = layout.align;
  save("align", state.align);
  fitOverlayToVideoFrame();
}

function clampOverlay() {
  if (state.mode !== "recording") return;
  const frame = getVideoFrameRect();
  const maxLeft = Math.max(frame.left, frame.left + frame.width - els.prompterLayer.offsetWidth);
  const maxTop = Math.max(frame.top, frame.top + frame.height - els.prompterLayer.offsetHeight);
  const left = clamp(els.prompterLayer.offsetLeft, frame.left, maxLeft);
  const top = clamp(els.prompterLayer.offsetTop, frame.top, maxTop);
  els.prompterLayer.style.left = `${left}px`;
  els.prompterLayer.style.top = `${top}px`;
}

function applyOverlayCenterFromState() {
  if (state.mode !== "recording") return;
  fitOverlayToVideoFrame();
  els.prompterLayer.style.width = `${state.overlayWidth}px`;
  els.prompterLayer.style.height = `${state.overlayHeight}px`;
  const frame = getVideoFrameRect();
  const centerX = frame.left + state.overlayCenterXRatio * frame.width;
  const centerY = frame.top + state.overlayCenterYRatio * frame.height;
  els.prompterLayer.style.left = `${centerX - els.prompterLayer.offsetWidth / 2}px`;
  els.prompterLayer.style.top = `${centerY - els.prompterLayer.offsetHeight / 2}px`;
  clampOverlay();
  syncOverlayCenterFromPosition();
}

function syncOverlayCenterFromPosition() {
  if (state.mode !== "recording") return;
  const frame = getVideoFrameRect();
  const centerX = els.prompterLayer.offsetLeft + els.prompterLayer.offsetWidth / 2 - frame.left;
  const centerY = els.prompterLayer.offsetTop + els.prompterLayer.offsetHeight / 2 - frame.top;
  state.overlayCenterXRatio = clamp(centerX / frame.width, 0, 1);
  state.overlayCenterYRatio = clamp(centerY / frame.height, 0, 1);
  save("overlayCenterXRatio", state.overlayCenterXRatio);
  save("overlayCenterYRatio", state.overlayCenterYRatio);
}

function fitOverlayToVideoFrame() {
  const frame = getVideoFrameRect();
  const maxWidth = Math.max(180, Math.floor(frame.width - 32));
  const maxHeight = Math.max(120, Math.floor(frame.height - 32));
  const preferredWidth = Math.round(frame.width * 0.42);
  const preferredHeight = Math.round(frame.height * 0.32);
  state.overlayWidth = clamp(state.overlayWidth || preferredWidth, 180, maxWidth);
  state.overlayHeight = clamp(state.overlayHeight || preferredHeight, 120, maxHeight);
}

function updateVideoFrame() {
  const frame = getVideoFrameRect();
  els.stage.style.setProperty("--video-left", `${frame.left}px`);
  els.stage.style.setProperty("--video-top", `${frame.top}px`);
  els.stage.style.setProperty("--video-width", `${frame.width}px`);
  els.stage.style.setProperty("--video-height", `${frame.height}px`);
}

function getVideoFrameRect() {
  const stageRect = els.stage.getBoundingClientRect();
  const targetRatio = 16 / 9;
  if (state.mode === "recording") {
    const width = stageRect.width;
    const height = width / targetRatio;
    return {
      left: 0,
      top: 0,
      width,
      height,
      pageLeft: stageRect.left,
      pageTop: stageRect.top
    };
  }
  let width = stageRect.width;
  let height = width / targetRatio;
  if (height > stageRect.height) {
    height = stageRect.height;
    width = height * targetRatio;
  }
  return {
    left: (stageRect.width - width) / 2,
    top: (stageRect.height - height) / 2,
    width,
    height,
    pageLeft: stageRect.left + (stageRect.width - width) / 2,
    pageTop: stageRect.top + (stageRect.height - height) / 2
  };
}

function waitForVideoMetadata() {
  if (els.cameraPreview.videoWidth && els.cameraPreview.videoHeight) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    els.cameraPreview.addEventListener("loadedmetadata", resolve, { once: true });
  });
}

function syncRecordCanvasResolution() {
  const vw = els.cameraPreview.videoWidth || 1280;
  const vh = els.cameraPreview.videoHeight || 720;
  const targetRatio = 16 / 9;
  let width = vw;
  let height = Math.round(width / targetRatio);
  if (height > vh) {
    height = vh;
    width = Math.round(height * targetRatio);
  }
  els.recordCanvas.width = makeEven(width);
  els.recordCanvas.height = makeEven(height);
}

function makeEven(value) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function save(key, value) {
  localStorage.setItem(`teleprompter.${key}`, String(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
