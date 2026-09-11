import { useMemo, useState } from "react";

import { useAuth } from "../../context/auth";
import { useTalks } from "../../hooks/useTalks";
import { TalkDetail, TalkList } from "../../features/content-library";
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

const ALL_TRADES = "all";

/** The authenticated Content Library, reached from the Dashboard hub and the
 *  Navbar. Fetches the whole global talk list once (`useTalks`) and does trade
 *  filtering + title search in memory — no server-side query params (Phase
 *  2b). Re-checks the session defensively even though it sits behind
 *  `RequireAuth`. */
export const ContentLibrary = () => {
  const { user, loading } = useAuth();
  const { talks, isLoading, isError } = useTalks();

  const [trade, setTrade] = useState(ALL_TRADES);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Talk | undefined>(undefined);

  const tradeOptions = useMemo(() => {
    const trades = new Set<string>();
    talks.forEach((talk) => talk.tradeTags.forEach((t) => trades.add(t)));
    return [
      { value: ALL_TRADES, label: "All trades" },
      ...Array.from(trades)
        .sort((a, b) => a.localeCompare(b))
        .map((t) => ({ value: t, label: t })),
    ];
  }, [talks]);

  const visibleTalks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return talks.filter((talk) => {
      const matchesTrade = trade === ALL_TRADES || talk.tradeTags.includes(trade);
      const matchesSearch = !query || talk.title.toLowerCase().includes(query);
      return matchesTrade && matchesSearch;
    });
  }, [talks, trade, search]);

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
            search by title.
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
                options={tradeOptions}
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
          </StyledToolbar>

          {isLoading && <Spinner center message="Loading the talk library…" />}
          {isError && (
            <StyledError role="alert">
              Could not load the talk library. Refresh to try again.
            </StyledError>
          )}
          {!isLoading && !isError && (
            <TalkList talks={visibleTalks} onSelect={setSelected} />
          )}
        </StyledContainer>
      </StyledSection>

      <Footer />

      <TalkDetail talk={selected} onClose={() => setSelected(undefined)} />
    </StyledPage>
  );
};
