import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useTalks } from "../../hooks/useTalks";
import { useFavorites } from "../../hooks/useFavorites";
import { useTalkFilters } from "../../hooks/useTalkFilters";
// Imported directly from their files, not the features/content-library
// barrel: the barrel also re-exports TalkForm, and a static import of it
// would pull TalkForm (and Tiptap, via the lazy import below) into this same
// synchronously-loaded module graph, defeating the code-split.
import { TalkDetail } from "../../features/content-library/TalkDetail";
import { TalkFilters } from "../../features/content-library/TalkFilters";
import { TalkList } from "../../features/content-library/TalkList";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { Spinner } from "../../ui_comps/spinner";
import type { Talk } from "../../interfaces/talk";
import {
  StyledButtonContainer,
  StyledContainer,
  StyledError,
  StyledEyebrow,
  StyledHeadline,
  StyledHero,
  StyledHeroInner,
  StyledLede,
  StyledPage,
  StyledSection,
  StyledStatus,
  StyledUpgradeBanner,
  StyledUpgradeBody,
  StyledUpgradeTitle,
} from "./ContentLibrary.styles";
import { HiOutlinePlus } from "react-icons/hi2";

// Tiptap (used by TalkForm's talking-points/hazards/questions editors) adds
// real weight, so the form is only fetched when someone actually opens it,
// not as part of the default /talks browse bundle.
const TalkForm = lazy(() =>
  import("../../features/content-library/TalkForm").then((mod) => ({
    default: mod.TalkForm,
  })),
);

/** The authenticated Content Library, reached from the Dashboard hub and the
 *  Navbar. Fetches the whole global talk list once (`useTalks`) and does trade
 *  filtering + title search in memory — no server-side query params (Phase
 *  2b). Re-checks the session defensively even though it sits behind
 *  `RequireAuth`. */
export const ContentLibrary = () => {
  const { user, loading } = useAuth();
  const { talks, tradeOptions, isLoading, isError } = useTalks();
  const { favoriteIds } = useFavorites();
  const { limits } = useCurrentUser();
  const {
    trade,
    setTrade,
    search,
    setSearch,
    favoritesOnly,
    setFavoritesOnly,
    customOnly,
    setCustomOnly,
    tradeFilterOptions,
    visibleTalks,
  } = useTalkFilters(talks, tradeOptions, favoriteIds);

  const [selected, setSelected] = useState<Talk | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTalk, setEditingTalk] = useState<Talk | undefined>(undefined);

  const openCreate = () => {
    setEditingTalk(undefined);
    setIsFormOpen(true);
  };

  const openEdit = (talk: Talk) => {
    setSelected(undefined);
    setEditingTalk(talk);
    setIsFormOpen(true);
  };

  const closeForm = () => setIsFormOpen(false);

  // Trade Free only sees the core talks; the server hides the rest.
  const isCoreOnly = limits?.libraryAccess === "core";

  if (loading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Loading…
        </StyledStatus>
      </StyledPage>
    );
  }

  if (!user) {
    return (
      <StyledPage>
        <StyledStatus role="status">Access denied. Please log in.</StyledStatus>
      </StyledPage>
    );
  }

  return (
    <StyledPage>
      <StyledHero aria-labelledby="content-library-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Toolbox Talks</StyledEyebrow>
          <StyledHeadline id="content-library-hero-heading">
            Safety talk library
          </StyledHeadline>
          <StyledLede>
            OSHA-mapped toolbox talks, ready to run on site. Filter by trade or
            search by title. Plus add your own custom talks.
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          {isCoreOnly && (
            <StyledUpgradeBanner>
              <StyledUpgradeTitle>
                You&apos;re on the free plan: 30 core talks
              </StyledUpgradeTitle>
              <StyledUpgradeBody>
                The full OSHA talk library is a Trade Pro feature —{" "}
                <Link to="/pricing">upgrade to Trade Pro</Link> to unlock every
                talk.
              </StyledUpgradeBody>
            </StyledUpgradeBanner>
          )}
          <TalkFilters
            trade={trade}
            onTradeChange={setTrade}
            tradeFilterOptions={tradeFilterOptions}
            search={search}
            onSearchChange={setSearch}
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            customOnly={customOnly}
            onCustomOnlyChange={setCustomOnly}
          />
          <StyledButtonContainer>
            <Button
              variant="primary"
              size="md"
              onClick={openCreate}
              leftIcon={<HiOutlinePlus />}
            >
              Add a new talk
            </Button>
          </StyledButtonContainer>

          {isLoading && <Spinner center message="Loading the talk library…" />}
          {isError && (
            <StyledError role="alert">
              Could not load the talk library. Refresh to try again.
            </StyledError>
          )}
          {!isLoading && !isError && (
            <TalkList
              talks={visibleTalks}
              favoriteIds={favoriteIds}
              onSelect={setSelected}
            />
          )}
        </StyledContainer>
      </StyledSection>

      <Footer />

      <TalkDetail
        talk={selected}
        favoriteIds={favoriteIds}
        onClose={() => setSelected(undefined)}
        onEdit={openEdit}
      />

      {isFormOpen && (
        <Suspense fallback={null}>
          <TalkForm
            isOpen={isFormOpen}
            onClose={closeForm}
            talk={editingTalk}
          />
        </Suspense>
      )}
    </StyledPage>
  );
};
