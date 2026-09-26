# Toolbox talk library import report

Source: `data/300_Toolbox_Talks_Library.docx` (300 talks, generated 2026-09-25T20:53:47Z).
Regenerate with `node scripts/parse-toolbox-docx.js && node scripts/build-tbt-talks.js`.

## Result

| Outcome | Count |
| --- | --- |
| Parsed from the Word file | 300 |
| Skipped: duplicate of an existing talk | 17 |
| Skipped: duplicate inside the import | 1 |
| Skipped: not a safety/health topic | 62 |
| Skipped: source search found it duplicates an original talk | 16 |
| Processed into `data/processed/` | 78 |
| — rebuilt from an agency source (OSHA / NIOSH / CPWR / EPA) | 55 |
|   — audit `approved` (seeded by `npm run seed:talks`) | 55 |
|   — not yet approved / needs revision | 0 |
| — original talks written from OSHA / NIOSH / EPA sources (`data/authored/`) | 20 |
|   — audit `approved` (seeded by `npm run seed:talks`) | 20 |
|   — awaiting audit / needs revision | 0 |
| — Word-library content, hand-verified | 3 |
| Dropped by decision (no agency source, overlap, or out of scope; not written) | 126 |

## Why most Word-library talks need revision

The 300 talks contain only 43 distinct bodies: the hazards, controls and do/don't lists are boilerplate per theme with the title swapped in.
Talks whose body is shared with any other talk are flagged `generic-body`; talks whose title words never appear in their body are also flagged `title-body-mismatch`
(e.g. *Working on Condensers* carries a cold-room body). Both keep the talk out of the seed until someone writes topic-specific content.

## Rebuilt from an agency source

