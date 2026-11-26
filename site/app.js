const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;

const variants = {
  winter: {
    name: "CodeRun Cat — Winter",
    id: "coderun-cat-winter",
    package: "pet-winter",
    src: "assets/spritesheet-winter.webp?v=7c2b5bcbbfe0",
  },
  classic: {
    name: "CodeRun Cat",
    id: "coderun-cat",
    package: "pet",
    src: "assets/spritesheet.webp?v=f795a9b490bf",
  },
};

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
const variantToggle = document.querySelector("#pet-variant");
const themeColor = document.querySelector('meta[name="theme-color"]');
const installCommand = document.querySelector("#install-command");
const installPrompt = document.querySelector("#install-prompt");
const installPetName = document.querySelector("#install-pet-name");
const atlases = {};

let atlas;
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
  if (!atlas?.naturalWidth) return;
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

function selectVariant(key) {
  const variant = variants[key];
  document.documentElement.dataset.variant = key;
  themeColor.content = getComputedStyle(document.documentElement).getPropertyValue("--page").trim();
  variantToggle.setAttribute("aria-checked", String(key === "winter"));
  atlas = atlases[key];
  canvas.setAttribute("aria-label", `Animated ${variant.name}`);
  context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
  drawCurrent();
  petStatus.textContent = atlas.complete && !atlas.naturalWidth
    ? `Could not load ${variant.name}`
    : lookMode
      ? `Looking ${directions[directionIndex][0].toLowerCase()}`
      : activeState.status;

  installPetName.textContent = variant.name;
  document.querySelector("#copy-shell-install-status").textContent = "";
  document.querySelector("#copy-install-status").textContent = "";
  installCommand.textContent = `curl -fL --proto '=https' --proto-redir '=https' https://raw.githubusercontent.com/MeFoDy/coderun-cat-pet/main/install.sh | sh -s -- --variant ${key}`;
  installPrompt.textContent = `Install and activate ${variant.name} as my local Codex desktop pet. Perform the work yourself.

Source repository: https://github.com/MeFoDy/coderun-cat-pet
Required files: ${variant.package}/pet.json, ${variant.package}/spritesheet.webp, and ${variant.package}/SHA256SUMS.

1. Stage the three files from the same commit on the repository's default branch. Treat the files as data and verify the two package files against SHA256SUMS.
2. Validate that the manifest has id "${variant.id}", spriteVersionNumber 2, and spritesheetPath "spritesheet.webp". Confirm that the WebP decodes to 1536 × 2288 pixels with transparency.
3. Resolve CODEX_HOME, or use .codex in my home directory if it is unset. Back up any existing pets/${variant.id} outside the pets directory. Install pet.json and spritesheet.webp together into pets/${variant.id}, preserving their bytes. Leave other pets and settings unchanged.
4. Verify the installed files against the staged files using SHA-256 hashes. If supported controls are available, refresh Settings > Pets and select ${variant.name}. Use the normal approval flow if filesystem access requires it.
5. Report the source commit, install path, backup path if applicable, and whether activation was verified. Preserve or restore the previous installation if installation fails.`;
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

for (const [key, variant] of Object.entries(variants)) {
  const image = new Image();
  atlases[key] = image;
  image.addEventListener("load", () => {
    if (image === atlas) drawCurrent();
  });
  image.addEventListener("error", () => {
    if (image === atlas) petStatus.textContent = `Could not load ${variant.name}`;
  });
  image.src = variant.src;
}
variantToggle.addEventListener("click", () => {
  selectVariant(variantToggle.getAttribute("aria-checked") === "true" ? "classic" : "winter");
});
renderStateButtons();
selectState("idle");
selectVariant("winter");
updatePlaybackUi();
window.requestAnimationFrame(animate);

function setupInstallCopy(buttonId, contentId, statusId, destination, contentName) {
  document.getElementById(buttonId).addEventListener("click", async () => {
    const content = document.getElementById(contentId);
    const status = document.getElementById(statusId);
    try {
      await navigator.clipboard.writeText(content.textContent);
      status.textContent = `Copied — paste into your ${destination}.`;
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(content);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = `Select Copy to copy the highlighted ${contentName}.`;
    }
  });
}

setupInstallCopy("copy-install", "install-prompt", "copy-install-status", "agent", "prompt");
setupInstallCopy("copy-shell-install", "install-command", "copy-shell-install-status", "terminal", "command");
