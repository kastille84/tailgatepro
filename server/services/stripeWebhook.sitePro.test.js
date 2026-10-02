// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { handleWebhook } = require("./stripeWebhook");

const fromSpy = vi.spyOn(supabase, "from");
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const jobsite = {
  id: "site-1",
  gc_company_id: "company-1",
  stripe_subscription_id: null,
};

// Wires supabase.from() per table:
//   stripe_events: select().eq().maybeSingle(), insert()
//   jobsites:      select().eq().maybeSingle(), update().eq()
//   companies:     must never be touched by a Site Pro subscription
const mockDb = ({
  jobsiteRow = jobsite,
  selectError = null,
  updateError = null,
} = {}) => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const updateEq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const eventsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });
  const jobsitesSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: jobsiteRow, error: selectError }),
    }),
  });

  fromSpy.mockImplementation((table) => {
    if (table === "stripe_events") return { select: eventsSelect, insert };
    if (table === "jobsites") return { select: jobsitesSelect, update };
    throw new Error(`unexpected table ${table}`);
  });
  return { insert, update, updateEq };
};

const subscription = (overrides = {}) => ({
  id: "sub_site_1",
  status: "active",
  customer: "cus_1",
  metadata: { companyId: "company-1", jobsiteId: "site-1", kind: "site_pro" },
  current_period_end: 1800000000,
  items: { data: [{ price: { id: "price_sp_m" } }] },
  ...overrides,
});

const makeStripe = (sub = subscription()) => ({
  webhooks: {
    constructEvent: vi.fn().mockReturnValue({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { id: sub.id } },
    }),
  },
  subscriptions: { retrieve: vi.fn().mockResolvedValue(sub) },
});

const call = (stripe) =>
  handleWebhook({ rawBody: Buffer.from("{}"), signature: "sig" }, stripe);

describe("stripe webhook: Site Pro subscriptions", () => {
  beforeAll(() => {
    process.env.STRIPE_PRICE_GC_SITE_PRO_MONTHLY = "price_sp_m";
    process.env.STRIPE_PRICE_TRADE_PRO_MONTHLY = "price_tp_m";
  });

  beforeEach(() => {
    fromSpy.mockReset();
    errorSpy.mockClear();
  });

  it("flips only the jobsite to site_pro and records the event", async () => {
    const { update, updateEq, insert } = mockDb();

    await expect(call(makeStripe())).resolves.toEqual({ duplicate: false });

    expect(update).toHaveBeenCalledWith({
      stripe_subscription_id: "sub_site_1",
      site_pro_status: "active",
      site_pro_period_end: new Date(1800000000 * 1000).toISOString(),
      plan: "site_pro",
      site_pro_interval: "monthly",
    });
    expect(updateEq).toHaveBeenCalledWith("id", "site-1");
    expect(fromSpy).not.toHaveBeenCalledWith("companies");
    expect(insert).toHaveBeenCalled();
  });

  it("reverts the jobsite to free when the subscription ends", async () => {
    const { update } = mockDb({
      jobsiteRow: { ...jobsite, stripe_subscription_id: "sub_site_1" },
    });

    await call(makeStripe(subscription({ status: "canceled" })));

    expect(update).toHaveBeenCalledWith({
      stripe_subscription_id: "sub_site_1",
      site_pro_status: "canceled",
      site_pro_period_end: new Date(1800000000 * 1000).toISOString(),
      plan: "free",
    });
  });

  it("ignores a late end event for a superseded subscription", async () => {
    const { update } = mockDb({
      jobsiteRow: { ...jobsite, stripe_subscription_id: "sub_newer" },
    });

    await call(makeStripe(subscription({ status: "canceled" })));

    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the plan but records the status while past_due", async () => {
    const { update } = mockDb();

    await call(makeStripe(subscription({ status: "past_due" })));

    const written = update.mock.calls[0][0];
    expect(written.site_pro_status).toBe("past_due");
    expect(written).not.toHaveProperty("plan");
  });

  it("refuses a jobsite owned by a different company", async () => {
    const { update } = mockDb({
      jobsiteRow: { ...jobsite, gc_company_id: "someone-else" },
    });

    await call(makeStripe());

    expect(update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("refuses when the jobsite does not exist", async () => {
    const { update } = mockDb({ jobsiteRow: null });

    await call(makeStripe());

    expect(update).not.toHaveBeenCalled();
  });

  it("refuses metadata with no jobsite id", async () => {
    const { update } = mockDb();
    const sub = subscription({
      metadata: { companyId: "company-1", kind: "site_pro" },
    });

    await call(makeStripe(sub));

    expect(update).not.toHaveBeenCalled();
  });

  it("never grants Site Pro from a price that is not the Site Pro price", async () => {
    const { update } = mockDb();
    const sub = subscription({ items: { data: [{ price: { id: "price_tp_m" } }] } });

    await call(makeStripe(sub));

    expect(update).not.toHaveBeenCalled();
  });

  it("throws 502 when the jobsite lookup fails", async () => {
    mockDb({ selectError: { code: "XX000" } });

    await expect(call(makeStripe())).rejects.toMatchObject({ statusCode: 502 });
  });

  it("throws 502 when the jobsite update fails", async () => {
    mockDb({ updateError: { code: "XX000" } });

    await expect(call(makeStripe())).rejects.toMatchObject({ statusCode: 502 });
  });
});
