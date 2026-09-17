import { useMemo, useState } from "react";

import { Button } from "../../ui_comps/button";
import { FormField } from "../../ui_comps/form";
import { Select } from "../../ui_comps/select";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useTalkAudio } from "../../hooks/useTalkAudio";
import {
  getLocalizedTalkContent,
  getTalkLanguageOptions,
} from "../../utils/talkLocalization";
import type { Talk } from "../../interfaces/talk";
import {
  StyledAudioNote,
  StyledAudioRow,
  StyledPresenterActions,
  StyledPresenterAttribution,
  StyledPresenterOshaLine,
  StyledPresenterSection,
  StyledPresenterSectionTitle,
  StyledPresenterSummary,
  StyledPresenterWrapper,
} from "./styles";

const ENGLISH_ONLY = [{ code: "en", label: "English" }];

interface TalkPresenterProps {
  talk: Talk;
  onContinue: () => void;
}

/**
 * Step 3 of the meeting wizard: present the chosen talk to the crew. Renders
 * the same structured sections `TalkDetail` shows in the library, plus
 * optional read-aloud controls built on `useTalkAudio`. Continue is always
 * available -- TTS is an aid, not a gate, since a foreman may just read the
 * talk aloud directly (docs/meeting-flow-design.md leaves TTS's real offline
 * behavior an open device-check, not a hard requirement here).
 */
export const TalkPresenter = ({ talk, onContinue }: TalkPresenterProps) => {
  const {
    isSupported,
    voices,
    selectedVoiceURI,
    selectVoice,
    matchVoiceToLanguage,
    isSpeaking,
    speak,
    stop,
  } = useTalkAudio();
  const { hasTranslationAccess } = useCurrentUser();

  const [languageCode, setLanguageCode] = useState("en");

  const structured = talk.structured;
  const oshaStandards = structured?.osha_standards ?? [];

  // Basic-tier companies always see English, even if `talk.translations` has
  // data (a tier downgrade, or a manually-seeded row) -- gating the option
  // list itself, rather than just hiding the switcher, is what keeps that
  // true regardless of `languageCode` state.
  const languageOptions = hasTranslationAccess
    ? getTalkLanguageOptions(talk)
    : ENGLISH_ONLY;
  const effectiveLanguageCode = hasTranslationAccess ? languageCode : "en";

  const localized = useMemo(
    () => getLocalizedTalkContent(talk, effectiveLanguageCode),
    [talk, effectiveLanguageCode],
  );

  const spokenText = useMemo(() => {
    const parts = [
      localized.title,
      localized.summary,
      ...localized.talking_points,
      ...localized.site_hazards_to_check,
      ...localized.discussion_questions,
    ].filter((part): part is string => !!part);
    // Each part may already end with its own sentence punctuation (a
    // talking point authored as a full sentence) -- strip a trailing period
    // before rejoining so TTS doesn't read a double pause between parts.
    return parts.map((part) => part.trim().replace(/\.+$/, "")).join(". ");
  }, [localized]);

  const voiceOptions = voices.map((voice) => ({
    value: voice.voiceURI,
    label: `${voice.name} (${voice.lang})`,
  }));

  const isMachineTranslated = effectiveLanguageCode !== "en" && !talk.isGlobal;

  return (
    <StyledPresenterWrapper>
      {localized.summary && (
        <StyledPresenterSummary>{localized.summary}</StyledPresenterSummary>
      )}

      {!!localized.talking_points.length && (
        <StyledPresenterSection>
          <StyledPresenterSectionTitle>
            Talking points
          </StyledPresenterSectionTitle>
          <ul>
            {localized.talking_points.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </StyledPresenterSection>
      )}

      {!!localized.site_hazards_to_check.length && (
        <StyledPresenterSection>
          <StyledPresenterSectionTitle>
            Hazards to check on site
          </StyledPresenterSectionTitle>
          <ul>
            {localized.site_hazards_to_check.map((hazard, index) => (
              <li key={index}>{hazard}</li>
            ))}
          </ul>
        </StyledPresenterSection>
      )}

      {!!localized.discussion_questions.length && (
        <StyledPresenterSection>
          <StyledPresenterSectionTitle>
            Discussion questions
          </StyledPresenterSectionTitle>
          <ul>
            {localized.discussion_questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </StyledPresenterSection>
      )}

      {(!!oshaStandards.length || !!structured?.estimated_minutes) && (
        <StyledPresenterOshaLine>
          {oshaStandards.length > 0 && `OSHA: ${oshaStandards.join(" · ")}`}
          {oshaStandards.length > 0 && structured?.estimated_minutes && " · "}
          {structured?.estimated_minutes
            ? `~${structured.estimated_minutes} min`
            : ""}
        </StyledPresenterOshaLine>
      )}

      {talk.attribution && (
        <StyledPresenterAttribution>
          {talk.attribution.copyright} {talk.attribution.notice}
        </StyledPresenterAttribution>
      )}

      {languageOptions.length > 1 && (
        <StyledAudioRow>
          <FormField id="talk-presenter-language" label="Language">
            <Select
              value={effectiveLanguageCode}
              onChange={(event) => {
                setLanguageCode(event.target.value);
                matchVoiceToLanguage(event.target.value);
              }}
              options={languageOptions.map((option) => ({
                value: option.code,
                label: option.label,
              }))}
            />
          </FormField>
        </StyledAudioRow>
      )}

      {isMachineTranslated && (
        <StyledPresenterAttribution>
          Machine-translated — verify accuracy before relying on it for
          safety-critical instructions.
        </StyledPresenterAttribution>
      )}

      {isSupported ? (
        <StyledAudioRow>
          {voiceOptions.length > 0 && (
            <FormField id="talk-presenter-voice" label="Voice">
              <Select
                value={selectedVoiceURI ?? ""}
                onChange={(event) => selectVoice(event.target.value)}
                options={voiceOptions}
              />
            </FormField>
          )}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => (isSpeaking ? stop() : speak(spokenText))}
          >
            {isSpeaking ? "Stop reading" : "Read aloud"}
          </Button>
        </StyledAudioRow>
      ) : (
        <StyledAudioNote>
          Read-aloud isn&apos;t available on this device — read the talk to
          the crew directly.
        </StyledAudioNote>
      )}

      <StyledPresenterActions>
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </StyledPresenterActions>
    </StyledPresenterWrapper>
  );
};