| TBT | Talk | Source | Audit |
| --- | --- | --- | --- |
| 001 | PPE: Selection, Use and Care | [OSHA](https://www.osha.gov/sites/default/files/publications/osha3151.pdf) | approved |
| 003 | Working at Heights | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3146.pdf) | approved |
| 009 | Pedestrian and Vehicle Segregation | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Work_Zone_Safety_Working_Around_Vehicles.pdf) | approved |
| 010 | Safe Use of Hand Tools | [CPWR](https://www.cpwr.com/wp-content/uploads/HA-Hand_Tools.pdf) | approved |
| 011 | Power Tools | [OSHA](https://www.osha.gov/sites/default/files/publications/osha3080.pdf) | approved |
| 025 | Ammonia Refrigeration Hazards | [OSHA](https://www.osha.gov/ammonia-refrigeration/hazards) | approved |
| 036 | Stored Energy | [OSHA](https://www.osha.gov/sites/default/files/publications/osha3120.pdf) | approved |
| 045 | Accident Prevention Signs and Tags | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.200) | approved |
| 049 | Scaffolding Inspection | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3150.pdf) | approved |
| 050 | Working from Roofs | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Preventing_Falls_Rooftops.pdf) | approved |
| 058 | Material Storage | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.250) | approved |
| 059 | Safe Lifting Operations | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Lift_Zone_Safety_Planning_Lift.pdf) | approved |
| 060 | Lifting Accessories | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.251) | approved |
| 065 | Crane Signals and Signal Persons | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1419) | approved |
| 069 | Driving for Work | [OSHA](https://www.osha.gov/sites/default/files/publications/MOTOR_VEHICLE_GUIDE.pdf) | approved |
| 075 | Cell Phones and Driving | [NIOSH](https://www.cdc.gov/niosh/motor-vehicle/distracted-driving/index.html) | approved |
| 079 | Fire Safety | [OSHA](https://www.osha.gov/sites/default/files/publications/osha3527.pdf) | approved |
| 080 | Fire Extinguishers | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.157) | approved |
| 082 | Emergency Evacuation | [OSHA](https://www.osha.gov/sites/default/files/publications/osha3088.pdf) | approved |
| 085 | First Aid Arrangements | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3317FIRST-AID.pdf) | approved |
| 086 | Accident Reporting | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1904/1904.39) | approved |
| 087 | Near-Miss Reporting | [OSHA](https://www.osha.gov/sites/default/files/IncInvGuide4Empl_Dec2015.pdf) | approved |
| 088 | Reporting Injuries: OSHA Recordkeeping | [OSHA](https://www.osha.gov/recordkeeping) | approved |
| 091 | Safety Leadership | [OSHA](https://www.osha.gov/Publications/OSHA3886.pdf) | approved |
| 095 | Job Hazard Analysis and Work Plans | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3071.pdf) | approved |
| 099 | Permit-Required Confined Space Entry | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3138.pdf) | approved |
| 107 | Chemical Safety | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3514.pdf) | approved |
| 109 | Chemical Labelling | [OSHA](https://www.osha.gov/sites/default/files/publications/osha3636.pdf) | approved |
| 110 | Safety Data Sheets | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3493QuickCardSafetyDataSheet.pdf) | approved |
| 116 | Solvents and Degreasers | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Solvents.pdf) | approved |
| 120 | Construction Dust Control | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3681.pdf) | approved |
| 122 | Noise | [NIOSH](https://www.cdc.gov/niosh/media/pdfs/2026/09/2026-118.pdf) | approved |
| 123 | Hearing Protection | [OSHA](https://www.osha.gov/sites/default/files/HearingConservationInConstruction-ToolboxTalk.pdf) | approved |
| 124 | Hand-Arm Vibration | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Vibration_Hand_Arm.pdf) | approved |
| 126 | Welding Fumes | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA_FS-3647_WELDING.pdf) | approved |
| 128 | Asbestos Awareness | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3507.pdf) | approved |
| 129 | Legionella Awareness | [OSHA](https://www.osha.gov/sites/default/files/faq.pdf) | approved |
| 136 | Sun Protection | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Skin_Cancer.pdf) | approved |
| 137 | Dehydration | [NIOSH](https://www.cdc.gov/niosh/docs/2011-174/pdfs/2011-174.pdf) | approved |
| 139 | Fatigue Management | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Shift_Work.pdf) | approved |
| 142 | Ergonomics | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Lifting_Carrying_Materials.pdf) | approved |
| 144 | Stress Awareness | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Workplace_Stress.pdf) | approved |
| 145 | Suicide Prevention in Construction | [CPWR](https://www.cpwr.com/wp-content/uploads/TT-Suicide_Prevention.pdf) | approved |
| 154 | Temporary and Staffing Agency Workers | [OSHA](https://www.osha.gov/sites/default/files/publications/OSHA3859.pdf) | approved |
| 166 | Working Near Roads | [OSHA](https://www.osha.gov/sites/default/files/publications/work_zone_traffic_safety.pdf) | approved |
| 177 | Pollution Prevention | [EPA](https://www.epa.gov/npdes/stormwater-discharges-construction-activities) | approved |
| 180 | Drain Protection | [EPA](https://www.epa.gov/system/files/documents/2021-11/bmp-storm-drain-inlet-protection.pdf) | approved |
| 183 | Site Dust Suppression for Air Quality | [EPA](https://www.epa.gov/system/files/documents/2021-11/bmp-dust-control.pdf) | approved |
| 244 | Battery Charging | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.441) | approved |
| 248 | Compressed Gas Storage | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.350) | approved |
| 250 | Bench Grinder Safety | [OSHA](https://www.osha.gov/machine-guarding/new-grinder-checklist) | approved |
| 253 | Abrasive Wheels | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.215) | approved |
| 277 | Working Around Fans | [OSHA](https://www.osha.gov/enforcement/directives/std-01-12-001) | approved |
| 296 | Equipment Pre-Use Checks | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.20) | approved |
| 297 | Defective Equipment | [OSHA](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.302) | approved |

## Original talks (written from OSHA / NIOSH / EPA sources)

No agency talk existed for these topics, so each was written from the rule or guidance page linked below and checked by the auditor.

| TBT | Talk | Written from | Audit |
| --- | --- | --- | --- |
| 018 | Brazing and Soldering | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.350](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.350) | approved |
| 039 | Site Induction | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.21](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.21) | approved |
| 043 | Slip, Trip and Fall Prevention | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.25](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.25) | approved |
| 055 | Harness Inspection | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.502](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.502) | approved |
| 062 | Overhead Hoists | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.554](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.554) | approved |
| 066 | Loading and Unloading | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.601](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.601) | approved |
| 078 | Winter Driving | [osha.gov/sites/default/files/publications/SafeDriving.pdf](https://www.osha.gov/sites/default/files/publications/SafeDriving.pdf) | approved |
| 090 | Stop Work Authority | [osha.gov/laws-regs/regulations/standardnumber/1977/1977.12](https://www.osha.gov/laws-regs/regulations/standardnumber/1977/1977.12) | approved |
| 105 | Compressed Air | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.302](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.302) | approved |
| 111 | Flammable Liquid Storage | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.152](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.152) | approved |
| 112 | Chemical Spill Response | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.65](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.65) | approved |
| 133 | Sanitation and Hygiene on the Jobsite | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.51](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.51) | approved |
| 152 | Young and New Workers | [cdc.gov/niosh/young-workers/about/index.html](https://www.cdc.gov/niosh/young-workers/about/index.html) | approved |
| 155 | Subcontractor Safety | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.16](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.16) | approved |
| 157 | Working Alone | [cdc.gov/niosh/bulletin/2024/lone-workers.html](https://www.cdc.gov/niosh/bulletin/2024/lone-workers.html) | approved |
| 159 | Working in Occupied Buildings | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.34](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.34) | approved |
| 170 | Debris and Waste Disposal | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.252](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.252) | approved |
| 172 | Hazardous Waste on the Jobsite | [epa.gov/hwgenerators/categories-hazardous-waste-generators](https://www.epa.gov/hwgenerators/categories-hazardous-waste-generators) | approved |
| 276 | Working Near Conveyors | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.555](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.555) | approved |
| 278 | Working Over or Near Water | [osha.gov/laws-regs/regulations/standardnumber/1926/1926.106](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.106) | approved |

