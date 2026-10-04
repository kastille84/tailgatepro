import { useRequiredTopic } from "../../hooks/useRequiredTopic";
import { StyledRequiredTopicBanner } from "./styles";

interface RequiredTopicBannerProps {
  projectId: string | undefined;
}

/** A soft nudge toward the linked GC's currently pushed required topic
 *  (Phase 9e, docs/policy-push-design.md) -- never a block. Renders nothing
 *  while loading, on error, offline, or when there's simply no topic
 *  currently required; this is decoration, not a gate. */
export const RequiredTopicBanner = ({ projectId }: RequiredTopicBannerProps) => {
  const { requiredTopic } = useRequiredTopic(projectId);

  if (!requiredTopic?.talkId) return null;

  return (
    <StyledRequiredTopicBanner>
      Your GC requires this topic: {requiredTopic.talkTitle ?? "Unknown talk"}
    </StyledRequiredTopicBanner>
  );
};
