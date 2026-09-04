import styled from "styled-components";

export const StyledCompareWrap = styled.div`
  max-width: 96rem;
  margin: 0 auto;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;

export const StyledCompareCaption = styled.caption`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

export const StyledCompareTable = styled.table`
  width: 100%;
  min-width: 56rem;
  border-collapse: collapse;
`;

export const StyledCompareHeadCell = styled.th<{ $highlight?: boolean }>`
  padding: 1.2rem 1.6rem;
  text-align: left;
  font-size: 1.3rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.navy[700]};
  border-bottom: 0.2rem solid
    ${({ theme, $highlight }) =>
      $highlight ? theme.colors.orange[500] : theme.colors.concrete[600]};
`;

export const StyledCompareRow = styled.tr`
  border-bottom: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
`;

export const StyledCompareFeature = styled.th`
  width: 20rem;
  padding: 1.6rem;
  text-align: left;
  font-size: 1.45rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledCompareCell = styled.td<{ $highlight?: boolean }>`
  padding: 1.6rem;
  font-size: 1.4rem;
  line-height: 1.5;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[600]};
  vertical-align: top;
  background-color: ${({ theme, $highlight }) =>
    $highlight ? theme.colors.concrete[100] : "transparent"};
  box-shadow: ${({ theme, $highlight }) =>
    $highlight ? `inset 0.3rem 0 0 ${theme.colors.orange[500]}` : "none"};

  > span {
    display: inline-flex;
    align-items: flex-start;
    gap: 0.8rem;
  }
`;

export const StyledCompareIcon = styled.span<{ $highlight?: boolean }>`
  flex-shrink: 0;
  display: inline-flex;
  margin-top: 0.15rem;

  svg {
    font-size: 1.8rem;
    color: ${({ theme, $highlight }) =>
      $highlight ? theme.colors.green[600] : theme.colors.navy[400]};
  }
`;
