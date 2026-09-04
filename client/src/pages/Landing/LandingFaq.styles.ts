import styled from "styled-components";

export const StyledFaq = styled.div`
  max-width: 80rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledFaqItem = styled.details`
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  padding: 0.4rem 2rem;
`;

export const StyledFaqQuestion = styled.summary`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
  min-height: 4.8rem;
  padding: 1.2rem 0;
  cursor: pointer;
  list-style: none;
  font-size: 1.6rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};

  &::-webkit-details-marker {
    display: none;
  }

  &::after {
    content: "+";
    color: ${({ theme }) => theme.colors.orange[500]};
    font-size: 2.2rem;
    line-height: 1;
    font-weight: 700;
  }

  details[open] > &::after {
    content: "\\2212";
  }

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.orange[500]};
    outline-offset: 0.2rem;
  }
`;

export const StyledFaqAnswer = styled.p`
  margin: 0 0 1.6rem;
  font-size: 1.5rem;
  line-height: 1.65;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;
