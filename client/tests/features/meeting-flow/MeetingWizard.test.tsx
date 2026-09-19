import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { MeetingWizard } from "../../../src/features/meeting-flow/MeetingWizard";
import theme from "../../../src/styles/theme";
import { tailgateDb } from "../../../src/utils/db/tailgateDb";
import { DRAFT_ROW_ID, putDraft } from "../../../src/utils/db/meetingDraftCache";
import type { Project } from "../../../src/interfaces/project";
import type { Talk } from "../../../src/interfaces/talk";
import type { DraftSigner } from "../../../src/interfaces/meetingDraft";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseProjects = vi.fn();
const mockUseTalks = vi.fn();
const mockUseFavorites = vi.fn();
vi.mock("../../../src/hooks/useProjects", () => ({
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
}));
vi.mock("../../../src/hooks/useTalks", () => ({
  useTalks: (...args: unknown[]) => mockUseTalks(...args),
}));
vi.mock("../../../src/hooks/useFavorites", () => ({
  useFavorites: (...args: unknown[]) => mockUseFavorites(...args),
}));

const mockCreateMeetingLog = vi.fn();
const mockCreateSignature = vi.fn();
const mockUploadSignatureBlob = vi.fn();
const mockUploadCrewPhoto = vi.fn();
const mockCompleteMeetingLog = vi.fn();
vi.mock("../../../src/hooks/useCreateMeetingLog", () => ({
  useCreateMeetingLog: () => ({
    createMeetingLog: mockCreateMeetingLog,
    isCreating: false,
  }),
}));
vi.mock("../../../src/hooks/useCreateSignature", () => ({
  useCreateSignature: () => ({
    createSignature: mockCreateSignature,
    isCreating: false,
  }),
}));
vi.mock("../../../src/hooks/useUploadSignatureBlob", () => ({
  useUploadSignatureBlob: () => ({
    uploadSignatureBlob: mockUploadSignatureBlob,
    isUploading: false,
  }),
}));
vi.mock("../../../src/hooks/useUploadCrewPhoto", () => ({
  useUploadCrewPhoto: () => ({
    uploadCrewPhoto: mockUploadCrewPhoto,
    isUploading: false,
  }),
}));
vi.mock("../../../src/hooks/useCompleteMeetingLog", () => ({
  useCompleteMeetingLog: () => ({
    completeMeetingLog: mockCompleteMeetingLog,
    isCompleting: false,
  }),
}));

