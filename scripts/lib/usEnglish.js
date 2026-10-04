// UK/HSE -> US/OSHA localization for the Word-library (TBT) import. Pure string
// transform, no I/O. Order matters: multi-word phrases run before the single
// words they contain. Anything this misses is caught by `findUkTerms`, which the
// build script runs over every generated talk and the auditor greps for.

const RULES = [
  // regulatory / role vocabulary
  [/banksman\/slinger/gi, "signal person/rigger"],
  [/banksman and slinger/gi, "signal person and rigger"],
  [/\ba banksman\b/gi, "a signal person"],
  [/banksman/gi, "signal person"],
  [/slinger/gi, "rigger"],
  [/COSHH assessment\/SDS/g, "hazard assessment/SDS"],
  [/COSHH assessment/g, "hazard assessment"],
  [/COSHH/g, "hazard communication (HazCom)"],
  [/RAMS\/risk assessment/g, "JHA/risk assessment"],
  [/\bRAMS\b/g, "JHA"],
  [/F-Gas certified/gi, "EPA Section 608 certified"],
  [/F-Gas qualification/gi, "EPA Section 608 certification"],
  [/F-Gas regulations/gi, "EPA refrigerant regulations (Section 608)"],
  [/F-Gas/gi, "EPA Section 608"],
  [/the RIDDOR process/g, "the OSHA recordkeeping and reporting process"],
  [/RIDDOR/g, "OSHA injury reporting"],
  [/the Environment Agency\/NIEA/g, "the EPA or state environmental agency"],
  [/CAT scanner/gi, "utility locator"],
  [/CAT scan/gi, "utility locate"],
  [/service drawings/gi, "utility maps"],
  [/permit-to-dig/gi, "dig permit"],
  [/over 1\.2m/g, "over 5 feet"],
  [/\bRPE\b/g, "respirators"],
  [/Permit to Work: /g, ""],
  [/permit-to-work/gi, "work permit"],
  [/Permit to Work/g, "Work Permits"],
  [/thorough examination/gi, "inspection"],
  [/gin wheels/gi, "chain hoists"],
  [/sharps bins/gi, "sharps containers"],
  [/\bbins\b/gi, "containers"],
  [/offcuts/gi, "cutoffs"],
  [/off-cuts/gi, "cutoffs"],
  [/\btorch\b/gi, "flashlight"],
  [/naked flames?/gi, "open flames"],
  [/spilt/gi, "spilled"],
  [/\bgrazes\b/gi, "scrapes"],
  [/lock-off devices/gi, "lockout devices"],
  [/\block[- ]off\b/gi, "lock out"],
  [/\blicen[cs]e\b/gi, "license"],
  [/\bwhilst\b/gi, "while"],
  [/\bprogramme\b/gi, "program"],
  [/\bmobile phone\b/gi, "cell phone"],
  [/\bhand-held phone\b/gi, "hand-held cell phone"],
  // emergency numbers / services
  [/call the emergency services/gi, "call 911"],
  [/call emergency services/gi, "call 911"],
  [/the emergency services/gi, "emergency responders"],
  [/emergency services/gi, "emergency responders"],
  [/the fire service/gi, "the fire department"],
  [/fire service/gi, "fire department"],
  // spelling
  [/behaviour/gi, "behavior"],
  [/defence/gi, "defense"],
  [/jewellery/gi, "jewelry"],
  [/colour/gi, "color"],
  [/practise/gi, "practice"],
  [/\bcentre\b/gi, "center"],
  [/\bmetres?\b/gi, "meters"],
  [/\b(un)?authoris(e|ed|es|ing|ation)\b/gi, (m, un, rest) => `${un || ""}authoriz${rest}`],
  [/\b(re-)?energis(e|ed|es|ing|ation)\b/gi, (m, re, rest) => `${re || ""}energiz${rest}`],
  [/\b(de)?pressuris(e|ed|es|ing|ation)\b/gi, (m, de, rest) => `${de || ""}pressuriz${rest}`],
  [/\b(minimis|organis|recognis|familiaris|prioritis|utilis|standardis|sanitis|realis|summaris)(e|ed|es|ing|ation)\b/gi, (m, stem, rest) => `${stem.slice(0, -1)}z${rest}`],
];

// Matches UK/HSE vocabulary that should not survive localization. Used as a
// check, not a transform.
const UK_TERMS =
  /\b(COSHH|RIDDOR|RAMS|banksman|slinger|F-Gas|whilst|behaviour|licence|authoris\w*|unauthoris\w*|energis\w*|pressuris\w*|minimis\w*|organis\w*|recognis\w*|jewellery|defence|torch|spanner|HSE\b|Environment Agency|NIEA|emergency services|fire service|thorough examination|lock[- ]off|offcuts?|\bbins?\b|metres?)\b/i;

/**
 * @param {string} text
 * @returns {string}
 */
const toUsEnglish = (text) =>
  RULES.reduce(
    (out, [pattern, replacement]) =>
      out.replace(
        pattern,
        typeof replacement === "string"
          ? // keep a sentence-initial capital ("Lock-off devices" -> "Lockout devices")
            (m) => (/^[A-Z][a-z]/.test(m) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement)
          : replacement
      ),
    text
  );

/**
 * @param {string} text
 * @returns {string[]} UK terms still present (empty when clean)
 */
const findUkTerms = (text) => {
  const found = new Set();
  const re = new RegExp(UK_TERMS.source, "gi");
  let m;
  while ((m = re.exec(text))) found.add(m[0]);
  return [...found];
};

module.exports = { toUsEnglish, findUkTerms };
