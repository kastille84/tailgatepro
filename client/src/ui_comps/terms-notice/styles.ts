import styled from "styled-components";

export const StyledTermsNotice = styled.p`
  margin: 0;
  text-align: center;
  font-size: 1.3rem;
  line-height: 1.5;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};

  a {
    color: ${({ theme }) => theme.colors.orange[400]};
    font-weight: 700;
  }
`;
