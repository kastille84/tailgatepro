/** Matches the Supabase `company_type` enum exactly — kept distinct from the
 *  marketing-page `Audience` type (`"sub" | "gc"`), which uses the shorthand
 *  "sub" rather than the DB's full word "subcontractor". */
export type CompanyType = "gc" | "subcontractor";
