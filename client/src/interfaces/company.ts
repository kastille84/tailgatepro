/** Matches the Supabase `company_type` enum exactly — kept distinct from the
 *  marketing-page `Audience` type (`"sub" | "gc"`), which uses the shorthand
 *  "sub" rather than the DB's full word "subcontractor". */
export type CompanyType = "gc" | "subcontractor";

/** `server/services/companies.js`'s `toCompany` shape. `logoPath` is a
 *  Storage path, never a URL — the client always fetches a signed URL
 *  separately (`useCompanyLogo`) rather than reading this directly. */
export interface Company {
  id: string;
  name: string;
  companyType: CompanyType;
  tier: string;
  logoPath: string | null;
}
