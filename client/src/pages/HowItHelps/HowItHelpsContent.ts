export type HelpAudience = "gc" | "sub";

export const AUDIENCE_OPTIONS: { value: HelpAudience; label: string }[] = [
  { value: "gc", label: "For GCs" },
  { value: "sub", label: "For Subs" },
];

interface Fear {
  label: string;
  quote: string;
  body: string;
}

interface Pitch {
  title: string;
  body: string;
}

interface Cta {
  heading: string;
  lede: string;
  button: string;
}

interface AudienceContent {
  eyebrow: string;
  heading: string;
  lede: string;
  fear: Fear;
  pitches: Pitch[];
  cta: Cta;
}

export const AUDIENCE_CONTENT: Record<HelpAudience, AudienceContent> = {
  gc: {
    eyebrow: "For general contractors",
    heading: "You run the site. You're the one who gets named.",
    lede: "Comp protects a sub from its own worker, so the lawsuit and OSHA's controlling-employer question land on you. Your best answer is proof that every crew was briefed and you checked.",
    fear: {
      label: "General Contractor's Fear",
      quote: "Being the defendant.",
      body: "When a sub's worker is hurt, the plaintiff's attorney sues the owner and the GC. The first thing asked for is the safety record.",
    },
    pitches: [
      {
        title: "Prove you checked, every week",
        body: "See which subs logged a talk today and open each signed PDF. Foremen who haven't logged get a text on Monday at 7:00 AM. That is documented oversight.",
      },
      {
        title: "One format from every trade",
        body: "Every sub's talk arrives as the same signed PDF with signatures and a crew photo. No more sign-in sheets photographed in ten layouts.",
      },
      {
        title: "Hand over one bundle",
        body: "When OSHA, an adjuster or a lawyer asks, export the OSHA Defense Bundle: an indexed ZIP of a jobsite's logs, ready in one click.",
      },
      {
        title: "Records that show if they were touched",
        body: "Each PDF carries a content seal you can verify in the app. A clean, complete log is harder to pick apart than a binder.",
      },
      {
        title: "Set the topic, see who followed it",
        body: "Push a talk topic to every sub on your sites and watch compliance by company, with a rolling 30-day scorecard for each sub.",
      },
    ],
    cta: {
      heading: "See who's logging talks on your sites",
      lede: "Create a free GC account, invite your subcontractors and teammates, and watch each sub's talks come in.",
      button: "Create a free GC account",
    },
  },
  sub: {
    eyebrow: "For subcontractors",
    heading: "You're the employer. OSHA calls you first.",
    lede: "Your crew, your citation, your premium. Every incident follows you into the next bid, so the paperwork has to be there when someone asks.",
    fear: {
      label: "Subcontractor's Fear",
      quote: "The citation, the premium, and the lost bid.",
      body: "As the employer you get the document request, the claim lands on your experience, and prequal forms ask what your safety program looks like.",
    },
    pitches: [
      {
        title: "Answer OSHA with a bundle, not a binder",
        body: "Export an indexed ZIP of every log your company has run, with a CSV index, instead of digging through truck binders.",
      },
      {
        title: "Your safety record is your bid ticket",
        body: "Prequal forms ask for proof of a working program. Weeks of signed weekly talks are simple to show, and Trade Pro keeps 5 years of history.",
      },
      {
        title: "Protect yourself and your GC",
        body: "Your subcontract probably makes you defend the GC. Signed, sealed records help you document the crew was briefed, which helps both of you.",
      },
      {
        title: "Stop chasing paperwork for the GC",
        body: "When the talk ends, the signed PDF is emailed to the GC automatically. They get their proof, and you don't have to send photos or follow up.",
      },
      {
        title: "Works where the signal doesn't",
        body: "Runs offline with nothing to install. Open it from a link or the jobsite QR code. The Free plan costs $0.",
      },
    ],
    cta: {
      heading: "Be ready before anyone asks",
      lede: "Create a free account and run your first talk today.",
      button: "Get started free",
    },
  },
};

export type RecordStrength = "supporting" | "strong" | "strongest";

export interface TimelineStep {
  when: string;
  title: string;
  happens: string;
  strength: RecordStrength;
  matters: string;
}

export const STRENGTH_LABEL: Record<RecordStrength, string> = {
  supporting: "Helps",
  strong: "Strong",
  strongest: "Strongest",
};

export const STRENGTH_LEVEL: Record<RecordStrength, 1 | 2 | 3> = {
  supporting: 1,
  strong: 2,
  strongest: 3,
};

export const METER_LEVELS = [1, 2, 3] as const;

export const HELP_CELL_HEADING = "How TailgatePro helps";

export const TIMELINE_STEPS: TimelineStep[] = [
  {
    when: "Minute zero",
    title: "The scene",
    happens:
      "First aid and 911, the work area is secured, photos taken, witnesses named. The foreman is asked what the crew had been told about the hazard, and when.",
    strength: "supporting",
    matters:
      "The signed talk record shows which hazard was covered, on what date, and who heard it, so the answer doesn't depend on anyone's memory.",
  },
  {
    when: "Days to weeks",
    title: "Adjusters investigate",
    happens:
      "Comp and liability adjusters collect the incident report, the subcontract and the safety program, including training and toolbox talk logs.",
    strength: "strong",
    matters:
      "Answer the training request the same day with signed PDFs or the Defense Bundle instead of photos of a muddy sign-in sheet.",
  },
  {
    when: "Days to months",
    title: "The OSHA inspection",
    happens:
      "Opening conference, document request, interviews, a walkaround. Under the multi-employer policy a GC can be cited for a sub's hazard if it didn't use reasonable care.",
    strength: "strong",
    matters:
      "Training records are among the first documents requested. Subs hand over a bundle. GCs show the weekly oversight trail.",
  },
  {
    when: "Months to years",
    title: "The lawsuit",
    happens:
      "Comp usually bars suing the employer, so the plaintiff's attorney sues the owner, the GC and other subs. Discovery asks for every safety record.",
    strength: "strongest",
    matters:
      "A gap in the log becomes the plaintiff's story. Sealed, timestamped records and a 5-year archive are still there when a suit lands years later.",
  },
  {
    when: "The next 1 to 4 years",
    title: "The next bid",
    happens:
      "The claim follows the sub into renewals and prequalification. Future GCs and owners ask for safety history and proof of a working program.",
    strength: "supporting",
    matters:
      "A documented weekly program is easy to show. Fewer incidents is what moves the numbers; records back up the program.",
  },
];

export const LIMITS: string[] = [
  "File OSHA reports, keep the OSHA 300 log or manage workers' comp claims.",
  "Stop a valid comp claim from being paid. Comp is no-fault.",
  "Replace training a standard requires in a specific form, such as written fall-protection certification. A toolbox talk supplements it.",
  "Guarantee a legal result. TailgatePro helps you document, and it's ready when they ask.",
];
