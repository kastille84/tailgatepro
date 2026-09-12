import { lazy, Suspense, useMemo, useState } from "react";

import { useAuth } from "../../context/auth";
import { useTalks } from "../../hooks/useTalks";
import { useFavorites } from "../../hooks/useFavorites";
// Imported directly from their files, not the features/content-library
// barrel: the barrel also re-exports TalkForm, and a static import of it
// would pull TalkForm (and Tiptap, via the lazy import below) into this same
// synchronously-loaded module graph, defeating the code-split.
import { TalkDetail } from "../../features/content-library/TalkDetail";
import { TalkList } from "../../features/content-library/TalkList";
import { Button } from "../../ui_comps/button";
import { Checkbox } from "../../ui_comps/checkbox";
import { FormField, TextInput } from "../../ui_comps/form";
import { Footer } from "../../ui_comps/footer";
import { Select } from "../../ui_comps/select";
import { Spinner } from "../../ui_comps/spinner";
import type { Talk } from "../../interfaces/talk";
import {
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
  StyledToolbar,
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

const ALL_TRADES = "all";

/** The authenticated Content Library, reached from the Dashboard hub and the
 *  Navbar. Fetches the whole global talk list once (`useTalks`) and does trade
 *  filtering + title search in memory — no server-side query params (Phase
 *  2b). Re-checks the session defensively even though it sits behind
 *  `RequireAuth`. */
export const ContentLibrary = () => {
  const { user, loading } = useAuth();
  const { talks, tradeOptions, isLoading, isError } = useTalks();
  const { favoriteIds } = useFavorites();

  const [trade, setTrade] = useState(ALL_TRADES);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<Talk | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const tradeFilterOptions = useMemo(
    () => [{ value: ALL_TRADES, label: "All trades" }, ...tradeOptions],
    [tradeOptions],
  );

  const visibleTalks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return talks.filter((talk) => {
      const matchesTrade =
        trade === ALL_TRADES || talk.tradeTags.includes(trade);
      const matchesSearch = !query || talk.title.toLowerCase().includes(query);
      const matchesFavorite = !favoritesOnly || favoriteIds.has(talk.id);
      return matchesTrade && matchesSearch && matchesFavorite;
    });
  }, [talks, trade, search, favoritesOnly, favoriteIds]);

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
          <StyledToolbar>
            <FormField id="talk-trade-filter" label="Trade">
              <Select
                value={trade}
                onChange={(event) => setTrade(event.target.value)}
                options={tradeFilterOptions}
              />
            </FormField>
            <FormField id="talk-search" label="Search">
              <TextInput
                type="search"
                placeholder="Search by title…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </FormField>
            <Checkbox
              label="Favorites only"
              checked={favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsFormOpen(true)}
              leftIcon={<HiOutlinePlus />}
            >
              Add a new talk
            </Button>
          </StyledToolbar>

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
      />

      {isFormOpen && (
        <Suspense fallback={null}>
          <TalkForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
        </Suspense>
      )}
    </StyledPage>
  );
};
