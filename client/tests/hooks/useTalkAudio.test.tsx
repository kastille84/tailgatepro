import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findVoiceForLanguage, useTalkAudio } from "../../src/hooks/useTalkAudio";

const makeVoice = (overrides: Partial<SpeechSynthesisVoice> = {}) =>
  ({
    voiceURI: "voice-en",
    lang: "en-US",
    name: "English",
    default: false,
    localService: true,
    ...overrides,
  }) as SpeechSynthesisVoice;

class MockUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

class MockSpeechSynthesis extends EventTarget {
  voicesValue: SpeechSynthesisVoice[] = [];
  speakFn = vi.fn();
  cancelFn = vi.fn();

  getVoices() {
    return this.voicesValue;
  }

  speak(utterance: MockUtterance) {
    this.speakFn(utterance);
  }

  cancel() {
    this.cancelFn();
  }
}

const installMockSpeechSynthesis = (voices: SpeechSynthesisVoice[] = []) => {
  const synth = new MockSpeechSynthesis();
  synth.voicesValue = voices;
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
  return synth;
};

afterEach(() => {
  // afterEach hooks run in reverse registration order, so this file's own
  // afterEach would otherwise unstub speechSynthesis *before* setupTests.ts's
  // global cleanup() unmounts the rendered hook -- unmount explicitly first
  // so the unmount effect's window.speechSynthesis.cancel() call still has a
  // real stub to call. cleanup() is idempotent, so the later global call is
  // a no-op.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("findVoiceForLanguage", () => {
  const voices = [
    { voiceURI: "voice-en", lang: "en-US", name: "English" },
    { voiceURI: "voice-es", lang: "es-MX", name: "Spanish" },
  ];

  it("returns the voice whose lang prefix-matches the given language code", () => {
    expect(findVoiceForLanguage(voices, "es")?.voiceURI).toBe("voice-es");
  });

  it("returns undefined when nothing matches", () => {
    expect(findVoiceForLanguage(voices, "fr")).toBeUndefined();
  });
});