## Dropped by decision (2026-09-25)

No agency source was found, the topic duplicates an approved talk, or it is out of scope (refrigeration plant, HR, warehouse). Not written to `data/processed/` and not seeded; the text remains in the .docx.

**Electrical** (4): TBT-016 Electrical Inspection and Defect Reporting; TBT-245 Battery Safety; TBT-246 Charging Electric Vehicles; TBT-288 Electrical Trips

**General Construction** (61): TBT-020 Gas Cylinders; TBT-040 Site Rules and Client Requirements; TBT-041 Construction Site Awareness; TBT-054 Fall Arrest Equipment; TBT-083 Fire Alarm Response; TBT-084 Emergency Contacts; TBT-089 Incident Scene Preservation; TBT-092 Safety Observation; TBT-093 Risk Assessment; TBT-094 Dynamic Risk Assessment; TBT-096 Job Hazard Analysis (JHA) Briefing; TBT-097 Work Permits; TBT-101 Gas Testing; TBT-102 Working in Poorly Ventilated Areas; TBT-103 Oxygen Deficiency; TBT-106 Compressed Gas Safety; TBT-113 Oil Spill Response; TBT-115 Cleaning Chemicals; TBT-117 Adhesives and Sealants; TBT-118 Aerosols; TBT-125 Whole-Body Vibration; TBT-131 Sharps and Waste; TBT-132 Needlestick Prevention; TBT-138 Working in Extreme Weather; TBT-140 Fitness for Work; TBT-141 Occupational Health; TBT-143 Workstation Set-Up; TBT-146 Respectful Workplace Behavior; TBT-147 Bullying and Harassment; TBT-148 Equality and Inclusion; TBT-149 Communication on Site; TBT-150 Effective Toolbox Talks; TBT-151 Competence and Training; TBT-153 Supervision; TBT-156 Visitor Safety; TBT-158 Working in Isolated Areas; TBT-160 Customer and Public Safety; TBT-161 Protecting Members of the Public; TBT-162 Security on Customer Sites; TBT-163 Site Access Control; TBT-164 Working Near Children or Vulnerable Persons; TBT-165 Preventing Unauthorized Access; TBT-167 Traffic Management; TBT-168 Temporary Roadwork Zone Awareness; TBT-178 Environmental Incident Reporting; TBT-179 Spill Kits; TBT-207 Protecting Customer Property; TBT-239 Warehouse Safety; TBT-240 Racking Safety; TBT-241 Pallet Safety; TBT-242 Safe Stacking; TBT-243 Manual Storage Systems; TBT-251 Drill Press Safety; TBT-256 Knife Safety; TBT-261 Sharp Edges and Burrs; TBT-274 Door and Roller Shutter Safety; TBT-275 Working Near Moving Doors; TBT-295 Toolbox and Tool Control; TBT-298 Tagging Out Defective Equipment; TBT-299 Working at Customer Premises: Behavior; TBT-300 Working at Customer Premises: Hygiene

**HVAC & Refrigeration** (41): TBT-021 Refrigerant Cylinders; TBT-022 Refrigerant Handling; TBT-023 Refrigerant Recovery; TBT-024 Refrigerant Charging; TBT-026 Pressure Systems; TBT-027 Pressure Testing; TBT-029 Refrigeration Plant Start-Up; TBT-030 Refrigeration Plant Shutdown; TBT-031 Compressor Safety; TBT-032 Pumps and Motors; TBT-033 Fans and Rotating Equipment; TBT-034 Guards and Interlocks; TBT-035 Machine Safety; TBT-038 Working on Customer Equipment; TBT-114 Refrigeration Oil Handling; TBT-173 Refrigerant Environmental Controls; TBT-174 Preventing Refrigerant Emissions; TBT-238 Storage of Refrigeration Equipment; TBT-259 Working with Insulation; TBT-260 Handling Sheet Metal; TBT-265 pressurized Pipework; TBT-266 Valve Safety; TBT-267 Flange Safety; TBT-268 Gasket Safety; TBT-269 Working on Condensers; TBT-270 Working on Evaporators; TBT-271 Cold Room Safety; TBT-272 Freezer Room Safety; TBT-273 Cold Store Entrapment; TBT-280 Working in Plant Rooms; TBT-281 Plant Room Access; TBT-282 Plant Room Housekeeping; TBT-283 Emergency Shutdowns; TBT-284 Alarm Response; TBT-285 Refrigeration Alarms; TBT-286 High Pressure Alarms; TBT-287 Low Pressure Alarms; TBT-289 Safe Restart After Trip; TBT-290 Maintenance Planning; TBT-293 Defect Escalation; TBT-294 Spare Parts Safety

