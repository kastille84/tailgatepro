import { useMemo } from "react";

import { Button } from "../../ui_comps/button";
import type { Talk } from "../../interfaces/talk";
import { FavoriteButton } from "./FavoriteButton";
import {
  StyledCard,
  StyledCardMain,
  StyledCustomBadge,
  StyledEmpty,
  StyledList,
  StyledMeta,
  StyledName,
  StyledRequiredBadge,
  StyledTradeBadge,
  StyledButtonContainer,
} from "./styles";

interface TalkListProps {
  talks: Talk[];
  favoriteIds: Set<string>;
  onSelect: (talk: Talk) => void;
  /** A GC's currently pushed required topic (Phase 9e,
   *  docs/policy-push-design.md), if any -- pinned to the front of the list
   *  and badged. A pure nudge: absent from `talks` (filtered out by the
   *  caller's trade/search/custom filters) just means it doesn't show, not
   *  an error. */
  requiredTalkId?: string | null;
}

/** Presentational list of talk cards. The page owns the fetch, favorites, and
 *  the trade filter / search state; this component only renders and reports
 *  selection (and the favorite toggle, via FavoriteButton). */
export const TalkList = ({
  talks,
  favoriteIds,
  onSelect,
  requiredTalkId = null,
}: TalkListProps) => {
  const orderedTalks = useMemo(() => {
    if (!requiredTalkId) return talks;
    const required = talks.find((talk) => talk.id === requiredTalkId);
    if (!required) return talks;
    return [required, ...talks.filter((talk) => talk.id !== requiredTalkId)];
  }, [talks, requiredTalkId]);

  if (talks.length === 0) {
    return (
      <StyledEmpty>
        No talks match your filters. Try a different trade or search term.
      </StyledEmpty>
    );
  }

  return (
    <StyledList>
      {orderedTalks.map((talk) => {
        const isRequired = talk.id === requiredTalkId;
        return (
          <StyledCard key={talk.id} $isRequired={isRequired}>
            <StyledCardMain>
              <StyledName>{talk.title}</StyledName>
              {talk.structured?.summary && (
                <StyledMeta>{talk.structured.summary}</StyledMeta>
              )}
            </StyledCardMain>
            {isRequired && <StyledRequiredBadge>Required by your GC</StyledRequiredBadge>}
            {!talk.isGlobal && <StyledCustomBadge>Custom</StyledCustomBadge>}
            {talk.tradeTag && (
              <StyledTradeBadge>{talk.tradeTag}</StyledTradeBadge>
            )}
            <StyledButtonContainer>
              <FavoriteButton talk={talk} isFavorited={favoriteIds.has(talk.id)} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelect(talk)}
                aria-label={`View ${talk.title}`}
              >
                View
              </Button>
            </StyledButtonContainer>
          </StyledCard>
        );
      })}
    </StyledList>
  );
};
