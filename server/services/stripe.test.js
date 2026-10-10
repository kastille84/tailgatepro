// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const {
  getBillingState,
  getBillingSummary,
  createCheckoutSession,
  createPortalSession,
} = require("./stripe");

const fromSpy = vi.spyOn(supabase, "from");

const billingRow = {
  name: "Acme Roofing",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: null,
};

// Wires supabase.from() for both shapes this service uses:
// select().eq().single() and update().eq().
const mockDb = ({ row = billingRow, selectError = null, updateError = null } = {}) => {
  const single = vi.fn().mockResolvedValue({
    data: selectError ? null : row,
    error: selectError,
  });
  const updateEq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) });
  fromSpy.mockReturnValue({ select, update });
  return { select, update, updateEq };
};

const makeStripe = () => ({
  customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }) },
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/s" }),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/p" }),
    },
  },
});

const args = {
  companyId: "company-1",
  companyType: "subcontractor",
  email: "boss@acme.com",
  planKey: "trade-pro",
  interval: "monthly",
};

describe("stripe service", () => {
  beforeAll(() => {
    process.env.STRIPE_PRICE_TRADE_PRO_MONTHLY = "price_tp_m";
  });

  beforeEach(() => {
    fromSpy.mockReset();
  });

  describe("getBillingState", () => {
    it("maps the billing columns", async () => {
      mockDb({
        row: {
          name: "Acme",
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
          subscription_status: "active",
          billing_interval: "annual",
          current_period_end: "2027-01-01T00:00:00.000Z",
        },
      });
      await expect(getBillingState("company-1")).resolves.toEqual({
        name: "Acme",
        customerId: "cus_1",
        subscriptionId: "sub_1",
        subscriptionStatus: "active",
        billingInterval: "annual",
        currentPeriodEnd: "2027-01-01T00:00:00.000Z",
      });
    });

    it("throws 404 when the company does not exist", async () => {
      mockDb({ selectError: { code: "PGRST116" } });
      await expect(getBillingState("x")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 502 on any other database error", async () => {
      mockDb({ selectError: { code: "XX000" } });
      await expect(getBillingState("x")).rejects.toMatchObject({ statusCode: 502 });
    });
  });

  describe("getBillingSummary", () => {
    it("returns the display fields without Stripe ids", async () => {
      mockDb({
        row: {
          name: "Acme",
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
          subscription_status: "active",
          billing_interval: "monthly",
          current_period_end: "2027-01-01T00:00:00.000Z",
        },
      });
      await expect(getBillingSummary("company-1")).resolves.toEqual({
        hasBillingAccount: true,
        subscriptionStatus: "active",
        billingInterval: "monthly",
        currentPeriodEnd: "2027-01-01T00:00:00.000Z",
      });
    });

    it("reports no billing account for a company that never subscribed", async () => {
      mockDb();
      await expect(getBillingSummary("company-1")).resolves.toMatchObject({
        hasBillingAccount: false,
        subscriptionStatus: null,
      });
    });
  });

  describe("createCheckoutSession", () => {
    it("throws 403 for an in-house crew, before creating a customer", async () => {
      const stripe = makeStripe();

      await expect(
        createCheckoutSession({ ...args, parentGcCompanyId: "gc-1" }, stripe),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Billing is managed by your general contractor",
      });
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("creates a customer, saves it, and returns the Checkout url", async () => {
      const { update, updateEq } = mockDb();
      const stripe = makeStripe();

      const result = await createCheckoutSession(args, stripe);

      expect(result).toEqual({ url: "https://checkout.stripe.com/s" });
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: "boss@acme.com",
        name: "Acme Roofing",
        metadata: { companyId: "company-1" },
      });
      expect(update).toHaveBeenCalledWith({ stripe_customer_id: "cus_new" });
      expect(updateEq).toHaveBeenCalledWith("id", "company-1");
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer: "cus_new",
          line_items: [{ price: "price_tp_m", quantity: 1 }],
          client_reference_id: "company-1",
          subscription_data: { metadata: { companyId: "company-1" } },
          success_url: expect.stringContaining("/settings?checkout=success"),
          cancel_url: expect.stringContaining("/settings?checkout=cancel"),
        }),
      );
    });

    it("reuses an existing customer without creating another", async () => {
      const { update } = mockDb({
        row: { ...billingRow, stripe_customer_id: "cus_old" },
      });
      const stripe = makeStripe();

      await createCheckoutSession(args, stripe);

      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_old" }),
      );
    });

    it("allows a new checkout after a canceled subscription", async () => {
      mockDb({
        row: {
          ...billingRow,
          stripe_customer_id: "cus_old",
          stripe_subscription_id: "sub_old",
          subscription_status: "canceled",
        },
      });
      await expect(createCheckoutSession(args, makeStripe())).resolves.toEqual({
        url: "https://checkout.stripe.com/s",
      });
    });

    it("rejects an unknown plan with 400", async () => {
      await expect(
        createCheckoutSession({ ...args, planKey: "nope" }, makeStripe()),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects a plan for the other company type with 403", async () => {
      await expect(
        createCheckoutSession({ ...args, companyType: "gc" }, makeStripe()),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects with 500 when the price is not configured", async () => {
      await expect(
        createCheckoutSession({ ...args, interval: "annual" }, makeStripe()),
      ).rejects.toMatchObject({ statusCode: 500 });
    });

    it("rejects with 409 ALREADY_SUBSCRIBED for a live subscription", async () => {
      mockDb({
        row: {
          ...billingRow,
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
          subscription_status: "active",
        },
      });
      const stripe = makeStripe();

      await expect(createCheckoutSession(args, stripe)).rejects.toMatchObject({
        statusCode: 409,
        data: { code: "ALREADY_SUBSCRIBED" },
      });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("throws 502 when saving the customer id fails", async () => {
      mockDb({ updateError: { code: "XX000" } });
      await expect(createCheckoutSession(args, makeStripe())).rejects.toMatchObject({
        statusCode: 502,
      });
    });

    it("throws 502 and keeps the cause when Stripe fails to create the customer", async () => {
      mockDb();
      const stripe = makeStripe();
      const cause = new Error("stripe down");
      stripe.customers.create.mockRejectedValue(cause);

      await expect(createCheckoutSession(args, stripe)).rejects.toMatchObject({
        statusCode: 502,
        cause,
      });
    });

    it("throws 502 when Stripe fails to create the session", async () => {
      mockDb({ row: { ...billingRow, stripe_customer_id: "cus_old" } });
      const stripe = makeStripe();
      stripe.checkout.sessions.create.mockRejectedValue(new Error("stripe down"));

      await expect(createCheckoutSession(args, stripe)).rejects.toMatchObject({
        statusCode: 502,
      });
    });
  });

  describe("createPortalSession", () => {
    it("returns the portal url for an existing customer", async () => {
      mockDb({ row: { ...billingRow, stripe_customer_id: "cus_1" } });
      const stripe = makeStripe();

      await expect(createPortalSession({ companyId: "company-1" }, stripe)).resolves.toEqual({
        url: "https://billing.stripe.com/p",
      });
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: "cus_1",
        return_url: expect.stringContaining("/settings"),
      });
    });

    it("throws 403 for an in-house crew, before touching billing", async () => {
      const stripe = makeStripe();
      await expect(
        createPortalSession({ companyId: "crew-1", parentGcCompanyId: "gc-1" }, stripe),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Billing is managed by your general contractor",
      });
      expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it("throws 404 when the company has no billing account", async () => {
      mockDb();
      await expect(
        createPortalSession({ companyId: "company-1" }, makeStripe()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 502 when Stripe fails", async () => {
      mockDb({ row: { ...billingRow, stripe_customer_id: "cus_1" } });
      const stripe = makeStripe();
      stripe.billingPortal.sessions.create.mockRejectedValue(new Error("down"));

      await expect(
        createPortalSession({ companyId: "company-1" }, stripe),
      ).rejects.toMatchObject({ statusCode: 502 });
    });
  });
});
