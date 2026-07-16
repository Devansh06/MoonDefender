import { els } from "./state.js";

const TYPEWRITER_SPEED = 70;

let typewriterTimer = null;
let hideTimer = null;

// Strip **bold** markup to plain text for typewriter reveal
function plainText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
}

// Convert **bold** to <strong> for final render (XSS-safe: only ** markup allowed)
function richHtml(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

export const missionControl = {
  isSpeaking: false,
  _speakGen: 0,

  speak(text) {
    const bubble = els.mcBubble;
    const textEl  = els.mcText;
    if (!bubble || !textEl) return;

    this.silence();
    this.isSpeaking = true;
    const myGen = ++this._speakGen;

    bubble.classList.remove("mc-hidden");
    textEl.textContent = "";

    const plain = plainText(text);
    const words = plain.split(/\s+/).length;
    const readDelay = Math.max(1500, words * 350);

    let i = 0;
    typewriterTimer = setInterval(() => {
      ++i;
      const typed = plain.slice(0, i).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
      textEl.innerHTML = `<span class="mc-typing">${typed}</span>`;
      if (i >= plain.length) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
        // Snap to rich HTML once typing is complete
        textEl.innerHTML = richHtml(text);
        hideTimer = setTimeout(() => {
          if (myGen !== this._speakGen) return;
          this.isSpeaking = false;
          hideTimer = setTimeout(() => bubble.classList.add("mc-hidden"), 800);
        }, readDelay);
      }
    }, 1000 / TYPEWRITER_SPEED);
  },

  silence() {
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    this._speakGen += 1;
    this.isSpeaking = false;
    els.mcBubble?.classList.add("mc-hidden");
  },

};
