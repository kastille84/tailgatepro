import { Modal } from "../../ui_comps/modal";
import type { Talk } from "../../interfaces/talk";
import { FavoriteButton } from "./FavoriteButton";
import {
  StyledAttribution,
  StyledBadgeRow,
  StyledCustomBadge,
  StyledDetailTitleRow,
  StyledOshaLine,
  StyledSection,
  StyledSectionTitle,
  StyledSummary,
  StyledTradeBadge,
} from "./styles";

interface TalkDetailProps {
  /** The selected talk, or `undefined` when the modal should be closed. */
  talk: Talk | undefined;
  favoriteIds: Set<string>;
  onClose: () => void;
}

/**
 * Read-only detail view for one talk, shown in a modal from the
 * ContentLibrary page. Always renders `attribution.copyright` +
 * `attribution.notice` when present — a CPWR licensing condition (keep the
 * source's copyright markings with the content, no implied endorsement), see
 * docs/content-attribution.md. The title row also carries the favorite
 * toggle — this is the natural read-then-decide moment for bookmarking.
 */
export const TalkDetail = ({ talk, favoriteIds, onClose }: TalkDetailProps) => {
  const structured = talk?.structured;
  const oshaStandards = structured?.osha_standards ?? [];

  const title = talk ? (
    <StyledDetailTitleRow>
      <span>{talk.title}</span>
      <FavoriteButton talk={talk} isFavorited={favoriteIds.has(talk.id)} />
    </StyledDetailTitleRow>
  ) : (
    ""
  );

  return (
    <Modal isOpen={Boolean(talk)} onClose={onClose} title={title} size="lg">
      {talk && (
        <>
          <StyledBadgeRow>
            {!talk.isGlobal && <StyledCustomBadge>Custom</StyledCustomBadge>}
            {talk.tradeTags.map((trade) => (
              <StyledTradeBadge key={trade}>{trade}</StyledTradeBadge>
            ))}
          </StyledBadgeRow>

          {structured?.summary && <StyledSummary>{structured.summary}</StyledSummary>}

          {!!structured?.talking_points.length && (
            <StyledSection>
              <StyledSectionTitle>Talking points</StyledSectionTitle>
              <ul>
                {structured.talking_points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </StyledSection>
          )}

          {!!structured?.site_hazards_to_check.length && (
            <StyledSection>
              <StyledSectionTitle>Hazards to check on site</StyledSectionTitle>
              <ul>
                {structured.site_hazards_to_check.map((hazard, index) => (
                  <li key={index}>{hazard}</li>
                ))}
              </ul>
            </StyledSection>
          )}

          {!!structured?.discussion_questions.length && (
            <StyledSection>
              <StyledSectionTitle>Discussion questions</StyledSectionTitle>
              <ul>
                {structured.discussion_questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </StyledSection>
          )}

          {(!!oshaStandards.length || !!structured?.estimated_minutes) && (
            <StyledOshaLine>
              {oshaStandards.length > 0 && `OSHA: ${oshaStandards.join(" · ")}`}
              {oshaStandards.length > 0 && structured?.estimated_minutes && " · "}
              {structured?.estimated_minutes
                ? `~${structured.estimated_minutes} min`
                : ""}
            </StyledOshaLine>
          )}

          {talk.attribution && (
            <StyledAttribution>
              {talk.attribution.copyright} {talk.attribution.notice}
            </StyledAttribution>
          )}
        </>
      )}
    </Modal>
  );
};
