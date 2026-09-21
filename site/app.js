const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;

const states = [
  {
    id: "idle",
    label: "Idle",
    row: 0,
    frames: 6,
    durations: [280, 110, 110, 140, 140, 320],
    status: "Ready to help",
    description: "Calm breathing and a tiny blink while Codex is ready.",
  },
  {
    id: "running-right",
    label: "Move right",
    row: 1,
    frames: 8,
    durations: [120, 120, 120, 120, 120, 120, 120, 220],
    status: "Moving with your window",
    description: "A full directional walk cycle for dragging the pet to the right.",
  },
  {
    id: "running-left",
    label: "Move left",
    row: 2,
    frames: 8,
    durations: [120, 120, 120, 120, 120, 120, 120, 220],
    status: "Moving with your window",
    description: "The mirrored directional cycle used while travelling to the left.",
  },
  {
    id: "waving",
    label: "Wave",
    row: 3,
    frames: 4,
    durations: [140, 140, 140, 280],
    status: "Hello from CodeRun",
    description: "A compact greeting with a raised paw and the canonical pixel smile.",
  },
  {
    id: "jumping",
    label: "Jump",
    row: 4,
    frames: 5,
    durations: [140, 140, 140, 140, 280],
    status: "Task complete!",
    description: "A restrained celebratory jump that keeps the cat's proportions stable.",
  },
  {
    id: "failed",
    label: "Failed",
    row: 5,
    frames: 8,
    durations: [140, 140, 140, 140, 140, 140, 140, 240],
    status: "That did not work",
    description: "A tired coffee-and-laptop reaction for failed or cancelled work.",
  },
  {
    id: "waiting",
    label: "Waiting",
    row: 6,
    frames: 6,
    durations: [150, 150, 150, 150, 150, 260],
    status: "Waiting for your input",
    description: "CodeRun Cat pauses with the blue book until you are ready.",
  },
  {
    id: "running",
    label: "Working",
    row: 7,
    frames: 6,
    durations: [120, 120, 120, 120, 120, 220],
    status: "Working on your task",
    description: "Quiet active work under a blanket, paws moving at the laptop.",
  },
  {
    id: "review",
    label: "Review",
    row: 8,
    frames: 6,
    durations: [150, 150, 150, 150, 150, 280],
    status: "Reviewing the result",
    description: "A focused inspection pose for checking completed output.",
  },
];

const directions = [
  ["Up", "000°", "↑"],
  ["Up-right", "022.5°", "↗"],
  ["Up-right", "045°", "↗"],
  ["Up-right", "067.5°", "↗"],
  ["Right", "090°", "→"],
  ["Down-right", "112.5°", "↘"],
  ["Down-right", "135°", "↘"],
  ["Down-right", "157.5°", "↘"],
  ["Down", "180°", "↓"],
  ["Down-left", "202.5°", "↙"],
  ["Down-left", "225°", "↙"],
  ["Down-left", "247.5°", "↙"],
  ["Left", "270°", "←"],
  ["Up-left", "292.5°", "↖"],
  ["Up-left", "315°", "↖"],
  ["Up-left", "337.5°", "↖"],
];

const demoSequence = [
  ["idle", 1800],
  ["running", 2800],
  ["waiting", 2200],
  ["review", 2200],
  ["jumping", 1700],
  ["waving", 1900],
  ["failed", 2300],
];

const canvas = document.querySelector("#pet-canvas");
const context = canvas.getContext("2d");
const stage = document.querySelector("#pet-stage");
const stateGrid = document.querySelector("#state-grid");
const stateTitle = document.querySelector("#state-title");
const stateDescription = document.querySelector("#state-description");
const petStatus = document.querySelector("#pet-status");
const windowState = document.querySelector("#window-state");
const playToggle = document.querySelector("#play-toggle");
const playIcon = document.querySelector("#play-icon");
const frameScrubber = document.querySelector("#frame-scrubber");
const frameOutput = document.querySelector("#frame-output");
const speedSelect = document.querySelector("#speed");
const demoToggle = document.querySelector("#demo-toggle");
const directionSlider = document.querySelector("#direction-slider");
const directionName = document.querySelector("#direction-name");
const directionDegrees = document.querySelector("#direction-degrees");
const directionArrow = document.querySelector("#direction-arrow");
const pointerLook = document.querySelector("#pointer-look");

const atlas = new Image();
atlas.src = "assets/spritesheet.webp?v=0b8d402d0b4f";

let activeState = states[0];
let frame = 0;
let directionIndex = 0;
let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let speed = 1;
let lastFrameAt = 0;
let demoTimer = null;
let demoStep = 0;
let lookMode = false;

context.imageSmoothingEnabled = false;

function drawCell(row, column) {
  if (!atlas.complete || atlas.naturalWidth === 0) return;
  context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
  context.drawImage(
    atlas,
    column * CELL_WIDTH,
    row * CELL_HEIGHT,
    CELL_WIDTH,
    CELL_HEIGHT,
    0,
    0,
    CELL_WIDTH,
    CELL_HEIGHT,
  );
}

