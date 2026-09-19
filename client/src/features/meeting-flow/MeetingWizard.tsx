import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { HiArrowLeft, HiArrowRight } from "react-icons/hi2";

import { useProjects } from "../../hooks/useProjects";
import { useTalks } from "../../hooks/useTalks";
import { useFavorites } from "../../hooks/useFavorites";
import { useTalkFilters } from "../../hooks/useTalkFilters";
import { useCreateMeetingLog } from "../../hooks/useCreateMeetingLog";
import { useCreateSignature } from "../../hooks/useCreateSignature";
import { useUploadSignatureBlob } from "../../hooks/useUploadSignatureBlob";
import { useUploadCrewPhoto } from "../../hooks/useUploadCrewPhoto";
import { useCompleteMeetingLog } from "../../hooks/useCompleteMeetingLog";
import {
  clearDraft,
  getActiveDraft,
  putDraft,
} from "../../utils/db/meetingDraftCache";
import { Button } from "../../ui_comps/button";
import { ConfirmDialog } from "../../ui_comps/confirm-dialog";
import { Spinner } from "../../ui_comps/spinner";
import { TalkFilters } from "../content-library/TalkFilters";
import { TalkList } from "../content-library/TalkList";
import { PhotoCapture } from "./PhotoCapture";
import { ProjectPicker } from "./ProjectPicker";
import { TalkPresenter } from "./TalkPresenter";
import { SignaturesStep } from "./SignaturesStep";
import type { Project } from "../../interfaces/project";
import type { Talk } from "../../interfaces/talk";
import type {
  DraftSigner,
  MeetingDraftData,
  WizardStep,
} from "../../interfaces/meetingDraft";
import {
  StyledStepEyebrow,
  StyledStepHeaderRow,
  StyledStepHint,
  StyledStepTitle,
  StyledSummaryLine,
  StyledWizardError,
  StyledWizardWrapper,
} from "./styles";

type PendingResume = {
  project: Project;
  talk: Talk | undefined;
  data: MeetingDraftData;
};

/**
 * The Phase 4g meeting wizard: project -> talk -> present -> signatures ->
 * photo -> save. Everything before Save is local-only, persisted into the
 * singleton `meetingDraftCache` row as the wizard advances so a foreman
 * interrupted mid-flow (locked screen, backgrounded tab, low battery) can
 * resume instead of losing already-collected signatures -- see
 * docs/meeting-flow-design.md's "Draft resume". The final Save step also
 * enqueues a completion row once every signature has a checkpointed id, so
 * `PATCH /api/meetings/:id/complete` fires once everything has actually
 * synced -- see docs/tasks.md Phase 4h.
 */
