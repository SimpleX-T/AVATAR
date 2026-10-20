const slides = [...document.querySelectorAll(".slide")];
const deck = document.querySelector("#deck");
const number = document.querySelector("#currentSlide");
const title = document.querySelector("#currentTitle");
let current = 0;

window.mermaid?.initialize({
  startOnLoad: true,
  securityLevel: "loose",
  theme: "base",
  flowchart: { htmlLabels: true, curve: "stepAfter", useMaxWidth: true },
  sequence: { useMaxWidth: true, wrap: true, mirrorActors: false },
  themeVariables: {
    fontFamily: "IBM Plex Mono, Courier New, monospace",
    fontSize: "18px",
    primaryColor: "#fffdf5",
    primaryTextColor: "#11110f",
    primaryBorderColor: "#11110f",
    lineColor: "#11110f",
    secondaryColor: "#b9f34a",
    tertiaryColor: "#f4f0e6",
    actorBkg: "#fffdf5",
    actorBorder: "#11110f",
    actorTextColor: "#11110f",
    signalColor: "#11110f",
    signalTextColor: "#11110f",
    labelBoxBkgColor: "#f4f0e6",
    labelBoxBorderColor: "#11110f",
  },
});

function setCurrent(index, shouldScroll = true, behavior = "smooth") {
  current = Math.max(0, Math.min(slides.length - 1, index));
  number.textContent = String(current + 1);
  title.textContent = slides[current].dataset.title;
  history.replaceState(null, "", `#${current + 1}`);
  if (shouldScroll) slides[current].scrollIntoView({ behavior, block: "start" });
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) setCurrent(slides.indexOf(entry.target), false);
  }
}, { root: deck, threshold: 0.65 });
slides.forEach((slide) => observer.observe(slide));

document.querySelector("#previousButton").addEventListener("click", () => setCurrent(current - 1));
document.querySelector("#nextButton").addEventListener("click", () => setCurrent(current + 1));
document.querySelector("#presentButton").addEventListener("click", () => document.documentElement.requestFullscreen?.());

window.addEventListener("keydown", (event) => {
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    setCurrent(current + 1);
  } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    setCurrent(current - 1);
  } else if (event.key === "Home") setCurrent(0);
  else if (event.key === "End") setCurrent(slides.length - 1);
  else if (event.key.toLowerCase() === "f") document.documentElement.requestFullscreen?.();
});

const requested = Number(location.hash.slice(1)) - 1;
setCurrent(Number.isInteger(requested) && requested >= 0 ? requested : 0, true, "auto");