describe("useTalkAudio", () => {
  it("reports unsupported and stays a safe no-op with no window.speechSynthesis (jsdom default)", () => {
    const { result } = renderHook(() => useTalkAudio());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.voices).toEqual([]);
    expect(result.current.selectedVoiceURI).toBeNull();

    expect(() => {
      result.current.speak("Hello");
      result.current.stop();
    }).not.toThrow();
  });

  it("loads voices that are already available synchronously and auto-selects a matching-language default", () => {
    const englishVoice = makeVoice({ voiceURI: "voice-en", lang: "en-US" });
    installMockSpeechSynthesis([englishVoice]);
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");

    const { result } = renderHook(() => useTalkAudio());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.voices).toEqual([
      { voiceURI: "voice-en", lang: "en-US", name: "English" },
    ]);
    expect(result.current.selectedVoiceURI).toBe("voice-en");
  });

  it("loads voices asynchronously via the voiceschanged event when getVoices() is empty at first", () => {
    const synth = installMockSpeechSynthesis([]);
    const { result } = renderHook(() => useTalkAudio());

    expect(result.current.voices).toEqual([]);

    act(() => {
      synth.voicesValue = [makeVoice()];
      synth.dispatchEvent(new Event("voiceschanged"));
    });

    expect(result.current.voices).toEqual([
      { voiceURI: "voice-en", lang: "en-US", name: "English" },
    ]);
    expect(result.current.selectedVoiceURI).toBe("voice-en");
  });

  it("falls back to the first available voice when none matches the browser's language", () => {
    const spanishVoice = makeVoice({ voiceURI: "voice-es", lang: "es-ES", name: "Spanish" });
    installMockSpeechSynthesis([spanishVoice]);
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("fr-FR");

    const { result } = renderHook(() => useTalkAudio());

    expect(result.current.selectedVoiceURI).toBe("voice-es");
  });

  it("keeps an already-selected voice when voices reload (e.g. a second voiceschanged event)", () => {
    const voiceA = makeVoice({ voiceURI: "voice-a" });
    const voiceB = makeVoice({ voiceURI: "voice-b" });
    const synth = installMockSpeechSynthesis([voiceA, voiceB]);

    const { result } = renderHook(() => useTalkAudio());
    expect(result.current.selectedVoiceURI).toBe("voice-a");

    act(() => {
      result.current.selectVoice("voice-b");
    });
    act(() => {
      synth.dispatchEvent(new Event("voiceschanged"));
    });

    expect(result.current.selectedVoiceURI).toBe("voice-b");
  });

  it("removes the voiceschanged listener on unmount", () => {
    const synth = installMockSpeechSynthesis([]);
    const removeEventListenerSpy = vi.spyOn(synth, "removeEventListener");

    const { unmount } = renderHook(() => useTalkAudio());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "voiceschanged",
      expect.any(Function),
    );
  });

  it("degrades gracefully with zero voices: selection stays null, speak() still runs without a specific voice", () => {
    const synth = installMockSpeechSynthesis([]);

    const { result } = renderHook(() => useTalkAudio());
    expect(result.current.selectedVoiceURI).toBeNull();

    act(() => {
      result.current.speak("Hello crew");
    });

    expect(synth.speakFn).toHaveBeenCalledTimes(1);
    const spoken = synth.speakFn.mock.calls[0][0] as MockUtterance;
    expect(spoken.voice).toBeNull();
  });

  it("lets selectVoice override the auto-selected default", () => {
    const voiceA = makeVoice({ voiceURI: "voice-a", lang: "en-US" });
    const voiceB = makeVoice({ voiceURI: "voice-b", lang: "es-ES", name: "Spanish" });
    installMockSpeechSynthesis([voiceA, voiceB]);

    const { result } = renderHook(() => useTalkAudio());
    act(() => {
      result.current.selectVoice("voice-b");
    });

    expect(result.current.selectedVoiceURI).toBe("voice-b");
  });

  it("speak() sets isSpeaking true on start and false on end, and speaks with the selected voice", () => {
    const voice = makeVoice({ voiceURI: "voice-en" });
    const synth = installMockSpeechSynthesis([voice]);

    const { result } = renderHook(() => useTalkAudio());

    act(() => {
      result.current.speak("Hello crew");
    });

    const utterance = synth.speakFn.mock.calls[0][0] as MockUtterance;
    expect(utterance.voice).toBe(voice);
    expect(utterance.text).toBe("Hello crew");

    act(() => utterance.onstart?.());
    expect(result.current.isSpeaking).toBe(true);

    act(() => utterance.onend?.());
    expect(result.current.isSpeaking).toBe(false);
  });

  it("speak() cancels any in-flight utterance before speaking the next one", () => {
    const synth = installMockSpeechSynthesis([makeVoice()]);
    const { result } = renderHook(() => useTalkAudio());

    act(() => {
      result.current.speak("First");
      result.current.speak("Second");
    });

    expect(synth.cancelFn).toHaveBeenCalled();
    expect(synth.speakFn).toHaveBeenCalledTimes(2);
  });

  it("an utterance error also clears isSpeaking", () => {
    const synth = installMockSpeechSynthesis([makeVoice()]);
    const { result } = renderHook(() => useTalkAudio());

    act(() => {
      result.current.speak("Hello");
    });
    const utterance = synth.speakFn.mock.calls[0][0] as MockUtterance;
    act(() => utterance.onstart?.());
    expect(result.current.isSpeaking).toBe(true);

    act(() => utterance.onerror?.());
    expect(result.current.isSpeaking).toBe(false);
  });

  it("stop() cancels speech and forces isSpeaking false", () => {
    const synth = installMockSpeechSynthesis([makeVoice()]);
    const { result } = renderHook(() => useTalkAudio());

    act(() => {
      result.current.speak("Hello");
    });
    const utterance = synth.speakFn.mock.calls[0][0] as MockUtterance;
    act(() => utterance.onstart?.());
    expect(result.current.isSpeaking).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(synth.cancelFn).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it("cancels any in-flight speech on unmount", () => {
    const synth = installMockSpeechSynthesis([makeVoice()]);
    const { unmount } = renderHook(() => useTalkAudio());

    unmount();

    expect(synth.cancelFn).toHaveBeenCalled();
  });

  it("matchVoiceToLanguage selects the best-matching voice for a language code", () => {
    const englishVoice = makeVoice({ voiceURI: "voice-en", lang: "en-US" });
    const spanishVoice = makeVoice({ voiceURI: "voice-es", lang: "es-MX", name: "Spanish" });
    installMockSpeechSynthesis([englishVoice, spanishVoice]);

    const { result } = renderHook(() => useTalkAudio());
    expect(result.current.selectedVoiceURI).toBe("voice-en");

    act(() => {
      result.current.matchVoiceToLanguage("es");
    });

    expect(result.current.selectedVoiceURI).toBe("voice-es");
  });

  it("matchVoiceToLanguage no-ops (keeps the current voice) when nothing matches", () => {
    installMockSpeechSynthesis([makeVoice({ voiceURI: "voice-en", lang: "en-US" })]);

    const { result } = renderHook(() => useTalkAudio());
    expect(result.current.selectedVoiceURI).toBe("voice-en");

    act(() => {
      result.current.matchVoiceToLanguage("fr");
    });

    expect(result.current.selectedVoiceURI).toBe("voice-en");
  });
});