export const MeetingWizard = () => {
  const navigate = useNavigate();
  const {
    projects,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
  } = useProjects(false);
  const {
    talks,
    tradeOptions,
    isLoading: isTalksLoading,
    isError: isTalksError,
  } = useTalks();
  const { favoriteIds } = useFavorites();
  const {
    trade,
    setTrade,
    search,
    setSearch,
    favoritesOnly,
    setFavoritesOnly,
    customOnly,
    setCustomOnly,
    tradeFilterOptions,
    visibleTalks,
  } = useTalkFilters(talks, tradeOptions, favoriteIds);

  const { createMeetingLog } = useCreateMeetingLog();
  const { createSignature } = useCreateSignature();
  const { uploadSignatureBlob } = useUploadSignatureBlob();
  const { uploadCrewPhoto } = useUploadCrewPhoto();
  const { completeMeetingLog } = useCompleteMeetingLog();

  const [hasCheckedDraft, setHasCheckedDraft] = useState(false);
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(
    null,
  );
  const [pendingBackTarget, setPendingBackTarget] = useState<WizardStep | null>(
    null,
  );

  const [step, setStep] = useState<WizardStep>("project");
  const [selectedProject, setSelectedProject] = useState<Project | undefined>(
    undefined,
  );
  const [selectedTalk, setSelectedTalk] = useState<Talk | undefined>(undefined);
  const [signers, setSigners] = useState<DraftSigner[]>([]);
  const [photoBlob, setPhotoBlob] = useState<Blob | null | undefined>(
    undefined,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Mirrors checkpointsRef.current.meetingLogId for render purposes only --
  // refs can't be read during render (react-hooks/refs), so this tracks the
  // one bit the "save" step's JSX needs to know: has a Save attempt already
  // committed a meeting log server-side, past which point going Back is
  // unsafe (see the "save" step render below).
  const [meetingLogCommitted, setMeetingLogCommitted] = useState(false);

  // Save-phase checkpoints. Mutated in place (not React state) and mirrored
  // into the persisted draft, so a retried Save after a partial failure never
  // re-creates a record that already landed -- see handleSave below.
  const checkpointsRef = useRef<{
    meetingLogId?: string;
    photoUploaded?: boolean;
    completionEnqueued?: boolean;
  }>({});

  // Runs once, after both queries have settled, to check for and offer to
  // resume an in-progress draft. Guarded by hasCheckedDraft rather than an
  // empty dependency array so it correctly waits out the initial loading
  // state of useProjects instead of racing it. Only waits on isTalksLoading
  // when the draft actually references a talk (row.talkId set) -- a draft
  // still at the project/talk step doesn't need the talk list at all, so
  // gating on it too would leave a slow/offline talks fetch blocking the
  // user from even picking a project. For a draft past the talk step, though,
  // resolving row.talkId against a still-empty `talks` would wrongly look
  // identical to the talk having been deleted, so this waits for that fetch
  // to settle (re-running via the isTalksLoading/talks deps below) before
  // deciding.
  useEffect(() => {
    if (hasCheckedDraft || isProjectsLoading) return;

    let cancelled = false;

    getActiveDraft().then((row) => {
      if (cancelled) return;

      if (!row) {
        setHasCheckedDraft(true);
        return;
      }

      const project = projects.find((p) => p.id === row.projectId);
      if (!project) {
        // The referenced project no longer resolves (archived/deleted since
        // the draft was written) -- nothing safe to resume.
        clearDraft().finally(() => setHasCheckedDraft(true));
        return;
      }

      if (row.talkId && isTalksLoading) return;

      const talk = row.talkId
        ? talks.find((t) => t.id === row.talkId)
        : undefined;

      setPendingResume({
        project,
        talk,
        data: row.data as unknown as MeetingDraftData,
      });
      setHasCheckedDraft(true);
    });

    return () => {
      cancelled = true;
    };
  }, [hasCheckedDraft, isProjectsLoading, isTalksLoading, projects, talks]);

  // Safety net for a talk that's still missing after resume (e.g. deleted
  // from the library between the draft being written and now, so the lookup
  // above legitimately found nothing to resolve). Every step past "talk"
  // requires selectedTalk to render (see the step guards below) -- without
  // this, a missing talk would leave the wizard showing nothing.
  useEffect(() => {
    if (!hasCheckedDraft || selectedTalk) return;

    const requiresTalk =
      step === "present" ||
      step === "signatures" ||
      step === "photo" ||
      step === "save";
    if (!requiresTalk) return;

    toast.error("That talk is no longer available. Pick another to continue.");
    setStep("talk");
  }, [hasCheckedDraft, selectedTalk, step]);

  // Every call site is reached only after the project step has already
  // committed a selection -- see the step guards below -- so a non-null
  // assertion on selectedProject documents a real invariant rather than
  // adding a runtime check for a state that can't occur, per this codebase's
  // error-handling convention. selectedTalk is different: Back can now land
  // here on the "project" step (via goToStep("project")) before any talk has
  // ever been picked, so it falls back to null exactly like
  // handleSelectProject's own explicit `talkId: null` does at that same edge.
  const persistStep = (
    nextStep: WizardStep,
    overrides: Partial<Pick<MeetingDraftData, "signers" | "photoBlob">> = {},
  ) => {
    const data: MeetingDraftData = {
      currentStep: nextStep,
      signers: overrides.signers ?? signers,
      photoBlob: "photoBlob" in overrides ? overrides.photoBlob : photoBlob,
      meetingLogId: checkpointsRef.current.meetingLogId,
      photoUploaded: checkpointsRef.current.photoUploaded,
      completionEnqueued: checkpointsRef.current.completionEnqueued,
    };

    void putDraft({
      projectId: selectedProject!.id,
      talkId: selectedTalk?.id ?? null,
      status: "in_progress",
      updatedAt: new Date().toISOString(),
      data: data as unknown as Record<string, unknown>,
    });
  };

  const handleDiscardDraft = async () => {
    await clearDraft();
    setPendingResume(null);
  };

  const handleResumeDraft = () => {
    // onClose only ever fires while the dialog is open, which is gated on
    // pendingResume being set (isOpen={!!pendingResume} below) -- a Modal
    // with isOpen=false renders nothing, so there's no interactive surface
    // to invoke this while pendingResume is null.
    const { project, talk, data } = pendingResume!;

    setSelectedProject(project);
    setSelectedTalk(talk);
    setSigners(data.signers ?? []);
    setPhotoBlob(data.photoBlob);
    checkpointsRef.current = {
      meetingLogId: data.meetingLogId,
      photoUploaded: data.photoUploaded,
      completionEnqueued: data.completionEnqueued,
    };
    setMeetingLogCommitted(!!data.meetingLogId);
    setStep(data.currentStep ?? "project");
    setPendingResume(null);
  };

  const goToStep = (target: WizardStep) => {
    setStep(target);
    persistStep(target);
  };

  // Going back to "talk" or "project" while signers are already collected
  // would strand them -- a DraftSigner's quizAnswers are scored against
  // whichever talk was selected at signing time, so changing the talk after
  // the fact leaves them referring to a quiz the crew was never shown. Every
  // other backward step (present/signatures/photo/save) is non-destructive,
  // since none of them let the talk or project change.
  const handleBack = (target: WizardStep) => {
    const destructive =
      (target === "talk" || target === "project") && signers.length > 0;
    if (destructive) {
      setPendingBackTarget(target);
      return;
    }
    goToStep(target);
  };

  const confirmDestructiveBack = () => {
    // onConfirm only ever fires while the dialog is open, which is gated on
    // pendingBackTarget being set (isOpen={!!pendingBackTarget} below).
    const target = pendingBackTarget!;
    setSigners([]);
    setPendingBackTarget(null);
    setStep(target);
    persistStep(target, { signers: [] });
  };

  const renderBackButton = (target: WizardStep) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      leftIcon={<HiArrowLeft aria-hidden="true" />}
      onClick={() => handleBack(target)}
    >
      Back
    </Button>
  );

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setStep("talk");
    void putDraft({
      projectId: project.id,
      talkId: null,
      status: "in_progress",
      updatedAt: new Date().toISOString(),
      data: {
        currentStep: "talk",
        signers: [],
        photoBlob: undefined,
      } as unknown as Record<string, unknown>,
    });
  };

  const handleSelectTalk = (talk: Talk) => {
    setSelectedTalk(talk);
    setStep("present");
    // The talk step is only reachable after the project step has committed
    // a selection (see handleSelectProject), so selectedProject is always
    // set here.
    void putDraft({
      projectId: selectedProject!.id,
      talkId: talk.id,
      status: "in_progress",
      updatedAt: new Date().toISOString(),
      data: {
        currentStep: "present",
        signers,
        photoBlob,
      } as unknown as Record<string, unknown>,
    });
  };

  const handlePresentContinue = () => {
    setStep("signatures");
    persistStep("signatures");
  };

  const handleAddSigner = (signer: DraftSigner) => {
    const nextSigners = [...signers, signer];
    setSigners(nextSigners);
    persistStep("signatures", { signers: nextSigners });
  };

  const handleRemoveSigner = (localId: string) => {
    const nextSigners = signers.filter((s) => s.localId !== localId);
    setSigners(nextSigners);
    persistStep("signatures", { signers: nextSigners });
  };

  const handleSignaturesContinue = () => {
    setStep("photo");
    persistStep("photo");
  };

  const handlePhotoCapture = (file: File) => {
    setPhotoBlob(file);
    setStep("save");
    persistStep("save", { photoBlob: file });
  };

  const handlePhotoSkip = () => {
    setPhotoBlob(null);
    setStep("save");
    persistStep("save", { photoBlob: null });
  };

  const handleSave = async () => {
    // The Save button only renders at the "save" step, reachable only after
    // both the project and talk steps have committed a selection.
    setIsSaving(true);
    setSaveError(null);

    try {
      let meetingLogId = checkpointsRef.current.meetingLogId;
      if (!meetingLogId) {
        meetingLogId = await createMeetingLog({
          projectId: selectedProject!.id,
          talkId: selectedTalk!.id,
        });
        checkpointsRef.current.meetingLogId = meetingLogId;
        setMeetingLogCommitted(true);
        persistStep("save");
      }

      const nextSigners = [...signers];
      for (let index = 0; index < nextSigners.length; index += 1) {
        const signer = nextSigners[index];

        let signatureId = signer.signatureId;
        if (!signatureId) {
          signatureId = await createSignature({
            meetingId: meetingLogId,
            workerName: signer.workerName,
            quizAnswers: signer.quizAnswers ?? undefined,
          });
          nextSigners[index] = { ...signer, signatureId };
          setSigners([...nextSigners]);
          persistStep("save", { signers: nextSigners });
        }

        if (!nextSigners[index].blobUploaded) {
          await uploadSignatureBlob({
            meetingId: meetingLogId,
            signatureId,
            blob: nextSigners[index].signatureBlob,
          });
          nextSigners[index] = { ...nextSigners[index], blobUploaded: true };
          setSigners([...nextSigners]);
          persistStep("save", { signers: nextSigners });
        }
      }

      if (photoBlob && !checkpointsRef.current.photoUploaded) {
        await uploadCrewPhoto({ meetingId: meetingLogId, blob: photoBlob });
        checkpointsRef.current.photoUploaded = true;
        persistStep("save");
      }

      if (!checkpointsRef.current.completionEnqueued) {
        await completeMeetingLog({
          meetingId: meetingLogId,
          // Every signer's loop above guarantees signatureId is set before
          // falling through to this point.
          signatureIds: nextSigners.map((s) => s.signatureId!),
        });
        checkpointsRef.current.completionEnqueued = true;
        persistStep("save");
      }

      await clearDraft();
      toast.success("Meeting saved.");
      navigate("/dashboard");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Something went wrong saving the meeting. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasCheckedDraft) {
    return <Spinner center message="Checking for an in-progress meeting…" />;
  }

  return (
    <StyledWizardWrapper>
      <ConfirmDialog
        isOpen={!!pendingResume}
        title="Resume in-progress meeting?"
        confirmLabel="Discard draft"
        cancelText="Keep draft"
        confirmVariant="danger"
        onConfirm={handleDiscardDraft}
        onClose={handleResumeDraft}
      >
        You have a meeting draft in progress for{" "}
        <strong>{pendingResume?.project.name}</strong> with{" "}
        {pendingResume?.data.signers?.length ?? 0} signature
        {pendingResume?.data.signers?.length === 1 ? "" : "s"} already
        collected. Discard it and start over, or keep it to pick up where you
        left off.
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={!!pendingBackTarget}
        title="Discard collected signatures?"
        confirmLabel="Discard and go back"
        cancelText="Stay here"
        confirmVariant="danger"
        onConfirm={confirmDestructiveBack}
        onClose={() => setPendingBackTarget(null)}
      >
        Going back to{" "}
        {pendingBackTarget === "project" ? "the project step" : "pick a different talk"}{" "}
        will discard the {signers.length} signature
        {signers.length === 1 ? "" : "s"} already collected for this talk.
      </ConfirmDialog>

      {step === "project" && (
        <>
          <StyledStepEyebrow>Step 1 of 6</StyledStepEyebrow>
          <StyledStepTitle>Pick a project</StyledStepTitle>
          {isProjectsLoading && <Spinner center message="Loading projects…" />}
          {isProjectsError && (
            <StyledWizardError role="alert">
              Could not load your projects. Refresh to try again.
            </StyledWizardError>
          )}
          {!isProjectsLoading && !isProjectsError && (
            <ProjectPicker projects={projects} onSelect={handleSelectProject} />
          )}
        </>
      )}

      {step === "talk" && (
        <>
          <StyledStepHeaderRow>
            <StyledStepEyebrow>Step 2 of 6</StyledStepEyebrow>
            {renderBackButton("project")}
          </StyledStepHeaderRow>
          <StyledStepTitle>Pick a talk</StyledStepTitle>
          <StyledStepHint>Select a talk to present to the crew.</StyledStepHint>
          <TalkFilters
            trade={trade}
            onTradeChange={setTrade}
            tradeFilterOptions={tradeFilterOptions}
            search={search}
            onSearchChange={setSearch}
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            customOnly={customOnly}
            onCustomOnlyChange={setCustomOnly}
          />
          {isTalksLoading && <Spinner center message="Loading talks…" />}
          {isTalksError && (
            <StyledWizardError role="alert">
              Could not load the talk library. Refresh to try again.
            </StyledWizardError>
          )}
          {!isTalksLoading && !isTalksError && (
            <TalkList
              talks={visibleTalks}
              favoriteIds={favoriteIds}
              onSelect={handleSelectTalk}
            />
          )}
        </>
      )}

      {step === "present" && selectedTalk && (
        <>
          <StyledStepHeaderRow>
            <StyledStepEyebrow>Step 3 of 6</StyledStepEyebrow>
            {renderBackButton("talk")}
          </StyledStepHeaderRow>
          <StyledStepTitle>{selectedTalk.title}</StyledStepTitle>
          <TalkPresenter
            talk={selectedTalk}
            onContinue={handlePresentContinue}
          />
        </>
      )}

      {step === "signatures" && selectedTalk && (
        <>
          <StyledStepHeaderRow>
            <StyledStepEyebrow>Step 4 of 6</StyledStepEyebrow>
            {renderBackButton("present")}
          </StyledStepHeaderRow>
          <StyledStepTitle>Collect signatures</StyledStepTitle>
          <SignaturesStep
            talk={selectedTalk}
            signers={signers}
            onAddSigner={handleAddSigner}
            onRemoveSigner={handleRemoveSigner}
            onContinue={handleSignaturesContinue}
          />
        </>
      )}

      {step === "photo" && (
        <>
          <StyledStepHeaderRow>
            <StyledStepEyebrow>Step 5 of 6</StyledStepEyebrow>
            {renderBackButton("signatures")}
          </StyledStepHeaderRow>
          <StyledStepTitle>Crew photo</StyledStepTitle>
          <PhotoCapture
            onCapture={handlePhotoCapture}
            onSkip={handlePhotoSkip}
          />
        </>
      )}

      {step === "save" && (
        <>
          <StyledStepHeaderRow>
            <StyledStepEyebrow>Step 6 of 6</StyledStepEyebrow>
            {/* Hidden once a Save attempt has actually started writing to
                the server (meetingLogId checkpointed) -- going back at that
                point would risk re-picking state against a meeting log that
                already exists remotely. */}
            {!meetingLogCommitted && renderBackButton("photo")}
          </StyledStepHeaderRow>
          <StyledStepTitle>Save this meeting</StyledStepTitle>
          <StyledSummaryLine>
            {signers.length} signature{signers.length === 1 ? "" : "s"}{" "}
            collected{photoBlob ? " with a crew photo." : "."}
          </StyledSummaryLine>
          {saveError && (
            <StyledWizardError role="alert">{saveError}</StyledWizardError>
          )}
          <Button
            type="button"
            onClick={handleSave}
            loading={isSaving}
            rightIcon={<HiArrowRight aria-hidden="true" />}
          >
            Save meeting
          </Button>
        </>
      )}
    </StyledWizardWrapper>
  );
};
