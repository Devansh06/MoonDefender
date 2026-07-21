import { els } from "./state.js";

const TYPEWRITER_SPEED = 70;

let typewriterTimer = null;
let hideTimer = null;

// Strip **bold** and {#color:text} markup to plain text for typewriter reveal
function plainText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\{[^:}]+:([^}]+)\}/g, "$1");
}

// Convert **bold** and {#color:text} to HTML for final render (XSS-safe: only ** and {color:} markup allowed)
// Weapon keyword colors applied first so they nest cleanly inside bold and explicit color spans.
function richHtml(text) {
  return text
    .replace(/\b(blast(?:s|er|ers?|ed|ing)?)\b/gi, '{#ffcf70:$1}')
    .replace(/\b(deflect(?:or|ors?|s|ed|ing|ions?)?)\b/gi, '{#d2ffe1:$1}')
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f5e4a0">$1</strong>')
    .replace(/\{([^:}]+):([^}]+)\}/g, '<span style="color:$1">$2</span>')
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
    const readDelay = plain.split("\n").length * 1000;

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
