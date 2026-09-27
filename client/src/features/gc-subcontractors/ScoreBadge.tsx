import { StyledLargeScoreBadge, StyledScoreBadge } from "./styles";

interface ScoreBadgeProps {
  score: number;
  /** Larger type for a detail page's headline number. Default fits a list row. */
  size?: "sm" | "lg";
}

// 90%+ reads as "on track," under 70% is worth a closer look -- see
// docs/sub-scorecard-design.md "Scoring model".
const GOOD_THRESHOLD = 90;
const FAIR_THRESHOLD = 70;

const tierFor = (score: number): "good" | "fair" | "poor" => {
  if (score >= GOOD_THRESHOLD) return "good";
  if (score >= FAIR_THRESHOLD) return "fair";
  return "poor";
};

/** A 0-100 rolling compliance score as a colored pill -- green/orange/red,
 *  the numeric-score sibling of gc-dashboard's logged/missing status pill. */
export const ScoreBadge = ({ score, size = "sm" }: ScoreBadgeProps) => {
  const Badge = size === "lg" ? StyledLargeScoreBadge : StyledScoreBadge;
  return <Badge $tier={tierFor(score)}>{score}%</Badge>;
};