function drawCurrent() {
  if (lookMode) {
    const row = directionIndex < 8 ? 9 : 10;
    drawCell(row, directionIndex % 8);
  } else {
    drawCell(activeState.row, frame);
  }
}

function updateFrameUi() {
  frameScrubber.max = String(activeState.frames - 1);
  frameScrubber.value = String(frame);
  frameOutput.value = `${frame + 1} / ${activeState.frames}`;
}

function renderStateButtons() {
  stateGrid.textContent = "";
  states.forEach((state) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "state-button";
    button.dataset.state = state.id;
    button.innerHTML = `${state.label}<span>${state.frames} frames</span>`;
    button.addEventListener("click", () => {
      stopDemo();
      selectState(state.id);
    });
    stateGrid.append(button);
  });
}

function selectState(id) {
  const next = states.find((state) => state.id === id);
  if (!next) return;

  activeState = next;
  frame = 0;
  lookMode = false;
  pointerLook.checked = false;
  stateTitle.textContent = next.label;
  stateDescription.textContent = next.description;
  petStatus.textContent = next.status;
  windowState.textContent = next.id;
  updateFrameUi();

  document.querySelectorAll(".state-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.state === id);
    button.setAttribute("aria-pressed", String(button.dataset.state === id));
  });
  drawCurrent();
}

function setDirection(index) {
  directionIndex = ((Number(index) % 16) + 16) % 16;
  lookMode = true;
  const [name, degrees, arrow] = directions[directionIndex];
  directionSlider.value = String(directionIndex);
  directionName.textContent = name;
  directionDegrees.textContent = degrees;
  directionArrow.textContent = arrow;
  windowState.textContent = `look ${degrees}`;
  petStatus.textContent = `Looking ${name.toLowerCase()}`;
  document.querySelectorAll(".state-button").forEach((button) => {
    button.classList.remove("is-active");
    button.setAttribute("aria-pressed", "false");
  });
  drawCurrent();
}

function updatePlaybackUi() {
  const isAnimating = playing && !lookMode;
  playIcon.textContent = isAnimating ? "Ⅱ" : "▶";
  playToggle.setAttribute(
    "aria-label",
    isAnimating ? "Pause animation" : "Play animation",
  );
}

function stopDemo() {
  if (demoTimer !== null) {
    window.clearTimeout(demoTimer);
    demoTimer = null;
  }
  demoToggle.classList.remove("is-active");
  demoToggle.textContent = "Run live demo";
}

function runDemoStep() {
  const [stateId, duration] = demoSequence[demoStep % demoSequence.length];
  selectState(stateId);
  demoStep += 1;
  demoTimer = window.setTimeout(runDemoStep, duration);
}

function toggleDemo() {
  if (demoTimer !== null) {
    stopDemo();
    return;
  }
  demoStep = 0;
  playing = true;
  updatePlaybackUi();
  demoToggle.classList.add("is-active");
  demoToggle.textContent = "Stop demo";
  runDemoStep();
}

function animate(timestamp) {
  if (playing && !lookMode) {
    const interval = activeState.durations[frame] / speed;
    if (timestamp - lastFrameAt >= interval) {
      frame = (frame + 1) % activeState.frames;
      lastFrameAt = timestamp;
      updateFrameUi();
      drawCurrent();
    }
  }
  window.requestAnimationFrame(animate);
}

playToggle.addEventListener("click", () => {
  if (lookMode) {
    playing = true;
    selectState(activeState.id);
    updatePlaybackUi();
    return;
  }
  playing = !playing;
  updatePlaybackUi();
});

frameScrubber.addEventListener("input", () => {
  stopDemo();
  lookMode = false;
  frame = Number(frameScrubber.value);
  playing = false;
  updatePlaybackUi();
  updateFrameUi();
  drawCurrent();
});

speedSelect.addEventListener("change", () => {
  speed = Number(speedSelect.value);
});

demoToggle.addEventListener("click", toggleDemo);

directionSlider.addEventListener("input", () => {
  stopDemo();
  pointerLook.checked = false;
  setDirection(Number(directionSlider.value));
});

pointerLook.addEventListener("change", () => {
  stopDemo();
  if (!pointerLook.checked) selectState(activeState.id);
});

stage.addEventListener("pointermove", (event) => {
  if (!pointerLook.checked) return;
  const bounds = stage.getBoundingClientRect();
  const dx = event.clientX - (bounds.left + bounds.width / 2);
  const dy = event.clientY - (bounds.top + bounds.height / 2);
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const normalized = (degrees + 360) % 360;
  setDirection(Math.round(normalized / 22.5) % 16);
});

atlas.addEventListener("load", () => {
  renderStateButtons();
  selectState("idle");
  updatePlaybackUi();
  window.requestAnimationFrame(animate);
});

atlas.addEventListener("error", () => {
  petStatus.textContent = "Could not load spritesheet.webp";
});

document.getElementById("copy-install").addEventListener("click", async () => {
  const prompt = document.getElementById("install-prompt");
  const status = document.getElementById("copy-install-status");
  try {
    await navigator.clipboard.writeText(prompt.textContent);
    status.textContent = "Copied — paste into your agent.";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(prompt);
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = "Select Copy to copy the highlighted prompt.";
  }
});
