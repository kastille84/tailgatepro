import { HiCheckCircle, HiExclamationTriangle } from "react-icons/hi2";

import {
  StyledBrowserFrame,
  StyledBrowserBar,
  StyledDot,
  StyledUrlPill,
  StyledDashBody,
  StyledDashTitle,
  StyledStatRow,
  StyledStatTile,
  StyledSubList,
  StyledSubRow,
  StyledStatusPill,
  StyledUnlockWrap,
  StyledUnlockChip,
} from "./GcDashboardMockup.styles";

interface GcDashboardMockupProps {
  tone?: "light" | "dark";
}

const STATS = [
  { value: "6 / 7", label: "talks today" },
  { value: "7", label: "subs on site" },
  { value: "92%", label: "compliant" },
];

const SUBS = [
  { name: "Rivera Electric", note: "Logged 6:58 AM", status: "ok" as const },
  { name: "Apex Plumbing", note: "Logged 7:02 AM", status: "ok" as const },
  {
    name: "BuildRight Framing",
    note: "Missing",
    status: "alert" as const,
  },
];

const LABEL =
  "Example general-contractor dashboard — one site view showing which subcontractors have logged today's toolbox talk, with two complete, one missing and one locked pending upgrade.";

/** A stylised sample of the GC compliance dashboard for one site. */
export const GcDashboardMockup = ({ tone = "light" }: GcDashboardMockupProps) => (
  <StyledBrowserFrame $tone={tone} role="img" aria-label={LABEL}>
    <div aria-hidden="true">
      <StyledBrowserBar>
        <StyledDot />
        <StyledDot />
        <StyledDot />
        <StyledUrlPill>app.tailgatepro.com/site/downtown</StyledUrlPill>
      </StyledBrowserBar>

      <StyledDashBody>
        <StyledDashTitle>Downtown Tower — site compliance</StyledDashTitle>

        <StyledStatRow>
          {STATS.map((stat) => (
            <StyledStatTile key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </StyledStatTile>
          ))}
        </StyledStatRow>

        <StyledSubList>
          {SUBS.map((sub) => (
            <StyledSubRow key={sub.name}>
              <span>
                {sub.name} — {sub.note}
              </span>
              <StyledStatusPill $tone={sub.status}>
                {sub.status === "alert" ? (
                  <HiExclamationTriangle aria-hidden="true" />
                ) : (
                  <HiCheckCircle aria-hidden="true" />
                )}
                {sub.status === "alert" ? "Missing" : "Logged"}
              </StyledStatusPill>
            </StyledSubRow>
          ))}

          <StyledUnlockWrap>
            <StyledSubRow $blurred>
              <span>Metro Concrete — Logged 7:11 AM</span>
              <StyledStatusPill $tone="ok">
                <HiCheckCircle aria-hidden="true" />
                Logged
              </StyledStatusPill>
            </StyledSubRow>
            <StyledUnlockChip>Upgrade to unlock</StyledUnlockChip>
          </StyledUnlockWrap>
        </StyledSubList>
      </StyledDashBody>
    </div>
  </StyledBrowserFrame>
);
