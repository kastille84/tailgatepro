import { useCallback, useEffect, useRef, useState } from "react";

export interface TalkAudioVoiceOption {
  voiceURI: string;
  lang: string;
  name: string;
}

export interface UseTalkAudioResult {
  /** False on a browser/device with no `window.speechSynthesis` at all --
   *  every other field/method below is a safe no-op in that case. */
  isSupported: boolean;
  /** Whatever `speechSynthesis.getVoices()` actually returned on this
   *  device -- never a hardcoded language list (docs/tasks.md Phase 4f). */
  voices: TalkAudioVoiceOption[];
  selectedVoiceURI: string | null;
  selectVoice: (voiceURI: string) => void;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

/**
 * Wraps `window.speechSynthesis` for reading a talk aloud (docs/tasks.md
 * Phase 4f, PRD §4.4's multi-lingual audio requirement). Playback-only --
 * unlike the other 4f capture components, there's no `mediaBlobs`/outbox
 * involvement here at all.
 *
 * Two things the browser API doesn't hand you for free, both required by
 * Phase 4f's definition of done: (1) `getVoices()` can return `[]`
 * synchronously on first call and only populate once the async
 * `voiceschanged` event fires, so voices are loaded via both paths; (2) a
 * device with zero voices (or no `speechSynthesis` support at all) must
 * degrade gracefully -- `speak`/`stop` stay safe no-ops rather than
 * throwing.
 *
 * Real offline behavior on iOS/Android is unverified by design here -- see
 * docs/meeting-flow-design.md's "TTS offline behavior on real devices" and
 * docs/tasks.md Phase 4f's manual real-device verify step.
 */
export const useTalkAudio = (): UseTalkAudioResult => {
  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [voices, setVoices] = useState<TalkAudioVoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // The raw, unmapped voices -- needed to set utterance.voice, kept out of
  // the public return value so consumers only ever see the plain POJO shape.
  const rawVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!isSupported) return;

    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const rawVoices = synth.getVoices();
      rawVoicesRef.current = rawVoices;
      setVoices(
        rawVoices.map((voice) => ({
          voiceURI: voice.voiceURI,
          lang: voice.lang,
          name: voice.name,
        })),
      );

      if (rawVoices.length === 0) return;
      setSelectedVoiceURI((current) => {
        if (current) return current;
        const primaryLanguage = navigator.language.split("-")[0];
        const match = rawVoices.find((voice) =>
          voice.lang.startsWith(primaryLanguage),
        );
        return (match ?? rawVoices[0]).voiceURI;
      });
    };

    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);

    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
    };
  }, [isSupported]);

  // Cancels any in-flight speech when this hook unmounts (e.g. the wizard
  // navigates away mid-utterance) so audio never keeps playing unattended.
  useEffect(() => {
    if (!isSupported) return;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const selectVoice = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = rawVoicesRef.current.find(
        (candidate) => candidate.voiceURI === selectedVoiceURI,
      );
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synth.speak(utterance);
    },
    [isSupported, selectedVoiceURI],
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return {
    isSupported,
    voices,
    selectedVoiceURI,
    selectVoice,
    isSpeaking,
    speak,
    stop,
  };
};
