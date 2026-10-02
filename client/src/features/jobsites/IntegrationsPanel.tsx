import { Button } from "../../ui_comps/button";
import { Spinner } from "../../ui_comps/spinner";
import { useOnlineStatus } from "../../context/online-status";
import type { IntegrationProviderConfig } from "../../data/integrationProviders";
import type {
  ConnectFormValues,
  IntegrationProvider,
  IntegrationPush,
  JobsiteIntegration,
} from "../../interfaces/integration";
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

interface IntegrationsPanelProps {
  /** Intro copy above the provider cards. */
  intro: string;
  providers: IntegrationProviderConfig[];
  integrations: JobsiteIntegration[];
  recentPushes: IntegrationPush[];
  isLoading: boolean;
  isError: boolean;
  onConnect: (values: ConnectFormValues) => Promise<unknown>;
  isConnecting: boolean;
  onDisconnect: (provider: IntegrationProvider) => void;
  isDisconnecting: boolean;
  onRetry: (pushId: string) => void;
  retryingPushId: string | null;
}

/** The provider cards shared by the GC jobsite and the sub project integration
 *  modals: connect form, status, failed pushes with Retry, Disconnect. The
 *  caller owns the data and mutations (docs/integrations-design.md). */
export const IntegrationsPanel = ({
  intro,
  providers,
  integrations,
  recentPushes,
  isLoading,
  isError,
  onConnect,
  isConnecting,
  onDisconnect,
  isDisconnecting,
  onRetry,
  retryingPushId,
}: IntegrationsPanelProps) => {
  const { isOnline } = useOnlineStatus();

  return (
    <StyledRosterSection>
      <StyledNote>{intro}</StyledNote>

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
        providers.map((config) => {
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
                        onClick={() => onRetry(push.id)}
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
                    onClick={() => onDisconnect(config.provider)}
                    aria-label={`Disconnect ${config.label}`}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <>
                  <StyledNote>{config.help}</StyledNote>
                  <IntegrationConnectForm
                    config={config}
                    onConnect={onConnect}
                    isConnecting={isConnecting}
                  />
                </>
              )}
            </StyledIntegrationCard>
          );
        })}
    </StyledRosterSection>
  );
};
