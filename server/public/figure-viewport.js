const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function mountFigureViewport(stage, figure) {
  const controls = stage.parentElement;
  const zoomIn = controls.querySelector("#figure-zoom-in");
  const zoomOut = controls.querySelector("#figure-zoom-out");
  const reset = controls.querySelector("#figure-reset");
  const level = controls.querySelector("#figure-zoom-level");
  const pointers = new Map();
  const view = { scale: 1, x: 0, y: 0 };
  let base = null;
  let lastPinch = null;

  function currentSvg() {
    return figure.contentDocument?.querySelector("svg") || null;
  }

  function render() {
    const svg = currentSvg();
    if (svg && !base) {
      const original = svg.viewBox.baseVal;
      base = {
        x: original.x,
        y: original.y,
        width: original.width,
        height: original.height,
      };
    }
    if (svg && base) {
      const width = base.width / view.scale;
      const height = base.height / view.scale;
      view.x = Math.max(base.x, Math.min(base.x + base.width - width, view.x));
      view.y = Math.max(base.y, Math.min(base.y + base.height - height, view.y));
      svg.setAttribute("viewBox", `${view.x} ${view.y} ${width} ${height}`);
    }
    level.value = `${Math.round(view.scale * 100)}%`;
    zoomOut.disabled = view.scale <= MIN_ZOOM;
    zoomIn.disabled = view.scale >= MAX_ZOOM;
    reset.disabled =
      view.scale === MIN_ZOOM &&
      view.x === (base?.x || 0) &&
      view.y === (base?.y || 0);
  }

  function zoomAt(factor, x, y) {
    if (!base) return;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor));
    const fractionX = Math.max(0, Math.min(1, x / stage.clientWidth));
    const fractionY = Math.max(0, Math.min(1, y / stage.clientHeight));
    const anchorX = view.x + fractionX * (base.width / view.scale);
    const anchorY = view.y + fractionY * (base.height / view.scale);
    view.x = anchorX - fractionX * (base.width / next);
    view.y = anchorY - fractionY * (base.height / next);
    view.scale = next;
    render();
  }

  function pan(dx, dy) {
    if (!base) return;
    view.x -= (dx / stage.clientWidth) * (base.width / view.scale);
    view.y -= (dy / stage.clientHeight) * (base.height / view.scale);
    render();
  }

  function resetView() {
    view.scale = 1;
    view.x = base?.x || 0;
    view.y = base?.y || 0;
    render();
  }

  function relative(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function pinch() {
    const [a, b] = [...pointers.values()];
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }

  zoomIn.addEventListener("click", () =>
    zoomAt(1.25, stage.clientWidth / 2, stage.clientHeight / 2),
  );
  zoomOut.addEventListener("click", () =>
    zoomAt(1 / 1.25, stage.clientWidth / 2, stage.clientHeight / 2),
  );
  reset.addEventListener("click", resetView);

  stage.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const point = relative(event.clientX, event.clientY);
      zoomAt(Math.exp(-event.deltaY * 0.0015), point.x, point.y);
    },
    { passive: false },
  );

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = relative(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
    lastPinch = pointers.size === 2 ? pinch() : null;
  });

  stage.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = relative(event.clientX, event.clientY);
    pointers.set(event.pointerId, current);
    if (pointers.size === 1) {
      pan(current.x - previous.x, current.y - previous.y);
    } else if (pointers.size === 2) {
      const next = pinch();
      if (lastPinch?.distance > 0) {
        pan(next.x - lastPinch.x, next.y - lastPinch.y);
        zoomAt(next.distance / lastPinch.distance, next.x, next.y);
      }
      lastPinch = next;
    }
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (!pointers.size) stage.classList.remove("is-dragging");
    lastPinch = pointers.size === 2 ? pinch() : null;
  }
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  stage.addEventListener("lostpointercapture", endPointer);

  stage.addEventListener("keydown", (event) => {
    const centerX = stage.clientWidth / 2;
    const centerY = stage.clientHeight / 2;
    if (event.key === "+" || event.key === "=") zoomAt(1.25, centerX, centerY);
    else if (event.key === "-") zoomAt(1 / 1.25, centerX, centerY);
    else if (event.key === "0") resetView();
    else if (event.key === "ArrowLeft") pan(-36, 0);
    else if (event.key === "ArrowRight") pan(36, 0);
    else if (event.key === "ArrowUp") pan(0, -36);
    else if (event.key === "ArrowDown") pan(0, 36);
    else return;
    event.preventDefault();
  });

  figure.addEventListener("load", () => {
    base = null;
    resetView();
  });
  new ResizeObserver(render).observe(stage);
  render();
}
