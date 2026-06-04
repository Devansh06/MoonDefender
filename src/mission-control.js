import { els } from "./state.js";

const TYPEWRITER_SPEED = 30; // characters per second

let typewriterTimer = null;
let hideTimer = null;

function getFemaleVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v =>
    /female|woman|samantha|karen|zira|victoria|moira|fiona|tessa/i.test(v.name)
  ) || voices.find(v => v.lang.startsWith("en")) || null;
}


export const missionControl = {
  speak(text) {
    const bubble = els.mcBubble;
    const textEl  = els.mcText;
    if (!bubble || !textEl) return;

    this.silence();

    bubble.classList.remove("mc-hidden");
    textEl.textContent = "";

    let i = 0;
    typewriterTimer = setInterval(() => {
      textEl.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(typewriterTimer);
    }, 1000 / TYPEWRITER_SPEED);

    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.pitch = 0.78;
      utter.rate  = 0.88;
      const voice = getFemaleVoice();
      if (voice) utter.voice = voice;
      utter.onend = () => {
        hideTimer = setTimeout(() => bubble.classList.add("mc-hidden"), 1400);
      };
      speechSynthesis.speak(utter);
    } else {
      const readMs = Math.max(2000, (text.split(" ").length / 150) * 60000);
      hideTimer = setTimeout(() => bubble.classList.add("mc-hidden"), readMs);
    }
  },

  silence() {
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    els.mcBubble?.classList.add("mc-hidden");
  },

  setIcon(svgString) {
    const icon = els.mcBubble?.querySelector(".mc-icon");
    if (icon) icon.outerHTML = svgString;
  },
};
