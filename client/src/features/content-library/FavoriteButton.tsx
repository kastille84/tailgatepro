import { HiBookmark, HiOutlineBookmark } from "react-icons/hi2";

import { Button } from "../../ui_comps/button";
import { useToggleFavorite } from "../../hooks/useToggleFavorite";
import type { Talk } from "../../interfaces/talk";
import { StyledFavoriteIcon } from "./styles";

interface FavoriteButtonProps {
  talk: Talk;
  isFavorited: boolean;
}

/**
 * Per-talk favorite toggle — docs/PRD.md: "Foremen can bookmark their 'Top
 * 10' most-used topics for two-tap access." Icon-only (no visible label, per
 * docs/ui-styling.md's "use ui_comps primitives, not raw <button>" rule): a
 * solid bookmark (HiBookmark) means favorited, an outline bookmark
 * (HiOutlineBookmark) means not — both from react-icons/hi2, the repo's only
 * approved icon set. `Button`'s "outline" variant is orange-on-transparent by
 * default (this app has no neutral/gray variant), so the icon itself is
 * colored via a transient `$isFavorited` prop rather than the button chrome,
 * so the unfavorited state doesn't look pre-activated.
 */
export const FavoriteButton = ({ talk, isFavorited }: FavoriteButtonProps) => {
  const { toggleFavorite, isToggling } = useToggleFavorite();

  return (
    <Button
      variant="outline"
      size="sm"
      loading={isToggling}
      onClick={() => toggleFavorite({ talkId: talk.id, isFavorited })}
      leftIcon={
        <StyledFavoriteIcon $isFavorited={isFavorited}>
          {isFavorited ? <HiBookmark /> : <HiOutlineBookmark />}
        </StyledFavoriteIcon>
      }
      aria-label={
        isFavorited
          ? `Remove ${talk.title} from favorites`
          : `Add ${talk.title} to favorites`
      }
      aria-pressed={isFavorited}
    />
  );
};
