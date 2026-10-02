import { Modal } from "../../ui_comps/modal";
import { useConnectProjectIntegration } from "../../hooks/useConnectProjectIntegration";
import { useDisconnectProjectIntegration } from "../../hooks/useDisconnectProjectIntegration";
import { useProjectIntegrations } from "../../hooks/useProjectIntegrations";
import { useRetryProjectPush } from "../../hooks/useRetryProjectPush";
import { SUB_INTEGRATION_PROVIDERS } from "../../data/integrationProviders";
import type { Project } from "../../interfaces/project";
import { IntegrationsPanel } from "../jobsites/IntegrationsPanel";
import {
  StyledUpgradeLink,
  StyledUpgradePrompt,
  StyledUpgradeText,
} from "../jobsites/styles";

interface ProjectIntegrationsModalProps {
  project: Project;
  onClose: () => void;
}

/**
 * Connect one of a sub's projects to their own Procore / JobTread project
 * (Trade Enterprise, docs/integrations-design.md). Each sealed meeting PDF for
 * this project is then pushed there automatically; failed sends can be retried
 * here. Credentials are never shown again after saving. A sub that isn't on
 * Trade Enterprise sees an upgrade prompt instead of the connect forms.
 */
export const ProjectIntegrationsModal = ({
  project,
  onClose,
}: ProjectIntegrationsModalProps) => {
  const { enterprise, integrations, recentPushes, isLoading, isError } =
    useProjectIntegrations(project.id);
  const { connectIntegration, isConnecting } = useConnectProjectIntegration();
  const { disconnectIntegration, isDisconnecting } = useDisconnectProjectIntegration();
  const { retryPush, retryingPushId } = useRetryProjectPush();

  const needsUpgrade = !isLoading && !isError && !enterprise;

  return (
    <Modal isOpen onClose={onClose} title={`${project.name} — integrations`}>
      {needsUpgrade ? (
        <StyledUpgradePrompt>
          <StyledUpgradeText>
            Sending reports to Procore or JobTread is part of Trade Enterprise.
          </StyledUpgradeText>
          <StyledUpgradeLink to="/pricing">See plans</StyledUpgradeLink>
        </StyledUpgradePrompt>
      ) : (
        <IntegrationsPanel
          intro="Send every completed safety-talk report for this project to your own Procore project or JobTread job automatically. You bring your own credentials; they're encrypted and never shown again."
          providers={SUB_INTEGRATION_PROVIDERS}
          integrations={integrations}
          recentPushes={recentPushes}
          isLoading={isLoading}
          isError={isError}
          onConnect={(values) =>
            connectIntegration({ ...values, tailgateProjectId: project.id })
          }
          isConnecting={isConnecting}
          onDisconnect={(provider) =>
            disconnectIntegration({ projectId: project.id, provider })
          }
          isDisconnecting={isDisconnecting}
          onRetry={(pushId) => retryPush({ pushId, projectId: project.id })}
          retryingPushId={retryingPushId}
        />
      )}
    </Modal>
  );
};
