export type FormId = "esic37" | "accident11" | "epf11" | "pf2";
export type FormField = { key: string; label: string; page: number; x: number; y: number; width: number; height: number; required: boolean; kind: string; lineHeight?: number; marks?: Record<string, number[]> };
export type FormDefinition = { id: FormId; title: string; fields: FormField[] };
export const statutoryForms: FormDefinition[] = [
  {
    "id": "esic37",
    "title": "ESIC Form 37 \u2014 Continuing employment",
    "fields": [
      {
        "key": "doctor",
        "label": "Registered doctor",
        "page": 0,
        "x": 150,
        "y": 126.85,
        "width": 172,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "medicalDate",
        "label": "Medical application date",
        "page": 0,
        "x": 150,
        "y": 152.85,
        "width": 68,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "employerName",
        "label": "Employer name",
        "page": 0,
        "x": 236,
        "y": 447.85,
        "width": 96,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "employerAddress",
        "label": "Employer address",
        "page": 0,
        "x": 334,
        "y": 447.85,
        "width": 126,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "employerEsic",
        "label": "Employer ESIC code",
        "page": 0,
        "x": 294,
        "y": 465,
        "width": 149,
        "height": 18,
        "required": true,
        "kind": "text"
      },
      {
        "key": "name",
        "label": "Employee name",
        "page": 0,
        "x": 297,
        "y": 487.85,
        "width": 167,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "father",
        "label": "Father\u2019s name",
        "page": 0,
        "x": 170,
        "y": 501.85,
        "width": 172,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "esic",
        "label": "Employee insurance number",
        "page": 0,
        "x": 402,
        "y": 501.85,
        "width": 62,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "employmentDate",
        "label": "Continued / re-entered employment date",
        "page": 0,
        "x": 392,
        "y": 513.7,
        "width": 72,
        "height": 10,
        "required": true,
        "kind": "text"
      },
      {
        "key": "periodStart",
        "label": "Contribution period start",
        "page": 0,
        "x": 162,
        "y": 531.7,
        "width": 58,
        "height": 10,
        "required": false,
        "kind": "text"
      },
      {
        "key": "periodEnd",
        "label": "Preceding contribution period end (78 days paid)",
        "page": 0,
        "x": 137,
        "y": 550.7,
        "width": 72,
        "height": 10,
        "required": false,
        "kind": "text"
      },
      {
        "key": "date",
        "label": "Certificate date",
        "page": 0,
        "x": 172,
        "y": 562.85,
        "width": 77,
        "height": 11,
        "required": true,
        "kind": "text"
      }
    ]
  },
  {
    "id": "accident11",
    "title": "ESIC Form 11 \u2014 Accident book",
    "fields": [
      {
        "key": "serial",
        "label": "Serial number",
        "page": 0,
        "x": 46.5,
        "y": 216.0,
        "width": 22.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "noticeDate",
        "label": "Notice date",
        "page": 0,
        "x": 73.5,
        "y": 216.0,
        "width": 37.5,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "noticeTime",
        "label": "Notice time",
        "page": 0,
        "x": 116.0,
        "y": 216.0,
        "width": 37.5,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "injured",
        "label": "Injured employee name and address",
        "page": 0,
        "x": 158.5,
        "y": 216.0,
        "width": 92.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "gender",
        "label": "Sex",
        "page": 0,
        "x": 255.5,
        "y": 216.0,
        "width": 19.5,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "age",
        "label": "Age at accident",
        "page": 0,
        "x": 280.0,
        "y": 216.0,
        "width": 34.5,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "esic",
        "label": "Employee insurance number",
        "page": 0,
        "x": 319.5,
        "y": 216.0,
        "width": 82.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "occupation",
        "label": "Shift, department and occupation",
        "page": 0,
        "x": 406.5,
        "y": 216.0,
        "width": 81.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "cause",
        "label": "Cause of injury",
        "page": 0,
        "x": 492.5,
        "y": 216.0,
        "width": 38.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "nature",
        "label": "Nature of injury",
        "page": 0,
        "x": 535.5,
        "y": 216.0,
        "width": 37.5,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "injuryDate",
        "label": "Accident date",
        "page": 0,
        "x": 578.0,
        "y": 216.0,
        "width": 37.5,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "injuryTime",
        "label": "Accident time",
        "page": 0,
        "x": 620.5,
        "y": 216.0,
        "width": 38.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "injuryPlace",
        "label": "Accident place",
        "page": 0,
        "x": 663.5,
        "y": 216.0,
        "width": 37.5,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "activity",
        "label": "Activity at time of accident",
        "page": 0,
        "x": 706.0,
        "y": 216.0,
        "width": 91.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "notifier",
        "label": "Person giving notice: name, occupation, address",
        "page": 0,
        "x": 802.0,
        "y": 216.0,
        "width": 102.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "recorder",
        "label": "Person recording entry: name and designation",
        "page": 0,
        "x": 909.0,
        "y": 216.0,
        "width": 87.0,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "witnesses",
        "label": "Two witnesses: names, addresses, occupations",
        "page": 0,
        "x": 1001.0,
        "y": 216.0,
        "width": 108.5,
        "height": 82.5,
        "required": true,
        "kind": "textarea"
      },
      {
        "key": "remarks",
        "label": "Remarks",
        "page": 0,
        "x": 1114.5,
        "y": 216.0,
        "width": 45.0,
        "height": 82.5,
        "required": false,
        "kind": "textarea"
      }
    ]
  },
  {
    "id": "epf11",
    "title": "EPF Form 11 \u2014 Joining declaration",
    "fields": [
      {
        "key": "name",
        "label": "Employee name",
        "page": 0,
        "x": 318,
        "y": 86,
        "width": 204,
        "height": 28.8,
        "required": true,
        "kind": "text"
      },
      {
        "key": "father",
        "label": "Father / spouse name",
        "page": 0,
        "x": 318,
        "y": 116.8,
        "width": 204,
        "height": 30.7,
        "required": true,
        "kind": "text"
      },
      {
        "key": "dob",
        "label": "Date of birth",
        "page": 0,
        "x": 318,
        "y": 149.5,
        "width": 204,
        "height": 13.0,
        "required": true,
        "kind": "text"
      },
      {
        "key": "gender",
        "label": "Gender",
        "page": 0,
        "x": 318,
        "y": 164.5,
        "width": 204,
        "height": 13.3,
        "required": true,
        "kind": "text"
      },
      {
        "key": "marital",
        "label": "Marital status",
        "page": 0,
        "x": 318,
        "y": 179.8,
        "width": 204,
        "height": 12.7,
        "required": true,
        "kind": "text"
      },
      {
        "key": "email",
        "label": "Email",
        "page": 0,
        "x": 318,
        "y": 194.5,
        "width": 204,
        "height": 11.2,
        "required": false,
        "kind": "text"
      },
      {
        "key": "mobile",
        "label": "Mobile",
        "page": 0,
        "x": 318,
        "y": 207.7,
        "width": 204,
        "height": 11.3,
        "required": true,
        "kind": "text"
      },
      {
        "key": "previousEpf",
        "label": "Earlier EPF membership",
        "page": 0,
        "x": 400,
        "y": 222.2,
        "width": 40,
        "height": 12,
        "required": true,
        "kind": "choice",
        "marks": {
          "Yes": [
            411.5,
            228.2,
            8,
            4.8
          ],
          "No": [
            432,
            228.2,
            6.5,
            4.8
          ]
        }
      },
      {
        "key": "previousEps",
        "label": "Earlier EPS membership",
        "page": 0,
        "x": 400,
        "y": 243.7,
        "width": 40,
        "height": 12,
        "required": true,
        "kind": "choice",
        "marks": {
          "Yes": [
            411.5,
            249.7,
            8,
            4.8
          ],
          "No": [
            432,
            249.7,
            6.5,
            4.8
          ]
        }
      },
      {
        "key": "uan",
        "label": "Universal account number",
        "page": 0,
        "x": 318,
        "y": 273,
        "width": 204,
        "height": 17.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "previousPf",
        "label": "Previous PF account number",
        "page": 0,
        "x": 318,
        "y": 292.5,
        "width": 204,
        "height": 16.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "exitDate",
        "label": "Previous employment exit date",
        "page": 0,
        "x": 318,
        "y": 311,
        "width": 204,
        "height": 13.2,
        "required": false,
        "kind": "text"
      },
      {
        "key": "schemeCertificate",
        "label": "Scheme certificate number (if issued)",
        "page": 0,
        "x": 318,
        "y": 326.2,
        "width": 204,
        "height": 13.8,
        "required": false,
        "kind": "text"
      },
      {
        "key": "ppo",
        "label": "Pension payment order (if issued)",
        "page": 0,
        "x": 318,
        "y": 342,
        "width": 204,
        "height": 13.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "international",
        "label": "International worker",
        "page": 0,
        "x": 400,
        "y": 358.7,
        "width": 40,
        "height": 12,
        "required": true,
        "kind": "choice",
        "marks": {
          "Yes": [
            411.5,
            364.7,
            8,
            4.8
          ],
          "No": [
            432,
            364.7,
            6.5,
            4.8
          ]
        }
      },
      {
        "key": "country",
        "label": "Country of origin (international worker)",
        "page": 0,
        "x": 318,
        "y": 378.8,
        "width": 204,
        "height": 13.2,
        "required": false,
        "kind": "text"
      },
      {
        "key": "passport",
        "label": "Passport number (international worker)",
        "page": 0,
        "x": 318,
        "y": 394,
        "width": 204,
        "height": 13,
        "required": false,
        "kind": "text"
      },
      {
        "key": "passportValidity",
        "label": "Passport validity from / to",
        "page": 0,
        "x": 318,
        "y": 409,
        "width": 204,
        "height": 13.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "bank",
        "label": "Bank account and IFSC",
        "page": 0,
        "x": 318,
        "y": 440,
        "width": 204,
        "height": 19.5,
        "required": true,
        "kind": "text"
      },
      {
        "key": "aadhaar",
        "label": "Aadhaar number",
        "page": 0,
        "x": 318,
        "y": 461.5,
        "width": 204,
        "height": 14.0,
        "required": true,
        "kind": "text"
      },
      {
        "key": "pan",
        "label": "PAN",
        "page": 0,
        "x": 318,
        "y": 477.5,
        "width": 204,
        "height": 13.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "date",
        "label": "Member declaration date",
        "page": 0,
        "x": 70,
        "y": 584.85,
        "width": 130,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "place",
        "label": "Place",
        "page": 0,
        "x": 70,
        "y": 594.85,
        "width": 130,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "employerMember",
        "label": "Member name \u2014 employer declaration",
        "page": 0,
        "x": 188,
        "y": 621.35,
        "width": 72,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "joining",
        "label": "Date of joining",
        "page": 0,
        "x": 342,
        "y": 621.35,
        "width": 48,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "pf",
        "label": "Allotted PF number",
        "page": 0,
        "x": 74,
        "y": 631.35,
        "width": 90,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "allottedUan",
        "label": "Allotted UAN",
        "page": 0,
        "x": 333,
        "y": 654.85,
        "width": 90,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "employerDate",
        "label": "Employer declaration date",
        "page": 0,
        "x": 106,
        "y": 808.85,
        "width": 90,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "parentKind",
        "label": "Father or spouse named",
        "page": 0,
        "x": 115.5,
        "y": 120.5,
        "width": 8,
        "height": 8,
        "required": true,
        "kind": "parent",
        "marks": {
          "Father": [
            119.5,
            124.5
          ],
          "Spouse": [
            219.5,
            124.5
          ]
        }
      },
      {
        "key": "kycStatus",
        "label": "Employer KYC upload status",
        "page": 0,
        "x": 89.5,
        "y": 688.3,
        "width": 8,
        "height": 8,
        "required": false,
        "kind": "kyc",
        "marks": {
          "Not uploaded": [
            93.5,
            692.3
          ],
          "Uploaded, not approved": [
            93.5,
            701.8
          ],
          "Approved with DSC": [
            93.5,
            711.8
          ]
        }
      },
      {
        "key": "transferStatus",
        "label": "Employer transfer declaration",
        "page": 0,
        "x": 90,
        "y": 757.3,
        "width": 8,
        "height": 8,
        "required": false,
        "kind": "transfer",
        "marks": {
          "Digital transfer approved": [
            94,
            761.3
          ],
          "Physical transfer claim informed": [
            94,
            780.8
          ]
        }
      }
    ]
  },
  {
    "id": "pf2",
    "title": "PF Form 2 \u2014 Nomination and declaration",
    "fields": [
      {
        "key": "blockName",
        "label": "Employee name (block letters)",
        "page": 0,
        "x": 202,
        "y": 123.0,
        "width": 105,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "blockFather",
        "label": "Father / husband name",
        "page": 0,
        "x": 310,
        "y": 123.0,
        "width": 126,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "surname",
        "label": "Surname",
        "page": 0,
        "x": 440,
        "y": 123.0,
        "width": 80,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "dob",
        "label": "Date of birth",
        "page": 0,
        "x": 149,
        "y": 151.0,
        "width": 78,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "pf",
        "label": "PF account number",
        "page": 0,
        "x": 286,
        "y": 151.0,
        "width": 76,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "gender",
        "label": "Sex",
        "page": 0,
        "x": 184,
        "y": 169.5,
        "width": 81,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "marital",
        "label": "Marital status",
        "page": 0,
        "x": 328,
        "y": 169.5,
        "width": 162,
        "height": 11,
        "required": true,
        "kind": "text"
      },
      {
        "key": "address",
        "label": "Permanent / temporary address",
        "page": 0,
        "x": 209,
        "y": 189.5,
        "width": 312,
        "height": 28,
        "required": true,
        "kind": "text",
        "lineHeight": 15
      },
      {
        "key": "nomName0",
        "label": "EPF nominee 1 \u2014 Name",
        "page": 0,
        "x": 87.5,
        "y": 341.5,
        "width": 68.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomAddress0",
        "label": "EPF nominee 1 \u2014 Address",
        "page": 0,
        "x": 161.0,
        "y": 341.5,
        "width": 56.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomRelation0",
        "label": "EPF nominee 1 \u2014 Relationship",
        "page": 0,
        "x": 223.0,
        "y": 341.5,
        "width": 62.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomDob0",
        "label": "EPF nominee 1 \u2014 Date of birth",
        "page": 0,
        "x": 290.5,
        "y": 341.5,
        "width": 39.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomShare0",
        "label": "EPF nominee 1 \u2014 Share (%)",
        "page": 0,
        "x": 335.5,
        "y": 341.5,
        "width": 89.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomGuardian0",
        "label": "EPF nominee 1 \u2014 Minor guardian name/address",
        "page": 0,
        "x": 430.0,
        "y": 341.5,
        "width": 94.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyName0",
        "label": "EPS family member 1 \u2014 Name and address",
        "page": 0,
        "x": 124.0,
        "y": 641.5,
        "width": 170.0,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyAge0",
        "label": "EPS family member 1 \u2014 Age",
        "page": 0,
        "x": 299.5,
        "y": 641.5,
        "width": 48.5,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyRelation0",
        "label": "EPS family member 1 \u2014 Relationship",
        "page": 0,
        "x": 353.5,
        "y": 641.5,
        "width": 170.5,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomName1",
        "label": "EPF nominee 2 \u2014 Name",
        "page": 0,
        "x": 87.5,
        "y": 355.0,
        "width": 68.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomAddress1",
        "label": "EPF nominee 2 \u2014 Address",
        "page": 0,
        "x": 161.0,
        "y": 355.0,
        "width": 56.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomRelation1",
        "label": "EPF nominee 2 \u2014 Relationship",
        "page": 0,
        "x": 223.0,
        "y": 355.0,
        "width": 62.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomDob1",
        "label": "EPF nominee 2 \u2014 Date of birth",
        "page": 0,
        "x": 290.5,
        "y": 355.0,
        "width": 39.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomShare1",
        "label": "EPF nominee 2 \u2014 Share (%)",
        "page": 0,
        "x": 335.5,
        "y": 355.0,
        "width": 89.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomGuardian1",
        "label": "EPF nominee 2 \u2014 Minor guardian name/address",
        "page": 0,
        "x": 430.0,
        "y": 355.0,
        "width": 94.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyName1",
        "label": "EPS family member 2 \u2014 Name and address",
        "page": 0,
        "x": 124.0,
        "y": 655.0,
        "width": 170.0,
        "height": 9.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyAge1",
        "label": "EPS family member 2 \u2014 Age",
        "page": 0,
        "x": 299.5,
        "y": 655.0,
        "width": 48.5,
        "height": 9.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyRelation1",
        "label": "EPS family member 2 \u2014 Relationship",
        "page": 0,
        "x": 353.5,
        "y": 655.0,
        "width": 170.5,
        "height": 9.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomName2",
        "label": "EPF nominee 3 \u2014 Name",
        "page": 0,
        "x": 87.5,
        "y": 368.5,
        "width": 68.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomAddress2",
        "label": "EPF nominee 3 \u2014 Address",
        "page": 0,
        "x": 161.0,
        "y": 368.5,
        "width": 56.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomRelation2",
        "label": "EPF nominee 3 \u2014 Relationship",
        "page": 0,
        "x": 223.0,
        "y": 368.5,
        "width": 62.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomDob2",
        "label": "EPF nominee 3 \u2014 Date of birth",
        "page": 0,
        "x": 290.5,
        "y": 368.5,
        "width": 39.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomShare2",
        "label": "EPF nominee 3 \u2014 Share (%)",
        "page": 0,
        "x": 335.5,
        "y": 368.5,
        "width": 89.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomGuardian2",
        "label": "EPF nominee 3 \u2014 Minor guardian name/address",
        "page": 0,
        "x": 430.0,
        "y": 368.5,
        "width": 94.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyName2",
        "label": "EPS family member 3 \u2014 Name and address",
        "page": 0,
        "x": 124.0,
        "y": 667.5,
        "width": 170.0,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyAge2",
        "label": "EPS family member 3 \u2014 Age",
        "page": 0,
        "x": 299.5,
        "y": 667.5,
        "width": 48.5,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyRelation2",
        "label": "EPS family member 3 \u2014 Relationship",
        "page": 0,
        "x": 353.5,
        "y": 667.5,
        "width": 170.5,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomName3",
        "label": "EPF nominee 4 \u2014 Name",
        "page": 0,
        "x": 87.5,
        "y": 382.0,
        "width": 68.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomAddress3",
        "label": "EPF nominee 4 \u2014 Address",
        "page": 0,
        "x": 161.0,
        "y": 382.0,
        "width": 56.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomRelation3",
        "label": "EPF nominee 4 \u2014 Relationship",
        "page": 0,
        "x": 223.0,
        "y": 382.0,
        "width": 62.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomDob3",
        "label": "EPF nominee 4 \u2014 Date of birth",
        "page": 0,
        "x": 290.5,
        "y": 382.0,
        "width": 39.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomShare3",
        "label": "EPF nominee 4 \u2014 Share (%)",
        "page": 0,
        "x": 335.5,
        "y": 382.0,
        "width": 89.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomGuardian3",
        "label": "EPF nominee 4 \u2014 Minor guardian name/address",
        "page": 0,
        "x": 430.0,
        "y": 382.0,
        "width": 94.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyName3",
        "label": "EPS family member 4 \u2014 Name and address",
        "page": 0,
        "x": 124.0,
        "y": 680.5,
        "width": 170.0,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyAge3",
        "label": "EPS family member 4 \u2014 Age",
        "page": 0,
        "x": 299.5,
        "y": 680.5,
        "width": 48.5,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyRelation3",
        "label": "EPS family member 4 \u2014 Relationship",
        "page": 0,
        "x": 353.5,
        "y": 680.5,
        "width": 170.5,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomName4",
        "label": "EPF nominee 5 \u2014 Name",
        "page": 0,
        "x": 87.5,
        "y": 395.5,
        "width": 68.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomAddress4",
        "label": "EPF nominee 5 \u2014 Address",
        "page": 0,
        "x": 161.0,
        "y": 395.5,
        "width": 56.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomRelation4",
        "label": "EPF nominee 5 \u2014 Relationship",
        "page": 0,
        "x": 223.0,
        "y": 395.5,
        "width": 62.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomDob4",
        "label": "EPF nominee 5 \u2014 Date of birth",
        "page": 0,
        "x": 290.5,
        "y": 395.5,
        "width": 39.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomShare4",
        "label": "EPF nominee 5 \u2014 Share (%)",
        "page": 0,
        "x": 335.5,
        "y": 395.5,
        "width": 89.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomGuardian4",
        "label": "EPF nominee 5 \u2014 Minor guardian name/address",
        "page": 0,
        "x": 430.0,
        "y": 395.5,
        "width": 94.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyName4",
        "label": "EPS family member 5 \u2014 Name and address",
        "page": 0,
        "x": 124.0,
        "y": 694.0,
        "width": 170.0,
        "height": 9.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyAge4",
        "label": "EPS family member 5 \u2014 Age",
        "page": 0,
        "x": 299.5,
        "y": 694.0,
        "width": 48.5,
        "height": 9.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyRelation4",
        "label": "EPS family member 5 \u2014 Relationship",
        "page": 0,
        "x": 353.5,
        "y": 694.0,
        "width": 170.5,
        "height": 9.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomName5",
        "label": "EPF nominee 6 \u2014 Name",
        "page": 0,
        "x": 87.5,
        "y": 409.0,
        "width": 68.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomAddress5",
        "label": "EPF nominee 6 \u2014 Address",
        "page": 0,
        "x": 161.0,
        "y": 409.0,
        "width": 56.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomRelation5",
        "label": "EPF nominee 6 \u2014 Relationship",
        "page": 0,
        "x": 223.0,
        "y": 409.0,
        "width": 62.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomDob5",
        "label": "EPF nominee 6 \u2014 Date of birth",
        "page": 0,
        "x": 290.5,
        "y": 409.0,
        "width": 39.5,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomShare5",
        "label": "EPF nominee 6 \u2014 Share (%)",
        "page": 0,
        "x": 335.5,
        "y": 409.0,
        "width": 89.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "nomGuardian5",
        "label": "EPF nominee 6 \u2014 Minor guardian name/address",
        "page": 0,
        "x": 430.0,
        "y": 409.0,
        "width": 94.0,
        "height": 10.5,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyName5",
        "label": "EPS family member 6 \u2014 Name and address",
        "page": 0,
        "x": 124.0,
        "y": 706.5,
        "width": 170.0,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyAge5",
        "label": "EPS family member 6 \u2014 Age",
        "page": 0,
        "x": 299.5,
        "y": 706.5,
        "width": 48.5,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "familyRelation5",
        "label": "EPS family member 6 \u2014 Relationship",
        "page": 0,
        "x": 353.5,
        "y": 706.5,
        "width": 170.5,
        "height": 10.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "pensionNominee",
        "label": "Pension nominee name and address (no eligible family)",
        "page": 1,
        "x": 87.5,
        "y": 143.5,
        "width": 193.0,
        "height": 191.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "pensionDob",
        "label": "Pension nominee date of birth",
        "page": 1,
        "x": 286.0,
        "y": 143.5,
        "width": 91.0,
        "height": 191.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "pensionRelation",
        "label": "Pension nominee relationship",
        "page": 1,
        "x": 382.0,
        "y": 143.5,
        "width": 142.0,
        "height": 191.0,
        "required": false,
        "kind": "text"
      },
      {
        "key": "date",
        "label": "Member declaration date",
        "page": 1,
        "x": 110,
        "y": 343.5,
        "width": 74,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "employerMember",
        "label": "Employee name \u2014 employer certificate",
        "page": 1,
        "x": 114,
        "y": 486.0,
        "width": 250,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "employerDate",
        "label": "Employer certificate date",
        "page": 1,
        "x": 125,
        "y": 582.5,
        "width": 74,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "employer",
        "label": "Factory / establishment name and address",
        "page": 1,
        "x": 90,
        "y": 676,
        "width": 210,
        "height": 52,
        "required": false,
        "kind": "text"
      },
      {
        "key": "place",
        "label": "Place",
        "page": 1,
        "x": 358,
        "y": 648.35,
        "width": 144,
        "height": 11,
        "required": false,
        "kind": "text"
      },
      {
        "key": "certificateDate",
        "label": "Establishment date",
        "page": 1,
        "x": 358,
        "y": 666.85,
        "width": 144,
        "height": 11,
        "required": false,
        "kind": "text"
      }
    ]
  }
];
