import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { useOnlineStatus } from "../../context/online-status";
import type { ConnectFormValues } from "../../interfaces/integration";
import type { IntegrationProviderConfig } from "../../data/integrationProviders";

const REQUIRED = "This field is required";

type ConnectValues = Record<string, string>;

// Mirrors the server's validators (routes/integrations.js) and per-provider
// field rules (services/integrations/index.js PROVIDER_FIELDS).
const buildSchema = (config: IntegrationProviderConfig) =>
  z.object({
    ...Object.fromEntries(
      config.credentialFields.map((field) => [
        field.name,
        z.string().trim().min(1, REQUIRED),
      ]),
    ),
    projectId: z.string().trim().min(1, REQUIRED),
    folderId: config.folderRequired
      ? z.string().trim().min(1, REQUIRED)
      : z.string().trim(),
  });

interface IntegrationConnectFormProps {
  config: IntegrationProviderConfig;
  /** Sends the values to the server; rejects when it refuses them. The caller's
   *  hook already surfaces the failure as a toast. */
  onConnect: (values: ConnectFormValues) => Promise<unknown>;
  isConnecting: boolean;
}

/** Paste a customer-owned service account / API key to connect one jobsite or
 *  project. The server verifies it against the provider before storing it. */
export const IntegrationConnectForm = ({
  config,
  onConnect,
  isConnecting,
}: IntegrationConnectFormProps) => {
  const { isOnline } = useOnlineStatus();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConnectValues>({
    resolver: zodResolver(buildSchema(config)),
    mode: "onTouched",
    defaultValues: {
      ...Object.fromEntries(config.credentialFields.map((field) => [field.name, ""])),
      projectId: "",
      folderId: "",
    },
  });

  const onSubmit = async (values: ConnectValues) => {
    try {
      await onConnect({
        provider: config.provider,
        credentials: Object.fromEntries(
          config.credentialFields.map((field) => [field.name, values[field.name]]),
        ),
        projectId: values.projectId,
        folderId: values.folderId || undefined,
      });
      reset();
    } catch {
      // The connect hook already surfaces the failure as a toast.
    }
  };

  const fieldId = (name: string) => `${config.provider}-${name}`;

  return (
    <Form onSubmit={handleSubmit(onSubmit)} noValidate>
      {config.credentialFields.map((field) => (
        <FormField
          key={field.name}
          id={fieldId(field.name)}
          label={field.label}
          error={errors[field.name]?.message}
        >
          <TextInput
            id={fieldId(field.name)}
            type={field.secret ? "password" : "text"}
            autoComplete="off"
            disabled={!isOnline}
            hasError={!!errors[field.name]}
            {...register(field.name)}
          />
        </FormField>
      ))}

      <FormField
        id={fieldId("projectId")}
        label={config.projectLabel}
        error={errors.projectId?.message}
      >
        <TextInput
          id={fieldId("projectId")}
          autoComplete="off"
          disabled={!isOnline}
          hasError={!!errors.projectId}
          {...register("projectId")}
        />
      </FormField>

      {config.hasFolder && (
        <FormField
          id={fieldId("folderId")}
          label={config.folderLabel}
          error={errors.folderId?.message}
        >
          <TextInput
            id={fieldId("folderId")}
            autoComplete="off"
            disabled={!isOnline}
            hasError={!!errors.folderId}
            {...register("folderId")}
          />
        </FormField>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={isConnecting}
        disabled={!isOnline}
      >
        {`Connect ${config.label}`}
      </Button>
    </Form>
  );
};
