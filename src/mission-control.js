import { els } from "./state.js";

const TYPEWRITER_SPEED = 30;
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

let typewriterTimer = null;
let hideTimer = null;
let audioCtx = null;
let currentSource = null;
let activeUtterance = null;

export const missionControl = {
  isSpeaking: false,

  getKey() {
    return localStorage.getItem("mc_el_key") || "";
  },

  async speak(text) {
    const bubble = els.mcBubble;
    const textEl  = els.mcText;
    if (!bubble || !textEl) return;

    this.silence();
    this.isSpeaking = true;

    bubble.classList.remove("mc-hidden");
    textEl.textContent = "";

    let i = 0;
    typewriterTimer = setInterval(() => {
      textEl.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(typewriterTimer);
    }, 1000 / TYPEWRITER_SPEED);

    const key = this.getKey();

    if (key) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
          {
            method: "POST",
            headers: {
              "xi-api-key": key,
              "Content-Type": "application/json",
              "Accept": "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_turbo_v2",
              voice_settings: {
                stability: 0.55,
                similarity_boost: 0.75,
                style: 0.5,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);

        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === "suspended") await audioCtx.resume();

        const buf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);
        const source = audioCtx.createBufferSource();
        source.buffer = decoded;
        source.connect(audioCtx.destination);
        currentSource = source;
        source.onended = () => {
          this.isSpeaking = false;
          source.disconnect();
          currentSource = null;
          hideTimer = setTimeout(() => bubble.classList.add("mc-hidden"), 1200);
        };
        source.start();
        return;
      } catch (err) {
        console.warn("ElevenLabs failed, falling back to Web Speech:", err);
      }
    }

    // Fallback: Web Speech API
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      activeUtterance = utter;
      const voices = speechSynthesis.getVoices();
      const female = voices.find(v =>
        /female|woman|samantha|karen|zira|victoria|moira|fiona|tessa/i.test(v.name)
      ) || voices.find(v => v.lang.startsWith("en")) || null;
      if (female) utter.voice = female;
      utter.onend = () => {
        if (utter !== activeUtterance) return;
        this.isSpeaking = false;
        hideTimer = setTimeout(() => bubble.classList.add("mc-hidden"), 1200);
      };
      speechSynthesis.speak(utter);
    } else {
      const readMs = Math.max(2000, (text.split(" ").length / 150) * 60000);
      hideTimer = setTimeout(() => {
        this.isSpeaking = false;
        bubble.classList.add("mc-hidden");
      }, readMs);
    }
  },

  silence() {
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (currentSource) {
      try { currentSource.stop(); currentSource.disconnect(); } catch (_) {}
      currentSource = null;
    }
    if ("speechSynthesis" in window) { speechSynthesis.cancel(); activeUtterance = null; }
    this.isSpeaking = false;
    els.mcBubble?.classList.add("mc-hidden");
  },

  setIcon(svgString) {
    const icon = els.mcBubble?.querySelector(".mc-icon");
    if (icon) icon.outerHTML = svgString;
  },
};