**Excavation** (1): TBT-046 Temporary Works

**Roofing** (2): TBT-052 Roof Edge Protection; TBT-053 Roof Access

**Heavy Equipment** (3): TBT-061 Slings; TBT-064 Working Near Cranes; TBT-068 Reversing Safety

**Driving & Transportation** (8): TBT-067 Delivery Vehicle Safety; TBT-070 Vehicle Pre-Trip Inspections; TBT-071 Trailer Safety; TBT-072 Securing Loads in Work Vehicles; TBT-073 Journey Planning; TBT-074 Fatigue and Driving; TBT-076 Seat Belts; TBT-077 Adverse Weather Driving

**Welding** (1): TBT-127 Fume Extraction

**Carpentry** (2): TBT-247 Workshop Safety; TBT-252 Cutting Equipment

**Plumbing** (3): TBT-263 Pipe Supports and Fixings; TBT-264 Working with Copper Pipe; TBT-279 Drainage and Condensate Lines

## Skipped: duplicates of existing talks

| TBT | Title | Existing talk kept |
| --- | --- | --- |
| 004 | Ladder Safety | `falls-extension-ladders` |
| 005 | Mobile Towers and Scaffolds | `prevent-falls-scaffolds` |
| 006 | MEWPs and Mobile Access Equipment | `aerial-lifts-safety` |
| 007 | Forklift Truck Safety | `equipment-safety-forklifts` |
| 013 | Electrical Isolation | `electrical-safety-power` |
| 014 | Lockout/Tagout | `equipment-safety-maintenance` |
| 019 | Welding Safety | `arc-welding-and-fire-safety` |
| 042 | Housekeeping | `housekeeping` |
| 048 | Underground Services | `buried-utilities-and-safety` |
| 056 | Dropped Objects | `preventing-falling-objects` |
| 100 | Confined Space Awareness | `confined-spaces-and-safety` |
| 104 | Carbon Monoxide Awareness | `carbon-monoxide-poisoning` |
| 119 | Silica Dust | `silica` |
| 121 | Respiratory Protective Equipment | `respiratory-protection` |
| 130 | Biological Hazards | `biohazards` |
| 134 | Heat Stress | `hot-environments` |
| 135 | Cold Stress | `cold-environments` |
| 008 | Reach Truck Safety | `niosh-equipment-safety-forklifts.md` (found by source search) |
| 012 | Portable Electrical Equipment | `niosh-electrical-safety-extension-cords.md` (found by source search) |
| 015 | Working Near Live Electrical Equipment | `niosh-electrical-safety-power.md` (found by source search) |
| 017 | Hot Work | `niosh-arc-welding-and-fire-safety.md` (found by source search) |
| 044 | Work Area Set-Up | `cpwr-housekeeping.md` (found by source search) |
| 047 | Excavation Awareness | `cpwr-trench-safety.md` (found by source search) |
| 051 | Fragile Roofs | `niosh-prevent-falls-through-holes.md` (found by source search) |
| 057 | Tools at Height | `niosh-preventing-falling-objects.md` (found by source search) |
| 063 | Mobile Cranes Awareness | `niosh-crane-safety-stability-and-tipping.md` (found by source search) |
| 081 | Hot Work Fire Watch | `niosh-arc-welding-and-fire-safety.md` (found by source search) |
| 098 | Permit to Work: Hot Work | `niosh-arc-welding-and-fire-safety.md` (found by source search) |
| 249 | Workshop Housekeeping | `cpwr-housekeeping.md` (found by source search) |
| 254 | Reciprocating and Circular Saws | `cpwr-power-saw-safety.md` (found by source search) |
| 255 | Saws and Cutting Operations | `cpwr-power-saw-safety.md` (found by source search) |
| 257 | Staplers and Fasteners | `cpwr-nail-gun-safety.md` (found by source search) |
| 258 | Nail Guns and Powder Tools | `cpwr-nail-gun-safety.md` (found by source search) |

## Skipped: duplicate inside the import

