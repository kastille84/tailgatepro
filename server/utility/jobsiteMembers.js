// `jobsite_subcontractors.invited_email` is NOT NULL and UNIQUE per jobsite, but
// a member who arrived via a join-code link (or the 8d-g backfill) was never
// emailed. This placeholder stands in for it. `.invalid` is a reserved TLD, so
// nothing can ever be delivered to it.
const placeholderEmail = (subCompanyId) =>
  `backfill+${subCompanyId}@backfill.invalid`;

module.exports = { placeholderEmail };
