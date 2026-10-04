import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { useOnlineStatus } from "../../context/online-status";
import { useLinkProjectToGc } from "../../hooks/useLinkProjectToGc";
import type { Project } from "../../interfaces/project";
import { StyledActions, StyledLinkNote } from "./styles";

// Mirrors the join-code validator in server/routes/projects.js.
const joinCodeSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .min(1, "Enter the GC's join code")
    .max(32, "That join code is too long"),
});

type JoinCodeValues = z.infer<typeof joinCodeSchema>;

interface GcLinkModalProps {
  project: Project;
  onClose: () => void;
}

/**
 * The "Link to GC" / "Unlink GC" action for one project, opened from its card
 * on the Projects page. Rendered only while open, so the join-code field starts
 * empty every time. A project that isn't linked asks for the GC's join code; a
 * linked one asks to confirm unlinking. Closes itself once the link or unlink
 * succeeds; a failure stays open (the hook already toasts the server's reason).
 *
 * Online-only: the server validates the code against a live GC company, so
 * offline shows an explanation and disables the action instead of queueing.
 * Who may see the action (subcontractors only) is decided by the page.
 */
export const GcLinkModal = ({ project, onClose }: GcLinkModalProps) => {
  const { isOnline } = useOnlineStatus();
  const { linkProject, unlinkProject, isLinking, isUnlinking } =
    useLinkProjectToGc();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinCodeValues>({
    resolver: zodResolver(joinCodeSchema),
    mode: "onTouched",
    defaultValues: { joinCode: "" },
  });

  const isLinked = Boolean(project.gcCompanyId);
  const joinCodeId = "project-join-code";

  const onLink = async ({ joinCode }: JoinCodeValues) => {
    try {
      // Codes are generated uppercase; normalize what the foreman typed.
      await linkProject({ id: project.id, joinCode: joinCode.toUpperCase() });
      onClose();
    } catch {
      // useLinkProjectToGc already surfaces the failure as a toast.
    }
  };

  const onUnlink = async () => {
    try {
      await unlinkProject(project.id);
      onClose();
    } catch {
      // useLinkProjectToGc already surfaces the failure as a toast.
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isLinked ? "Unlink from GC" : "Link to a general contractor"}
    >
      {!isOnline && (
        <StyledLinkNote role="status">
          You're offline. Connect to the internet to link or unlink this
          project.
        </StyledLinkNote>
      )}

      {isLinked ? (
        <>
          <StyledLinkNote>
            Unlink <strong>{project.name}</strong> from{" "}
            <strong>{project.gcNameCustom}</strong>? They will stop seeing this
            project's safety talks. Nothing is deleted, and you can link again
            with their join code.
          </StyledLinkNote>
          <StyledActions>
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={isUnlinking}
              disabled={!isOnline}
              onClick={onUnlink}
            >
              Unlink
            </Button>
          </StyledActions>
        </>
      ) : (
        <Form onSubmit={handleSubmit(onLink)} noValidate>
          <StyledLinkNote>
            Enter the join code your general contractor gave you. Their
            registered name replaces the one on{" "}
            <strong>{project.name}</strong>, and they can see its completed
            safety talks.
          </StyledLinkNote>
          <FormField
            id={joinCodeId}
            label="GC join code"
            error={errors.joinCode?.message}
          >
            <TextInput
              id={joinCodeId}
              type="text"
              placeholder="e.g. K7M2Q9XB"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              disabled={!isOnline}
              hasError={!!errors.joinCode}
              {...register("joinCode")}
            />
          </FormField>
          <StyledActions>
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isLinking}
              disabled={!isOnline}
            >
              Link to GC
            </Button>
          </StyledActions>
        </Form>
      )}
    </Modal>
  );
};
