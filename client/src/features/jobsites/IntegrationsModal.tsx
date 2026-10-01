import { Button } from "../../ui_comps/button";
import { Modal } from "../../ui_comps/modal";
import { Spinner } from "../../ui_comps/spinner";
import { useOnlineStatus } from "../../context/online-status";
import { useDisconnectIntegration } from "../../hooks/useDisconnectIntegration";
import { useJobsiteIntegrations } from "../../hooks/useJobsiteIntegrations";
import { useRetryPush } from "../../hooks/useRetryPush";
import { INTEGRATION_PROVIDERS } from "../../data/integrationProviders";
import type { Jobsite } from "../../interfaces/jobsite";
import { IntegrationConnectForm } from "./IntegrationConnectForm";
import {
  StyledIntegrationCard,
  StyledIntegrationError,
  StyledIntegrationHeader,
  StyledIntegrationTitle,
  StyledNote,
  StyledRosterMain,
  StyledRosterRow,
  StyledRosterSection,
  StyledRosterStatus,
} from "./styles";

interface IntegrationsModalProps {
  jobsite: Jobsite;
  onClose: () => void;
}

/**
 * Connect a jobsite to the GC's own Procore / Autodesk ACC project (Phase 9f,
 * docs/integrations-design.md). Once connected, each sealed meeting PDF for
 * this jobsite is pushed to the project automatically; failed sends can be
 * retried here. Credentials are never shown again after saving.
 */
export const IntegrationsModal = ({ jobsite, onClose }: IntegrationsModalProps) => {
  const { isOnline } = useOnlineStatus();
  const { integrations, recentPushes, isLoading, isError } = useJobsiteIntegrations(jobsite.id);
  const { disconnectIntegration, isDisconnecting } = useDisconnectIntegration();
  const { retryPush, retryingPushId } = useRetryPush();

  return (
    <Modal isOpen onClose={onClose} title={`${jobsite.name} — integrations`}>
      <StyledRosterSection>
        <StyledNote>
          Send every completed safety-talk report to your project&apos;s Documents
          automatically. You bring your own Procore or Autodesk ACC credentials;
          they&apos;re encrypted and never shown again.
        </StyledNote>

        {!isOnline && (
          <StyledNote role="status">
            You&apos;re offline. Connect to the internet to manage integrations.
          </StyledNote>
        )}

        {isLoading && <Spinner center message="Loading integrations…" />}
        {isError && (
          <StyledNote role="alert">
            Could not load integrations. Refresh to try again.
          </StyledNote>
        )}

        {!isLoading &&
          !isError &&
          INTEGRATION_PROVIDERS.map((config) => {
            const connected = integrations.find(
              (integration) => integration.provider === config.provider,
            );
            const failedPushes = connected
              ? recentPushes.filter(
                  (push) => push.integrationId === connected.id && push.status === "failed",
                )
              : [];

            return (
              <StyledIntegrationCard key={config.provider}>
                <StyledIntegrationHeader>
                  <StyledIntegrationTitle>{config.label}</StyledIntegrationTitle>
                  {connected && (
                    <StyledRosterStatus $accepted={connected.status === "connected"}>
                      {connected.status === "connected" ? "Connected" : "Needs attention"}
                    </StyledRosterStatus>
                  )}
                </StyledIntegrationHeader>

                {connected ? (
                  <>
                    <StyledNote>
                      Project {connected.externalProjectId}
                      {connected.externalFolderId
                        ? `, folder ${connected.externalFolderId}`
                        : ""}
                    </StyledNote>
                    {connected.lastError && (
                      <StyledIntegrationError role="alert">
                        Last send failed: {connected.lastError}
                      </StyledIntegrationError>
                    )}
                    {failedPushes.map((push) => (
                      <StyledRosterRow key={push.id}>
                        <StyledRosterMain>
                          <StyledNote>
                            Report not sent ({new Date(push.attemptedAt).toLocaleString()})
                          </StyledNote>
                        </StyledRosterMain>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          loading={retryingPushId === push.id}
                          disabled={!isOnline}
                          onClick={() => retryPush({ pushId: push.id, jobsiteId: jobsite.id })}
                        >
                          Retry
                        </Button>
                      </StyledRosterRow>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      loading={isDisconnecting}
                      disabled={!isOnline}
                      onClick={() =>
                        disconnectIntegration({
                          jobsiteId: jobsite.id,
                          provider: config.provider,
                        })
                      }
                      aria-label={`Disconnect ${config.label}`}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <StyledNote>{config.help}</StyledNote>
                    <IntegrationConnectForm jobsiteId={jobsite.id} config={config} />
                  </>
                )}
              </StyledIntegrationCard>
            );
          })}
      </StyledRosterSection>
    </Modal>
  );
};