- TBT-108 COSHH — COSHH is the UK chemical-hazard regime; identical body to TBT-107 Chemical Safety (US equivalent: HazCom / SDS).

## Skipped: not a safety/health topic

- TBT-169 Environmental Responsibilities — Environmental-sustainability topic, not a worker safety/health hazard
- TBT-171 Recycling — Environmental-sustainability topic, not a worker safety/health hazard
- TBT-175 Energy Efficiency — Environmental-sustainability topic, not a worker safety/health hazard
- TBT-176 Water Conservation — Environmental-sustainability topic, not a worker safety/health hazard
- TBT-181 Biodiversity Awareness — Environmental-sustainability topic, not a worker safety/health hazard
- TBT-182 Noise and Environmental Nuisance — Environmental-sustainability topic, not a worker safety/health hazard
- TBT-184 Quality Awareness — Quality-management topic, not a safety/health hazard
- TBT-185 Right First Time — Quality-management topic, not a safety/health hazard
- TBT-186 Following Work Instructions — Quality-management topic, not a safety/health hazard
- TBT-187 Document Control — Quality-management topic, not a safety/health hazard
- TBT-188 Drawing and Specification Control — Quality-management topic, not a safety/health hazard
- TBT-189 Checking Materials — Quality-management topic, not a safety/health hazard
- TBT-190 Material Traceability — Quality-management topic, not a safety/health hazard
- TBT-191 Inspection and Testing — Quality-management topic, not a safety/health hazard
- TBT-192 Inspection Records — Quality-management topic, not a safety/health hazard
- TBT-193 Calibration Awareness — Quality-management topic, not a safety/health hazard
- TBT-194 Using Correct Equipment — Quality-management topic, not a safety/health hazard
- TBT-195 Nonconforming Work — Quality-management topic, not a safety/health hazard
- TBT-196 Defect Reporting — Quality-management topic, not a safety/health hazard
- TBT-197 Corrective Action — Quality-management topic, not a safety/health hazard
- TBT-198 Customer Complaints — Quality-management topic, not a safety/health hazard
- TBT-199 Quality Handover — Quality-management topic, not a safety/health hazard
- TBT-200 Commissioning Records — Quality-management topic, not a safety/health hazard
- TBT-201 Service Reports — Quality-management topic, not a safety/health hazard
- TBT-202 Photographic Records — Quality-management topic, not a safety/health hazard
- TBT-203 Change Control — Quality-management topic, not a safety/health hazard
- TBT-204 Technical Queries — Quality-management topic, not a safety/health hazard
- TBT-205 Approval Before Deviation — Quality-management topic, not a safety/health hazard
- TBT-206 Preventing Rework — Quality-management topic, not a safety/health hazard
- TBT-208 Quality of Installation — Quality-management topic, not a safety/health hazard
- TBT-209 Quality of Maintenance — Quality-management topic, not a safety/health hazard
- TBT-210 Cleanliness of Plant Rooms — Quality-management topic, not a safety/health hazard
- TBT-211 Labelling and Identification — Quality-management topic, not a safety/health hazard
- TBT-212 As-Built Information — Quality-management topic, not a safety/health hazard
- TBT-213 Record Retention — Quality-management topic, not a safety/health hazard
- TBT-214 Information Security — Information/IT security topic, not a safety/health hazard
- TBT-215 Protecting Personal Data — Information/IT security topic, not a safety/health hazard
- TBT-216 Cyber Security Awareness — Information/IT security topic, not a safety/health hazard
- TBT-217 Phishing Awareness — Information/IT security topic, not a safety/health hazard
- TBT-218 Password Security — Information/IT security topic, not a safety/health hazard
- TBT-219 Use of Company IT — Information/IT security topic, not a safety/health hazard
- TBT-220 Mobile Device Security — Information/IT security topic, not a safety/health hazard
- TBT-221 Reporting Data Breaches — Information/IT security topic, not a safety/health hazard
- TBT-222 Social Media and Confidentiality — Information/IT security topic, not a safety/health hazard
- TBT-223 Secure Document Disposal — Information/IT security topic, not a safety/health hazard
- TBT-224 Fraud and Bribery Awareness — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-225 Gifts and Hospitality — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-226 Conflicts of Interest — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-227 Modern Slavery Awareness — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-228 Ethical Conduct — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-229 Procurement Safety Considerations — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-230 Approved Suppliers — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-231 Counterfeit Parts Awareness — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-232 Product Safety — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-233 Equipment Selection — Ethics/procurement/product-assurance topic, not a safety/health hazard
- TBT-234 Purchasing Chemicals Safely — Purchasing/procurement topic, not a safety/health hazard
- TBT-235 Purchasing PPE — Purchasing/procurement topic, not a safety/health hazard
- TBT-236 Sustainable Procurement — Purchasing/procurement topic, not a safety/health hazard
- TBT-237 Receiving Goods — Purchasing/procurement topic, not a safety/health hazard
- TBT-262 Pipework Installation — Quality-management topic, not a safety/health hazard
- TBT-291 Preventive Maintenance — Quality-management topic, not a safety/health hazard
- TBT-292 Defensive Maintenance — Quality-management topic, not a safety/health hazard

