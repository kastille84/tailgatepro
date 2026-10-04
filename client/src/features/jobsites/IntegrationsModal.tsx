import { Modal } from "../../ui_comps/modal";
import { useConnectIntegration } from "../../hooks/useConnectIntegration";
import { useDisconnectIntegration } from "../../hooks/useDisconnectIntegration";
import { useJobsiteIntegrations } from "../../hooks/useJobsiteIntegrations";
import { useRetryPush } from "../../hooks/useRetryPush";
import { GC_INTEGRATION_PROVIDERS } from "../../data/integrationProviders";
import type { Jobsite } from "../../interfaces/jobsite";
import { IntegrationsPanel } from "./IntegrationsPanel";

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
  const { integrations, recentPushes, isLoading, isError } = useJobsiteIntegrations(jobsite.id);
  const { connectIntegration, isConnecting } = useConnectIntegration();
  const { disconnectIntegration, isDisconnecting } = useDisconnectIntegration();
  const { retryPush, retryingPushId } = useRetryPush();

  return (
    <Modal isOpen onClose={onClose} title={`${jobsite.name} — integrations`}>
      <IntegrationsPanel
        intro="Send every completed safety-talk report to your project's Documents automatically. You bring your own Procore or Autodesk ACC credentials; they're encrypted and never shown again."
        providers={GC_INTEGRATION_PROVIDERS}
        integrations={integrations}
        recentPushes={recentPushes}
        isLoading={isLoading}
        isError={isError}
        onConnect={(values) => connectIntegration({ ...values, jobsiteId: jobsite.id })}
        isConnecting={isConnecting}
        onDisconnect={(provider) =>
          disconnectIntegration({ jobsiteId: jobsite.id, provider })
        }
        isDisconnecting={isDisconnecting}
        onRetry={(pushId) => retryPush({ pushId, jobsiteId: jobsite.id })}
        retryingPushId={retryingPushId}
      />
    </Modal>
  );
};
