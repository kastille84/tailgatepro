// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { createSiteCheckoutSession } = require("./stripe");

const fromSpy = vi.spyOn(supabase, "from");

const activeSite = {
  id: "site-1",
  plan: "free",
  status: "active",
  archived_at: null,
};

// jobsites: select().eq().eq().maybeSingle()
// companies: select().eq().single(), update().eq()
const mockDb = ({
  site = activeSite,
  siteError = null,
  customerId = null,
  tier = "basic",
} = {}) => {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const jobsiteChain = {
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: site, error: siteError }),
    }),
  };
  const siteEq = vi.fn().mockReturnValue(jobsiteChain);
  const companySingle = vi.fn().mockResolvedValue({
    data: {
      name: "Big GC",
      tier,
      stripe_customer_id: customerId,
      stripe_subscription_id: "sub_company",
      subscription_status: "active",
    },
    error: null,
  });

  fromSpy.mockImplementation((table) =>
    table === "jobsites"
      ? { select: vi.fn().mockReturnValue({ eq: siteEq }) }
      : {
          select: vi
            .fn()
            .mockReturnValue({ eq: vi.fn().mockReturnValue({ single: companySingle }) }),
          update,
        },
  );
  return { siteEq, jobsiteChain, update };
};

const makeStripe = () => ({
  customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }) },
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/s" }),
    },
  },
});

const args = {
  companyId: "company-1",
  companyType: "gc",
  email: "gc@bigco.com",
  jobsiteId: "site-1",
  interval: "monthly",
};

describe("createSiteCheckoutSession", () => {
  beforeAll(() => {
    process.env.STRIPE_PRICE_GC_SITE_PRO_MONTHLY = "price_sp_m";
    delete process.env.STRIPE_PRICE_GC_SITE_PRO_ANNUAL;
  });

  beforeEach(() => {
    fromSpy.mockReset();
  });

  it("creates a subscription checkout tagged with the jobsite, scoped to the caller's company", async () => {
    const { siteEq, jobsiteChain } = mockDb({ customerId: "cus_1" });
    const stripe = makeStripe();

    await expect(createSiteCheckoutSession(args, stripe)).resolves.toEqual({
      url: "https://checkout.stripe.com/s",
    });

    expect(siteEq).toHaveBeenCalledWith("id", "site-1");
    expect(jobsiteChain.eq).toHaveBeenCalledWith("gc_company_id", "company-1");
    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params).toMatchObject({
      mode: "subscription",
      customer: "cus_1",
      line_items: [{ price: "price_sp_m", quantity: 1 }],
      subscription_data: {
        metadata: { companyId: "company-1", jobsiteId: "site-1", kind: "site_pro" },
      },
    });
    expect(params.success_url).toContain("/projects?siteCheckout=success&jobsiteId=site-1");
    expect(params.cancel_url).toContain("/projects?siteCheckout=cancel");
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it("does not block a company that already has a company subscription", async () => {
    mockDb({ customerId: "cus_1" }); // mock company row has a live subscription
    await expect(createSiteCheckoutSession(args, makeStripe())).resolves.toHaveProperty("url");
  });

  it("creates and saves a Stripe customer on first purchase", async () => {
    const { update } = mockDb();
    const stripe = makeStripe();

    await createSiteCheckoutSession(args, stripe);

    expect(stripe.customers.create).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ stripe_customer_id: "cus_new" });
    expect(stripe.checkout.sessions.create.mock.calls[0][0].customer).toBe("cus_new");
  });

  it("rejects a non-GC company with 403", async () => {
    await expect(
      createSiteCheckoutSession({ ...args, companyType: "subcontractor" }, makeStripe()),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns 500 when the price is not configured", async () => {
    await expect(
      createSiteCheckoutSession({ ...args, interval: "annual" }, makeStripe()),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("returns 404 for a jobsite the company does not own", async () => {
    mockDb({ site: null });
    await expect(createSiteCheckoutSession(args, makeStripe())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("returns 502 when the jobsite lookup fails", async () => {
    mockDb({ siteError: { code: "XX000" } });
    await expect(createSiteCheckoutSession(args, makeStripe())).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("returns 409 for an archived or completed jobsite", async () => {
    mockDb({ site: { ...activeSite, archived_at: "2026-01-01T00:00:00Z" } });
    await expect(createSiteCheckoutSession(args, makeStripe())).rejects.toMatchObject({
      statusCode: 409,
    });
    mockDb({ site: { ...activeSite, status: "completed" } });
    await expect(createSiteCheckoutSession(args, makeStripe())).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("returns 409 ALREADY_SITE_PRO for a jobsite that is already Site Pro", async () => {
    mockDb({ site: { ...activeSite, plan: "site_pro" } });
    await expect(createSiteCheckoutSession(args, makeStripe())).rejects.toMatchObject({
      statusCode: 409,
      data: { code: "ALREADY_SITE_PRO" },
    });
  });

  it.each(["premium", "enterprise"])(
    "returns 409 COVERED_BY_PORTFOLIO for a company on the %s Portfolio tier, without touching Stripe",
    async (tier) => {
      mockDb({ customerId: "cus_1", tier });
      const stripe = makeStripe();

      await expect(createSiteCheckoutSession(args, stripe)).rejects.toMatchObject({
        statusCode: 409,
        data: { code: "COVERED_BY_PORTFOLIO" },
      });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(stripe.customers.create).not.toHaveBeenCalled();
    },
  );

  it("maps a Stripe failure to 502", async () => {
    mockDb({ customerId: "cus_1" });
    const stripe = makeStripe();
    stripe.checkout.sessions.create.mockRejectedValue(new Error("stripe down"));
    await expect(createSiteCheckoutSession(args, stripe)).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});
