import { Button } from "../../ui_comps/button";
import type { Talk } from "../../interfaces/talk";
import {
  StyledCard,
  StyledCardMain,
  StyledEmpty,
  StyledList,
  StyledMeta,
  StyledName,
  StyledTradeBadge,
  StyledButtonContainer,
} from "./styles";

interface TalkListProps {
  talks: Talk[];
  onSelect: (talk: Talk) => void;
}

/** Presentational list of talk cards. The page owns the fetch and the trade
 *  filter / search state; this component only renders and reports selection. */
export const TalkList = ({ talks, onSelect }: TalkListProps) => {
  if (talks.length === 0) {
    return (
      <StyledEmpty>
        No talks match your filters. Try a different trade or search term.
      </StyledEmpty>
    );
  }

  return (
    <StyledList>
      {talks.map((talk) => (
        <StyledCard key={talk.id}>
          <StyledCardMain>
            <StyledName>{talk.title}</StyledName>
            {talk.structured?.summary && (
              <StyledMeta>{talk.structured.summary}</StyledMeta>
            )}
          </StyledCardMain>
          {talk.tradeTag && (
            <StyledTradeBadge>{talk.tradeTag}</StyledTradeBadge>
          )}
          <StyledButtonContainer>
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
      ))}
    </StyledList>
  );
};
