import type { PolicyPushState } from "../../interfaces/policyPush";
import { StyledCard, StyledCardTitle, StyledNoPush, StyledTopicMeta, StyledTopicTitle } from "./styles";

interface CurrentPushCardProps {
  push: PolicyPushState;
}

const formatPushedAt = (pushedAt: string) =>
  new Date(pushedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** The GC's currently pushed required topic, or an empty state when nothing
 *  is pushed (Phase 9e, docs/policy-push-design.md). */
export const CurrentPushCard = ({ push }: CurrentPushCardProps) => (
  <StyledCard>
    <StyledCardTitle>Current required topic</StyledCardTitle>
    {push.talkId ? (
      <>
        <StyledTopicTitle>{push.talkTitle ?? "Unknown talk"}</StyledTopicTitle>
        <StyledTopicMeta>
          Pushed{push.pushedAt ? ` ${formatPushedAt(push.pushedAt)}` : ""}
          {push.pushedByName ? ` by ${push.pushedByName}` : ""}
        </StyledTopicMeta>
      </>
    ) : (
      <StyledNoPush>No topic is currently required across your active sites.</StyledNoPush>
    )}
  </StyledCard>
);