## Imported but overlapping an existing talk (your call)

Same theme as an existing talk but a different angle, so they were kept. Delete the JSON file to drop one.

- TBT-016 Electrical Inspection and Defect Reporting ↔ `electrical-safety-extension-cords`
- TBT-037 Safe Isolation Verification ↔ `equipment-safety-maintenance`
- TBT-052 Roof Edge Protection ↔ `aerial-lifts-safety`, `falls-extension-ladders`, `prevent-falls-scaffolds` (+2 more)
- TBT-053 Roof Access ↔ `aerial-lifts-safety`, `falls-extension-ladders`, `prevent-falls-scaffolds` (+2 more)
- TBT-054 Fall Arrest Equipment ↔ `aerial-lifts-safety`, `falls-extension-ladders`, `prevent-falls-scaffolds` (+2 more)
- TBT-064 Working Near Cranes ↔ `materials-handling-drywall`, `boom-truck-safety`, `crane-safety-stability-and-tipping`
- TBT-101 Gas Testing ↔ `confined-spaces-and-safety`
- TBT-102 Working in Poorly Ventilated Areas ↔ `confined-spaces-and-safety`
- TBT-103 Oxygen Deficiency ↔ `confined-spaces-and-safety`
- TBT-125 Whole-Body Vibration ↔ `repetitive-motion-carpal-tunnel-syndrome`
- TBT-127 Fume Extraction ↔ `arc-welding-and-fire-safety`
- TBT-131 Sharps and Waste ↔ `biohazards`
- TBT-132 Needlestick Prevention ↔ `biohazards`
- TBT-138 Working in Extreme Weather ↔ `hot-environments`
- TBT-282 Plant Room Housekeeping ↔ `housekeeping`

## Approved talks