// Every composed child has its own test suite (or, for TalkList, is already
// covered by ContentLibrary's) -- stubbed here so this suite stays focused on
// the wizard's own orchestration: step transitions, draft persistence/resume,
// and the Save checkpoint sequence. Mocked by file path, same technique
// ContentLibrary.test.tsx uses for TalkForm.
vi.mock("../../../src/features/meeting-flow/ProjectPicker", () => ({
  ProjectPicker: ({
    projects,
    onSelect,
  }: {
    projects: Project[];
    onSelect: (project: Project) => void;
  }) => (
    <div data-testid="project-picker">
      {projects.map((p) => (
        <button key={p.id} type="button" onClick={() => onSelect(p)}>
          select-project-{p.id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../../../src/features/content-library/TalkList", () => ({
  TalkList: ({
    talks,
    onSelect,
  }: {
    talks: Talk[];
    onSelect: (talk: Talk) => void;
  }) => (
    <div data-testid="talk-list">
      {talks.map((t) => (
        <button key={t.id} type="button" onClick={() => onSelect(t)}>
          select-talk-{t.id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../../../src/features/meeting-flow/TalkPresenter", () => ({
  TalkPresenter: ({ onContinue }: { onContinue: () => void }) => (
    <div data-testid="talk-presenter">
      <button type="button" onClick={onContinue}>
        presenter-continue
      </button>
    </div>
  ),
}));
vi.mock("../../../src/features/meeting-flow/SignaturesStep", () => ({
  SignaturesStep: ({
    signers,
    onAddSigner,
    onRemoveSigner,
    onContinue,
  }: {
    signers: DraftSigner[];
    onAddSigner: (signer: DraftSigner) => void;
    onRemoveSigner: (localId: string) => void;
    onContinue: () => void;
  }) => (
    <div data-testid="signatures-step">
      <span>signers:{signers.length}</span>
      <button
        type="button"
        onClick={() =>
          onAddSigner({
            localId: "sig-1",
            workerName: "Jordan",
            quizAnswers: null,
            signatureBlob: new Blob(["a"], { type: "image/png" }),
          })
        }
      >
        add-signer
      </button>
      {signers[0] && (
        <button
          type="button"
          onClick={() => onRemoveSigner(signers[0].localId)}
        >
          remove-signer
        </button>
      )}
      <button type="button" onClick={onContinue}>
        signatures-continue
      </button>
    </div>
  ),
}));
vi.mock("../../../src/features/meeting-flow/PhotoCapture", () => ({
  PhotoCapture: ({
    onCapture,
    onSkip,
  }: {
    onCapture: (file: File) => void;
    onSkip: () => void;
  }) => (
    <div data-testid="photo-capture">
      <button
        type="button"
        onClick={() =>
          onCapture(new File(["x"], "photo.jpg", { type: "image/jpeg" }))
        }
      >
        capture-photo
      </button>
      <button type="button" onClick={onSkip}>
        skip-photo
      </button>
    </div>
  ),
}));

const project: Project = {
  id: "p1",
  ownerCompanyId: "c1",
  name: "Downtown Highrise",
  gcCompanyId: null,
  gcNameCustom: "Acme GC",
  status: "active",
  archivedAt: null,
  createdAt: "x",
};

const talk: Talk = {
  id: "t1",
  slug: "fall-protection",
  title: "Fall Protection",
  tradeTag: "Roofing",
  tradeTags: ["Roofing"],
  content: "x",
  structured: null,
  attribution: null,
  quiz: null,
  isGlobal: true,
  companyId: null,
  createdAt: "x",
};

const otherTalk: Talk = {
  ...talk,
  id: "t2",
  slug: "silica-dust",
  title: "Silica Dust Exposure",
  tradeTag: "Masonry",
  tradeTags: ["Masonry"],
};

// A fresh element each call -- reusing one frozen JSX element reference for
// both an initial render() and a later rerender() would let React bail out
// of re-rendering entirely (it treats referentially-identical props as
// "nothing could have changed").
const wizardTree = () => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>
      <MeetingWizard />
    </ThemeProvider>
  </MemoryRouter>
);

const renderWizard = () => render(wizardTree());

beforeEach(async () => {
  vi.clearAllMocks();
  await tailgateDb.meetingDraftCache.clear();
  mockUseProjects.mockReturnValue({
    projects: [project],
    isLoading: false,
    isError: false,
  });
  mockUseTalks.mockReturnValue({
    talks: [talk],
    tradeOptions: [{ value: "Roofing", label: "Roofing" }],
    isLoading: false,
    isError: false,
  });
  mockUseFavorites.mockReturnValue({ favoriteIds: new Set() });
  mockCreateMeetingLog.mockResolvedValue("meeting-1");
  mockCreateSignature.mockResolvedValue("sig-server-1");
  mockUploadSignatureBlob.mockResolvedValue(undefined);
  mockUploadCrewPhoto.mockResolvedValue(undefined);
  mockCompleteMeetingLog.mockResolvedValue(undefined);
});

afterEach(async () => {
  await tailgateDb.meetingDraftCache.clear();
});

const advanceToPhotoStep = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: /select-project-p1/i }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /select-talk-t1/i }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /presenter-continue/i }),
  );
  fireEvent.click(await screen.findByRole("button", { name: /add-signer/i }));
  fireEvent.click(screen.getByRole("button", { name: /signatures-continue/i }));
};

describe("MeetingWizard", () => {
  it("starts on the project step when there is no draft", async () => {
    renderWizard();
    expect(await screen.findByTestId("project-picker")).toBeDefined();
  });

  it("discards a draft resolution that arrives after the wizard has unmounted", async () => {
    let resolveGet: (row: undefined) => void = () => {};
    const deferred = new Promise<undefined>((resolve) => {
      resolveGet = resolve;
    });
    const getSpy = vi
      .spyOn(tailgateDb.meetingDraftCache, "get")
      .mockReturnValue(deferred as never);

    const { unmount } = renderWizard();
    unmount();

    resolveGet(undefined);
    await deferred;

    getSpy.mockRestore();
  });

  it("shows a spinner while projects are loading", async () => {
    mockUseProjects.mockReturnValue({
      projects: [],
      isLoading: true,
      isError: false,
    });
    renderWizard();
    expect(await screen.findByRole("status")).toBeDefined();
    expect(screen.queryByTestId("project-picker")).toBeNull();
  });

  it("shows an alert when the projects query fails", async () => {
    mockUseProjects.mockReturnValue({
      projects: [],
      isLoading: false,
      isError: true,
    });
    renderWizard();
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load your projects/i,
    );
  });

  it("shows a spinner while talks are loading, and an alert if the query fails", async () => {
    mockUseTalks.mockReturnValue({
      talks: [],
      tradeOptions: [],
      isLoading: true,
      isError: false,
    });
    renderWizard();
    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByTestId("talk-list")).toBeNull();
  });

  it("shows an alert when the talks query fails", async () => {
    mockUseTalks.mockReturnValue({
      talks: [],
      tradeOptions: [],
      isLoading: false,
      isError: true,
    });
    renderWizard();
    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the talk library/i,
    );
  });

  it("narrows the talk step's list using the trade/search/favorites/custom filters", async () => {
    mockUseTalks.mockReturnValue({
      talks: [talk, otherTalk],
      tradeOptions: [
        { value: "Roofing", label: "Roofing" },
        { value: "Masonry", label: "Masonry" },
      ],
      isLoading: false,
      isError: false,
    });

    renderWizard();
    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );

    expect(await screen.findByTestId("talk-list")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /select-talk-t1/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /select-talk-t2/i }),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText(/^trade$/i), {
      target: { value: "Masonry" },
    });

    expect(screen.queryByRole("button", { name: /select-talk-t1/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /select-talk-t2/i }),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText(/^trade$/i), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText(/^search$/i), {
      target: { value: "fall" },
    });

    expect(
      screen.getByRole("button", { name: /select-talk-t1/i }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /select-talk-t2/i })).toBeNull();
  });

  it("narrows the talk step's list to the signed-in user's real favorites", async () => {
    mockUseTalks.mockReturnValue({
      talks: [talk, otherTalk],
      tradeOptions: [
        { value: "Roofing", label: "Roofing" },
        { value: "Masonry", label: "Masonry" },
      ],
      isLoading: false,
      isError: false,
    });
    mockUseFavorites.mockReturnValue({ favoriteIds: new Set(["t2"]) });

    renderWizard();
    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );

    fireEvent.click(screen.getByLabelText(/favorites only/i));

    expect(screen.queryByRole("button", { name: /select-talk-t1/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /select-talk-t2/i }),
    ).toBeDefined();
  });

  it("shows the project step's own spinner if its query starts loading after the initial draft check", async () => {
    const { rerender } = renderWizard();
    await screen.findByTestId("project-picker");

    mockUseProjects.mockReturnValue({
      projects: [],
      isLoading: true,
      isError: false,
    });
    rerender(wizardTree());

    expect(
      screen.getByRole("status", { name: /loading projects/i }),
    ).toBeDefined();
    expect(screen.queryByTestId("project-picker")).toBeNull();
  });

  it("resumes a draft with no talk selected yet", async () => {
    await putDraft({
      projectId: "p1",
      talkId: null,
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "talk", signers: [], photoBlob: undefined },
    });

    renderWizard();

    expect(
      await screen.findByText(/resume in-progress meeting/i),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /keep draft/i }));

    expect(await screen.findByTestId("talk-list")).toBeDefined();
  });

  it("uses singular wording in the resume prompt for exactly one collected signature", async () => {
    await putDraft({
      projectId: "p1",
      talkId: "t1",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: {
        currentStep: "signatures",
        signers: [
          {
            localId: "s1",
            workerName: "Jordan",
            quizAnswers: null,
            signatureBlob: new Blob(["a"], { type: "image/png" }),
          },
        ],
        photoBlob: undefined,
      },
    });

    renderWizard();

    expect(await screen.findByText(/1 signature already/i)).toBeDefined();
  });

  it("defaults a resumed draft missing signers/currentStep to an empty list and the project step", async () => {
    await putDraft({
      projectId: "p1",
      talkId: "t1",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: {},
    });

    renderWizard();

    expect(
      await screen.findByText(/resume in-progress meeting/i),
    ).toBeDefined();
    expect(screen.getByText(/0 signatures already/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /keep draft/i }));

    expect(await screen.findByTestId("project-picker")).toBeDefined();
  });

  it("walks project -> talk -> present -> signatures -> photo -> save", async () => {
    renderWizard();

    await advanceToPhotoStep();
    fireEvent.click(await screen.findByRole("button", { name: /skip-photo/i }));

    expect(
      await screen.findByRole("button", { name: /save meeting/i }),
    ).toBeDefined();
  });

  it("persists a draft after each step so a reload can offer to resume it", async () => {
    renderWizard();

    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /select-talk-t1/i }),
    );

    await waitFor(async () => {
      const row = await tailgateDb.meetingDraftCache.get(DRAFT_ROW_ID);
      expect(row?.projectId).toBe("p1");
      expect(row?.talkId).toBe("t1");
    });
  });

  it("offers to resume an existing draft on mount, and resumes it on Cancel", async () => {
    await putDraft({
      projectId: "p1",
      talkId: "t1",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "signatures", signers: [], photoBlob: undefined },
    });

    renderWizard();

    expect(
      await screen.findByText(/resume in-progress meeting/i),
    ).toBeDefined();
    expect(screen.getByText(/downtown highrise/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /keep draft/i }));

    expect(await screen.findByTestId("signatures-step")).toBeDefined();
  });

  it("resolves a resumed draft's talk once a slow talks fetch catches up, instead of staying blank", async () => {
    mockUseTalks.mockReturnValue({
      talks: [],
      tradeOptions: [],
      isLoading: true,
      isError: false,
    });

    await putDraft({
      projectId: "p1",
      talkId: "t1",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "present", signers: [], photoBlob: undefined },
    });

    const { rerender } = renderWizard();

    // The draft check is still waiting on isTalksLoading, so it hasn't
    // reached hasCheckedDraft yet -- no resume prompt, no blank wizard body.
    expect(screen.queryByText(/resume in-progress meeting/i)).toBeNull();

    mockUseTalks.mockReturnValue({
      talks: [talk],
      tradeOptions: [{ value: "Roofing", label: "Roofing" }],
      isLoading: false,
      isError: false,
    });
    rerender(wizardTree());

    expect(
      await screen.findByText(/resume in-progress meeting/i),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /keep draft/i }));

    expect(await screen.findByTestId("talk-presenter")).toBeDefined();
  });

  it("falls back to the talk step with a toast when a resumed draft's talk no longer exists", async () => {
    await putDraft({
      projectId: "p1",
      talkId: "deleted-talk",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "signatures", signers: [], photoBlob: undefined },
    });

    renderWizard();

    expect(
      await screen.findByText(/resume in-progress meeting/i),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /keep draft/i }));

    expect(await screen.findByTestId("talk-list")).toBeDefined();
    expect(screen.queryByTestId("signatures-step")).toBeNull();
  });

  it("discards the draft and starts fresh when Discard draft is confirmed", async () => {
    await putDraft({
      projectId: "p1",
      talkId: "t1",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "signatures", signers: [], photoBlob: undefined },
    });

    renderWizard();

    fireEvent.click(
      await screen.findByRole("button", { name: /discard draft/i }),
    );

    expect(await screen.findByTestId("project-picker")).toBeDefined();
    expect(
      await tailgateDb.meetingDraftCache.get(DRAFT_ROW_ID),
    ).toBeUndefined();
  });

  it("discards a draft whose project no longer resolves, without prompting", async () => {
    await putDraft({
      projectId: "missing-project",
      talkId: null,
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "talk", signers: [], photoBlob: undefined },
    });

    renderWizard();

    expect(await screen.findByTestId("project-picker")).toBeDefined();
    expect(screen.queryByText(/resume in-progress meeting/i)).toBeNull();
  });

  it("saves the meeting log, each signer, and the photo, then clears the draft", async () => {
    renderWizard();

    await advanceToPhotoStep();
    fireEvent.click(
      await screen.findByRole("button", { name: /capture-photo/i }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /save meeting/i }),
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard"),
    );

    expect(mockCreateMeetingLog).toHaveBeenCalledWith({
      projectId: "p1",
      talkId: "t1",
    });
    expect(mockCreateSignature).toHaveBeenCalledWith({
      meetingId: "meeting-1",
      workerName: "Jordan",
      quizAnswers: undefined,
    });
    expect(mockUploadSignatureBlob).toHaveBeenCalledWith({
      meetingId: "meeting-1",
      signatureId: "sig-server-1",
      blob: expect.any(Blob),
    });
    expect(mockUploadCrewPhoto).toHaveBeenCalledWith({
      meetingId: "meeting-1",
      blob: expect.any(File),
    });
    expect(mockCompleteMeetingLog).toHaveBeenCalledWith({
      meetingId: "meeting-1",
      signatureIds: ["sig-server-1"],
    });
    expect(
      await tailgateDb.meetingDraftCache.get(DRAFT_ROW_ID),
    ).toBeUndefined();
  });

  it("does not re-create the meeting log or an already-created signature on a retried Save", async () => {
    mockUploadSignatureBlob.mockRejectedValueOnce(new Error("network blip"));

    renderWizard();

    await advanceToPhotoStep();
    fireEvent.click(await screen.findByRole("button", { name: /skip-photo/i }));

    fireEvent.click(
      await screen.findByRole("button", { name: /save meeting/i }),
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /network blip/i,
    );
    expect(mockCreateMeetingLog).toHaveBeenCalledTimes(1);
    expect(mockCreateSignature).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /save meeting/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard"),
    );
    expect(mockCreateMeetingLog).toHaveBeenCalledTimes(1);
    expect(mockCreateSignature).toHaveBeenCalledTimes(1);
    expect(mockUploadSignatureBlob).toHaveBeenCalledTimes(2);
    expect(mockCompleteMeetingLog).toHaveBeenCalledTimes(1);
  });

  it("shows a generic error when Save fails with something other than an Error", async () => {
    mockCreateMeetingLog.mockRejectedValueOnce("boom");

    renderWizard();

    await advanceToPhotoStep();
    fireEvent.click(await screen.findByRole("button", { name: /skip-photo/i }));

    fireEvent.click(
      await screen.findByRole("button", { name: /save meeting/i }),
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /something went wrong saving the meeting/i,
    );
  });

  it("pluralizes the Save-step summary for more than one collected signer", async () => {
    renderWizard();

    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /select-talk-t1/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /presenter-continue/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /add-signer/i }));
    fireEvent.click(screen.getByRole("button", { name: /add-signer/i }));
    fireEvent.click(screen.getByRole("button", { name: /signatures-continue/i }));
    fireEvent.click(await screen.findByRole("button", { name: /skip-photo/i }));

    expect(await screen.findByText(/2 signatures collected/i)).toBeDefined();
  });

  it("does not re-run completion on a retried Save once it already succeeded, but shows the failure otherwise", async () => {
    mockCompleteMeetingLog.mockRejectedValueOnce(new Error("still syncing"));

    renderWizard();

    await advanceToPhotoStep();
    fireEvent.click(await screen.findByRole("button", { name: /skip-photo/i }));

    fireEvent.click(
      await screen.findByRole("button", { name: /save meeting/i }),
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /still syncing/i,
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      await tailgateDb.meetingDraftCache.get(DRAFT_ROW_ID),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /save meeting/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard"),
    );
    expect(mockCreateMeetingLog).toHaveBeenCalledTimes(1);
    expect(mockCreateSignature).toHaveBeenCalledTimes(1);
    expect(mockCompleteMeetingLog).toHaveBeenCalledTimes(2);
  });

  it("does not call completeMeetingLog again when resuming a draft whose completion was already enqueued", async () => {
    await putDraft({
      projectId: "p1",
      talkId: "t1",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: {
        currentStep: "save",
        signers: [
          {
            localId: "s1",
            workerName: "Jordan",
            quizAnswers: null,
            signatureBlob: new Blob(["a"], { type: "image/png" }),
            signatureId: "sig-server-1",
            blobUploaded: true,
          },
        ],
        photoBlob: null,
        meetingLogId: "meeting-1",
        photoUploaded: false,
        completionEnqueued: true,
      },
    });

    renderWizard();

    expect(
      await screen.findByText(/resume in-progress meeting/i),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /keep draft/i }));

    fireEvent.click(
      await screen.findByRole("button", { name: /save meeting/i }),
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard"),
    );
    expect(mockCreateMeetingLog).not.toHaveBeenCalled();
    expect(mockCreateSignature).not.toHaveBeenCalled();
    expect(mockCompleteMeetingLog).not.toHaveBeenCalled();
  });

  it("calls completeMeetingLog when resuming a draft that reached Save without it having enqueued yet", async () => {
    await putDraft({
      projectId: "p1",
      talkId: "t1",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: {
        currentStep: "save",
        signers: [
          {
            localId: "s1",
            workerName: "Jordan",
            quizAnswers: null,
            signatureBlob: new Blob(["a"], { type: "image/png" }),
            signatureId: "sig-server-1",
            blobUploaded: true,
          },
        ],
        photoBlob: null,
        meetingLogId: "meeting-1",
        photoUploaded: false,
      },
    });

    renderWizard();

    expect(
      await screen.findByText(/resume in-progress meeting/i),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /keep draft/i }));

    fireEvent.click(
      await screen.findByRole("button", { name: /save meeting/i }),
    );

    await waitFor(() =>
      expect(mockCompleteMeetingLog).toHaveBeenCalledWith({
        meetingId: "meeting-1",
        signatureIds: ["sig-server-1"],
      }),
    );
    expect(mockCreateMeetingLog).not.toHaveBeenCalled();
    expect(mockCreateSignature).not.toHaveBeenCalled();
  });

  it("goes back from talk to project without a confirmation when no signers are collected", async () => {
    renderWizard();

    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );
    expect(await screen.findByTestId("talk-list")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    expect(screen.queryByText(/discard collected signatures/i)).toBeNull();
    expect(await screen.findByTestId("project-picker")).toBeDefined();
  });

  it("persists the draft's currentStep after navigating Back", async () => {
    renderWizard();

    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /select-talk-t1/i }),
    );
    await screen.findByTestId("talk-presenter");

    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    await waitFor(async () => {
      const row = await tailgateDb.meetingDraftCache.get(DRAFT_ROW_ID);
      expect(row?.data).toMatchObject({ currentStep: "talk" });
    });
  });

  it("lets a foreman back up through present and signatures without a confirmation while no signers are collected yet", async () => {
    renderWizard();

    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /select-talk-t1/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /presenter-continue/i }),
    );
    expect(await screen.findByTestId("signatures-step")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    expect(screen.queryByText(/discard collected signatures/i)).toBeNull();
    expect(await screen.findByTestId("talk-presenter")).toBeDefined();
  });

  it("confirms before discarding signatures when backing up past signatures to the talk step", async () => {
    renderWizard();
    await advanceToPhotoStep();

    // photo -> signatures: non-destructive, no dialog
    fireEvent.click(await screen.findByRole("button", { name: /^back$/i }));
    expect(await screen.findByTestId("signatures-step")).toBeDefined();
    expect(screen.queryByText(/discard collected signatures/i)).toBeNull();

    // signatures -> present: non-destructive, no dialog
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
    expect(await screen.findByTestId("talk-presenter")).toBeDefined();
    expect(screen.queryByText(/discard collected signatures/i)).toBeNull();

    // present -> talk: destructive, since a signer was already collected
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
    expect(await screen.findByText(/discard collected signatures/i)).toBeDefined();

    // "Stay here" is a no-op -- still on present, signer still collected
    fireEvent.click(screen.getByRole("button", { name: /stay here/i }));
    expect(screen.queryByTestId("talk-list")).toBeNull();
    expect(await screen.findByTestId("talk-presenter")).toBeDefined();
  });

  it("discards collected signers and navigates back once the destructive back is confirmed", async () => {
    renderWizard();
    await advanceToPhotoStep();

    fireEvent.click(await screen.findByRole("button", { name: /^back$/i })); // photo -> signatures
    fireEvent.click(screen.getByRole("button", { name: /^back$/i })); // signatures -> present
    fireEvent.click(screen.getByRole("button", { name: /^back$/i })); // present -> talk (destructive)

    fireEvent.click(
      await screen.findByRole("button", { name: /discard and go back/i }),
    );

    expect(await screen.findByTestId("talk-list")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /select-talk-t1/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /presenter-continue/i }),
    );
    expect(await screen.findByText("signers:0")).toBeDefined();
  });

  it("uses 'the project step' wording when a destructive back targets project (a resumed draft still on the talk step)", async () => {
    // The app's own flow always clears signers before a Back navigation can
    // land back on "talk" with signers still collected -- this state is only
    // reachable via a resumed draft, same fixture technique as the other
    // "resumes a draft with ..." tests above.
    await putDraft({
      projectId: "p1",
      talkId: null,
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: {
        currentStep: "talk",
        signers: [
          {
            localId: "s1",
            workerName: "Jordan",
            quizAnswers: null,
            signatureBlob: new Blob(["a"], { type: "image/png" }),
          },
        ],
        photoBlob: undefined,
      },
    });

    renderWizard();
    expect(
      await screen.findByText(/resume in-progress meeting/i),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /keep draft/i }));

    expect(await screen.findByTestId("talk-list")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    expect(await screen.findByText(/the project step/i)).toBeDefined();
  });

  it("hides the Back button on the save step once a Save attempt has created the meeting log", async () => {
    mockUploadSignatureBlob.mockRejectedValueOnce(new Error("network blip"));

    renderWizard();
    await advanceToPhotoStep();
    fireEvent.click(await screen.findByRole("button", { name: /skip-photo/i }));

    expect(await screen.findByRole("button", { name: /^back$/i })).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: /save meeting/i }),
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /network blip/i,
    );
    expect(screen.queryByRole("button", { name: /^back$/i })).toBeNull();
  });

  it("removes a collected signer before Save", async () => {
    renderWizard();

    fireEvent.click(
      await screen.findByRole("button", { name: /select-project-p1/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /select-talk-t1/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /presenter-continue/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /add-signer/i }));
    expect(screen.getByText("signers:1")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /remove-signer/i }));

    expect(screen.getByText("signers:0")).toBeDefined();
  });
});
