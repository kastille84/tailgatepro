import { Checkbox } from "../../ui_comps/checkbox";
import { FormField, TextInput } from "../../ui_comps/form";
import { Select, type SelectOption } from "../../ui_comps/select";
import { StyledCheckboxContainer, StyledToolbar } from "./styles";

interface TalkFiltersProps {
  trade: string;
  onTradeChange: (trade: string) => void;
  tradeFilterOptions: SelectOption[];
  search: string;
  onSearchChange: (search: string) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  customOnly: boolean;
  onCustomOnlyChange: (value: boolean) => void;
}

/** Presentational trade/search/favorites/custom filter toolbar, shared by
 *  ContentLibrary and the meeting wizard's talk-picker step. The caller owns
 *  the filter state (see useTalkFilters); this component only renders the
 *  controls and reports changes. */
export const TalkFilters = ({
  trade,
  onTradeChange,
  tradeFilterOptions,
  search,
  onSearchChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  customOnly,
  onCustomOnlyChange,
}: TalkFiltersProps) => (
  <>
    <StyledToolbar>
      <FormField id="talk-trade-filter" label="Trade">
        <Select
          value={trade}
          onChange={(event) => onTradeChange(event.target.value)}
          options={tradeFilterOptions}
        />
      </FormField>
      <FormField id="talk-search" label="Search">
        <TextInput
          type="search"
          placeholder="Search by title…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </FormField>
    </StyledToolbar>
    <StyledCheckboxContainer>
      <Checkbox
        label="Favorites only"
        checked={favoritesOnly}
        onChange={(event) => onFavoritesOnlyChange(event.target.checked)}
      />
      <Checkbox
        label="Custom talks only"
        checked={customOnly}
        onChange={(event) => onCustomOnlyChange(event.target.checked)}
      />
    </StyledCheckboxContainer>
  </>
);