- TBT-001 PPE: Selection, Use and Care (`ppe-selection-use-and-care`) — OSHA — OSHA: 29 CFR 1926.95, 29 CFR 1926.96, 29 CFR 1926.97, 29 CFR 1926.100, 29 CFR 1926.101, 29 CFR 1926.102, 29 CFR 1926.52
- TBT-003 Working at Heights (`working-at-heights`) — OSHA — OSHA: 29 CFR 1926.500, 29 CFR 1926.501, 29 CFR 1926.502, 29 CFR 1926.503
- TBT-009 Pedestrian and Vehicle Segregation (`pedestrian-and-vehicle-segregation`) — CPWR — OSHA: 29 CFR 1926.201, 29 CFR 1926.602(a)(9), 29 CFR 1926.601(b)(4)
- TBT-010 Safe Use of Hand Tools (`safe-use-of-hand-tools`) — CPWR — OSHA: 29 CFR 1926.301
- TBT-011 Power Tools (`power-tools`) — OSHA — OSHA: 29 CFR 1926.300, 29 CFR 1926.301, 29 CFR 1926.302, 29 CFR 1926.303, 29 CFR 1926.404(b)(1)
- TBT-018 Brazing and Soldering (`brazing-and-soldering`) — TailgatePro — OSHA: 29 CFR 1926.350, 29 CFR 1926.352, 29 CFR 1926.353
- TBT-025 Ammonia Refrigeration Hazards (`ammonia-refrigeration-hazards`) — OSHA — OSHA: 29 CFR 1910.119, 29 CFR 1926.64
- TBT-036 Stored Energy (`stored-energy`) — OSHA — OSHA: 29 CFR 1926.417, 29 CFR 1910.147
- TBT-039 Site Induction (`site-induction`) — TailgatePro — OSHA: 29 CFR 1926.21, 29 CFR 1926.20
- TBT-043 Slip, Trip and Fall Prevention (`slip-trip-and-fall-prevention`) — TailgatePro — OSHA: 29 CFR 1926.25, 29 CFR 1926.1052
- TBT-045 Accident Prevention Signs and Tags (`accident-prevention-signs-and-tags`) — OSHA — OSHA: 29 CFR 1926.200
- TBT-049 Scaffolding Inspection (`scaffolding-inspection`) — OSHA — OSHA: 29 CFR 1926.451, 29 CFR 1926.454
- TBT-050 Working from Roofs (`working-from-roofs`) — CPWR — OSHA: 29 CFR 1926.501, 29 CFR 1926.502
- TBT-055 Harness Inspection (`harness-inspection`) — TailgatePro — OSHA: 29 CFR 1926.502
- TBT-058 Material Storage (`material-storage`) — OSHA — OSHA: 29 CFR 1926.250
- TBT-059 Safe Lifting Operations (`safe-lifting-operations`) — CPWR — OSHA: 29 CFR 1926.1408, 29 CFR 1926.1417, 29 CFR 1926.1419, 29 CFR 1926.1424, 29 CFR 1926.251, 29 CFR 1926.1412, 29 CFR 1926.1427
- TBT-060 Lifting Accessories (`lifting-accessories`) — OSHA — OSHA: 29 CFR 1926.251
- TBT-062 Overhead Hoists (`overhead-hoists`) — TailgatePro — OSHA: 29 CFR 1926.554, 29 CFR 1926.20
- TBT-065 Crane Signals and Signal Persons (`crane-signals-and-signal-persons`) — OSHA — OSHA: 29 CFR 1926.1419
- TBT-066 Loading and Unloading (`loading-and-unloading`) — TailgatePro — OSHA: 29 CFR 1926.601, 29 CFR 1926.600
- TBT-069 Driving for Work (`driving-for-work`) — OSHA — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-075 Cell Phones and Driving (`cell-phones-and-driving`) — NIOSH — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-078 Winter Driving (`winter-driving`) — TailgatePro — OSHA: 
- TBT-079 Fire Safety (`fire-safety`) — OSHA — OSHA: 29 CFR 1926 Subpart C, 29 CFR 1926 Subpart F, 29 CFR 1926.34
- TBT-080 Fire Extinguishers (`fire-extinguishers`) — OSHA — OSHA: 29 CFR 1926.150, 29 CFR 1910.157
- TBT-082 Emergency Evacuation (`emergency-evacuation`) — OSHA — OSHA: 29 CFR 1926.35, 29 CFR 1926.34, 29 CFR 1926.159
- TBT-085 First Aid Arrangements (`first-aid-arrangements`) — OSHA — OSHA: 29 CFR 1926.50, 29 CFR 1910.1030
- TBT-086 Accident Reporting (`accident-reporting`) — OSHA — OSHA: 29 CFR 1904.39
- TBT-087 Near-Miss Reporting (`near-miss-reporting`) — OSHA — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-088 Reporting Injuries: OSHA Recordkeeping (`reporting-injuries-osha-recordkeeping`) — OSHA — OSHA: 29 CFR 1904, 29 CFR 1904.39
- TBT-090 Stop Work Authority (`stop-work-authority`) — TailgatePro — OSHA: 29 CFR 1926.20, 29 CFR 1977.12
- TBT-091 Safety Leadership (`safety-leadership`) — OSHA — OSHA: OSH Act Section 5(a)(1) General Duty Clause, OSH Act Section 11(c)
- TBT-095 Job Hazard Analysis and Work Plans (`job-hazard-analysis-and-work-plans`) — OSHA — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-099 Permit-Required Confined Space Entry (`permit-required-confined-space-entry`) — OSHA — OSHA: 29 CFR 1926 Subpart AA
- TBT-105 Compressed Air (`compressed-air`) — TailgatePro — OSHA: 29 CFR 1926.302
- TBT-107 Chemical Safety (`chemical-safety`) — OSHA — OSHA: 29 CFR 1926.59, 29 CFR 1910.1200
- TBT-109 Chemical Labelling (`chemical-labelling`) — OSHA — OSHA: 29 CFR 1926.59, 29 CFR 1910.1200
- TBT-110 Safety Data Sheets (`safety-data-sheets`) — OSHA — OSHA: 29 CFR 1926.59, 29 CFR 1910.1200(g)
- TBT-111 Flammable Liquid Storage (`flammable-liquid-storage`) — TailgatePro — OSHA: 29 CFR 1926.152, 29 CFR 1926.150
- TBT-112 Chemical Spill Response (`chemical-spill-response`) — TailgatePro — OSHA: 29 CFR 1926.65
- TBT-116 Solvents and Degreasers (`solvents-and-degreasers`) — CPWR — OSHA: 29 CFR 1926.55, 29 CFR 1926.57, 29 CFR 1926.95, 29 CFR 1910.1200
- TBT-120 Construction Dust Control (`construction-dust-control`) — OSHA — OSHA: 29 CFR 1926.1153, 29 CFR 1926.103
- TBT-122 Noise (`noise`) — NIOSH — OSHA: 29 CFR 1926.52
- TBT-123 Hearing Protection (`hearing-protection`) — OSHA — OSHA: 29 CFR 1926.52, 29 CFR 1926.101
- TBT-124 Hand-Arm Vibration (`hand-arm-vibration`) — CPWR — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-126 Welding Fumes (`welding-fumes`) — OSHA — OSHA: 29 CFR 1926 Subpart J, 29 CFR 1926.1126, 29 CFR 1926.103
- TBT-128 Asbestos Awareness (`asbestos-awareness`) — OSHA — OSHA: 29 CFR 1926.1101
- TBT-129 Legionella Awareness (`legionella-awareness`) — OSHA — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-133 Sanitation and Hygiene on the Jobsite (`sanitation-and-hygiene-on-the-jobsite`) — TailgatePro — OSHA: 29 CFR 1926.51
- TBT-136 Sun Protection (`sun-protection`) — CPWR — OSHA: OSH Act Section 5(a)(1) General Duty Clause, 29 CFR 1926.102
- TBT-137 Dehydration (`dehydration`) — NIOSH — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-139 Fatigue Management (`fatigue-management`) — CPWR — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-142 Ergonomics (`ergonomics`) — CPWR — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-144 Stress Awareness (`stress-awareness`) — CPWR — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-145 Suicide Prevention in Construction (`suicide-prevention-in-construction`) — CPWR — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-152 Young and New Workers (`young-and-new-workers`) — TailgatePro — OSHA: 29 CFR 1926.21
- TBT-154 Temporary and Staffing Agency Workers (`temporary-and-staffing-agency-workers`) — OSHA — OSHA: 29 CFR 1926.503, 29 CFR 1904.35(b)
- TBT-155 Subcontractor Safety (`subcontractor-safety`) — TailgatePro — OSHA: 29 CFR 1926.16
- TBT-157 Working Alone (`working-alone`) — TailgatePro — OSHA: 
- TBT-159 Working in Occupied Buildings (`working-in-occupied-buildings`) — TailgatePro — OSHA: 29 CFR 1926.34, 29 CFR 1926.150
- TBT-166 Working Near Roads (`working-near-roads`) — OSHA — OSHA: 29 CFR 1926.200, 29 CFR 1926.201, 29 CFR 1926.56
- TBT-170 Debris and Waste Disposal (`debris-and-waste-disposal`) — TailgatePro — OSHA: 29 CFR 1926.252, 29 CFR 1926.25
- TBT-172 Hazardous Waste on the Jobsite (`hazardous-waste-on-the-jobsite`) — TailgatePro — OSHA: 29 CFR 1926.252, 29 CFR 1926.25
- TBT-177 Pollution Prevention (`pollution-prevention`) — EPA — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-180 Drain Protection (`drain-protection`) — EPA — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-183 Site Dust Suppression for Air Quality (`site-dust-suppression-for-air-quality`) — EPA — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-244 Battery Charging (`battery-charging`) — OSHA — OSHA: 29 CFR 1926.441
- TBT-248 Compressed Gas Storage (`compressed-gas-storage`) — OSHA — OSHA: 29 CFR 1926.350
- TBT-250 Bench Grinder Safety (`bench-grinder-safety`) — OSHA — OSHA: 29 CFR 1926.303, 29 CFR 1926.102, 29 CFR 1910.215
- TBT-253 Abrasive Wheels (`abrasive-wheels`) — OSHA — OSHA: 29 CFR 1926.303, 29 CFR 1910.215
- TBT-276 Working Near Conveyors (`working-near-conveyors`) — TailgatePro — OSHA: 29 CFR 1926.555
- TBT-277 Working Around Fans (`working-around-fans`) — OSHA — OSHA: 29 CFR 1926.300(b)(2), 29 CFR 1910.212(a)(5)
- TBT-278 Working Over or Near Water (`working-over-or-near-water`) — TailgatePro — OSHA: 29 CFR 1926.106
- TBT-296 Equipment Pre-Use Checks (`equipment-pre-use-checks`) — OSHA — OSHA: 29 CFR 1926.20(a)(1), 29 CFR 1926.20(b)
- TBT-297 Defective Equipment (`defective-equipment`) — OSHA — OSHA: 29 CFR 1926.302, 29 CFR 1926.300(a), 29 CFR 1926.20(b)(3)
- TBT-002 Manual Material Handling and Lifting (`manual-material-handling-and-lifting`) — TailgatePro Library — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-028 Vacuum Pumps and Evacuation (`vacuum-pumps-and-evacuation`) — TailgatePro Library — OSHA: OSH Act Section 5(a)(1) General Duty Clause
- TBT-037 Safe Isolation Verification (`safe-isolation-verification`) — TailgatePro Library — OSHA: 29 CFR 1926.417, 29 CFR 1926.416
