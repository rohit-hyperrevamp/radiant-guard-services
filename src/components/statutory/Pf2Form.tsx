import { Blank, Box, FONT, HLine, Sheet, T, VLine } from "./form-kit";

const F = FONT.times, S = 8.05;
const BORDER: [number, number, number, number] = [24, 24, 587.5, 767.5];
const t = (x: number, y: number, c: React.ReactNode, o: Partial<React.ComponentProps<typeof T>> = {}) => <T x={x} y={y - 1.9} s={S} {...o}>{c}</T>;
const centre = (y: number, c: React.ReactNode, o: Partial<React.ComponentProps<typeof T>> = {}) => t(90, y, c, { w: 432, align: "center", ...o });
const justify = (y: number, c: React.ReactNode, x = 90, w = 432) => t(x, y, c, { w, align: "justify" });
/** A fill-in sitting on a printed underline (x..x+w, rule at y). */
const UL = (k: string, label: string, x: number, w: number, y: number, upper?: boolean) => <T x={x} y={y - 10} w={w} s={8.6}><Blank k={k} label={label} line="solid" s={8.6} font={FONT.arial} upper={upper} /></T>;

function Grid({ cols, top, lines, bottom }: { cols: number[]; top: number; lines: number[]; bottom: number }) {
  return <>
    <HLine x1={cols[0]} x2={cols[cols.length - 1]} y={top} t={1.3} />
    {lines.map((y, i) => <HLine key={y} x1={cols[0]} x2={cols[cols.length - 1]} y={y} t={i === 0 ? 1.3 : 0.6} />)}
    <HLine x1={cols[0]} x2={cols[cols.length - 1]} y={bottom} t={1.3} />
    {cols.map((x, i) => <VLine key={x} x={x} y1={top} y2={bottom} t={i === 0 || i === cols.length - 1 ? 1.3 : 0.6} />)}
  </>;
}
const nomCols = [85, 158.5, 220.5, 288, 333, 427.5, 526.5];
const nomRows = [340, 353.5, 367, 380.5, 394, 407.5, 421];
const famCols = [85, 121.5, 296.5, 350.5, 526.5];
const famRows = [640, 653, 666, 679, 692, 705, 718];

/** EPF/EPS Form 2 (Revised) — nomination and declaration, replica of the supplied two pages. */
export function Pf2Form() {
  return <>
    <Sheet w={612} h={792} font={F} border={BORDER}>
      {t(439.4, 49.8, "(FORM 2 REVISED)", { b: true, s: 9 })}
      {t(90, 71.6, "NOMINATION AND DECLARATION FORM FOR UNEXEMPTED/EXEMPTED ESTABLISHMENTS", { b: true, s: 9 })}
      {centre(86.5, "Declaration and Nomination Form under the Employees Provident Funds and Employees Pension Schemes")}
      {centre(100.3, "(Paragraph 33 and 61 (1) of the Employees Provident Fund Scheme 1952 and Paragraph 18 of the Employees")}
      {centre(109.6, "Pension Scheme 1995)")}
      {t(90, 127.9, <>1. Name <span style={{ fontSize: "7.1pt" }}>(IN BLOCK LETTERS) :</span></>)}
      <HLine x1={200} x2={522} y={133.5} t={0.5} />
      {UL("blockName", "Name (block letters)", 202, 104, 133.5, true)}{UL("blockFather", "Father’s / Husband’s name", 309, 128, 133.5, true)}{UL("surname", "Surname", 440, 82, 133.5, true)}
      {t(212.2, 137.2, "Name")}{t(306, 137.2, "Father’s / Husband’s Name")}{t(485.9, 137.2, "Surname")}
      {t(90, 155.5, "2. Date of Birth :")}{UL("dob", "Date of birth", 149, 78, 161.5)}{t(232, 156.3, "3. Account No.", { s: 7.1 })}{UL("pf", "Account number", 286, 77, 161.5)}
      {t(90, 174, "4. *Sex : MALE/FEMALE:")}{UL("gender", "Sex", 182, 83, 180)}{t(268, 174.8, "5. Marital Status", { s: 7.1 })}{UL("marital", "Marital status", 328, 163, 180)}
      {t(90, 192.4, "6. Address Permanent / Temporary :")}
      <HLine x1={209} x2={522} y={198} t={0.5} /><HLine x1={198} x2={522} y={212} t={0.5} />
      <Box k="address" label="Address" multi x={209} y={187.5} w={313} h={27} s={8.6} lh={14} font={FONT.arial} />

      {centre(233.9, "PART – A (EPF)", { b: true })}
      {t(90, 247.6, "I hereby nominate the person(s)/cancel the nomination made by me previously and nominate the person(s) mentioned below")}
      {t(90, 256.7, "to receive the amount standing to my credit in the Employees Provident Fund, in the event of my death.")}
      <Grid cols={nomCols} top={264.5} lines={[321.5, ...nomRows]} bottom={440.5} />
      {([[0, [[276.7, "Name of the"], [285.9, "Nominee (s)"]]], [1, [[276.7, "Address"]]], [2, [[276.7, "Nominee’s"], [285.9, "relationship with"], [295.1, "the member"]]], [3, [[276.8, "Date of"], [285.9, "Birth"]]], [4, [[276.8, "Total amount or share of"], [285.9, "accumulations in"], [295.1, "Provident Funds to be"], [304.4, "paid to each nominee"]]], [5, [[267.5, "If the nominee is minor"], [276.8, "name and address of the"], [285.9, "guardian who may receive"], [295.1, "the amount during the"], [304.4, "minority of the nominee"]]]] as [number, [number, string][]][]).map(([c, ls]) => ls.map(([y, s]) => <span key={`${c}${y}`}>{t(nomCols[c], y, s, { w: nomCols[c + 1] - nomCols[c], align: "center" })}</span>))}
      {[1, 2, 3, 4, 5, 6].map(n => <span key={n}>{t(nomCols[n - 1], 328.2, String(n), { w: nomCols[n] - nomCols[n - 1], align: "center" })}</span>)}
      {nomRows.slice(0, 6).map((y, r) => ["nomName", "nomAddress", "nomRelation", "nomDob", "nomShare", "nomGuardian"].map((k, c) =>
        <Box key={`${k}${r}`} k={`${k}${r}`} label={`EPF nominee ${r + 1} ${k.slice(3).toLowerCase()}`} x={nomCols[c] + 1.5} y={y + 1} w={nomCols[c + 1] - nomCols[c] - 3} h={11.5} s={7.8} font={FONT.arial} />))}
      {t(90, 452.4, "1")}{justify(452.4, "*Certified that I have no family as defined in para 2 (g) of the Employees Provident Fund Scheme 1952 and should I", 126, 396.3)}
      {t(126, 461.5, "acquire a family hereafter the above nomination should be deemed as cancelled.")}
      {t(90, 480, "2.")}{t(126, 480, "* Certified that my father/mother is/are dependent upon me.")}
      {t(90, 516.8, "Strike out whichever is not applicable")}{t(342, 516.8, "Signature/or thumb impression")}{t(342.3, 526, "of the subscriber")}
      {centre(553.6, "PART – (EPS)")}{centre(562.8, "Para 18")}
      {justify(572, "I hereby furnish below particulars of the members of my family who would be eligible to receive Widow/Children Pension in the")}
      {t(90, 581.2, "event of my premature death in service.")}
      <Grid cols={famCols} top={598.5} lines={[627.5, ...famRows]} bottom={731.5} />
      {t(90, 610.4, "Sr. No")}{t(144.5, 610.4, "Name & Address of the Family Member")}{t(317.4, 610.4, "Age")}{t(390.6, 610.4, "Relationship with the member")}
      {["(1)", "(2)", "(3)", "(4)"].map((n, i) => <span key={n}>{t(famCols[i], 630.3, n, { w: famCols[i + 1] - famCols[i], align: "center" })}</span>)}
      {famRows.slice(0, 6).map((y, r) => ["familyName", "familyAge", "familyRelation"].map((k, c) =>
        <Box key={`${k}${r}`} k={`${k}${r}`} label={`EPS family member ${r + 1} ${k.slice(6).toLowerCase()}`} x={famCols[c + 1] + 1.5} y={y + 1} w={famCols[c + 2] - famCols[c + 1] - 3} h={11} s={7.8} font={FONT.arial} />))}
    </Sheet>

    <Sheet w={612} h={792} font={F} border={BORDER}>
      {justify(49.2, "Certified that I have no family as defined in para 2 (vii) of the Employees’s Family Pension Scheme 1995 and should I acquire a")}
      {t(90, 58.3, "family hereafter I shall furnish Particulars there on in the above form.")}
      {justify(85.9, <>I hereby nominate the following person for receiving the monthly widow pension (admissible under para 16 2 (a)&nbsp; (i) &amp; (ii) in the</>)}
      {t(90, 95.2, "event of my death without leaving any eligible family member for receiving pension.")}
      <Grid cols={[85, 283, 379.5, 526.5]} top={121.5} lines={[141.5]} bottom={336} />
      {t(85, 124.4, "Name and Address of", { w: 198, align: "center" })}{t(85, 133.6, "the nominee", { w: 198, align: "center" })}
      {t(283, 124.4, "Date of Birth", { w: 96.5, align: "center" })}{t(379.5, 124.4, "Relationship with member", { w: 147, align: "center" })}
      <Box k="pensionNominee" label="Widow pension nominee name and address" multi x={87.5} y={144} w={193} h={189} s={8.6} font={FONT.arial} />
      <Box k="pensionDob" label="Widow pension nominee date of birth" multi x={285.5} y={144} w={91.5} h={189} s={8.6} font={FONT.arial} />
      <Box k="pensionRelation" label="Widow pension nominee relationship" multi x={382} y={144} w={142} h={189} s={8.6} font={FONT.arial} />
      {t(90, 348, "Date")}{UL("date", "Subscriber date", 108, 77, 354)}
      {t(422.4, 412.5, "Signature or thumb impression")}{t(423.1, 421.7, "of the subscriber")}
      <HLine x1={90} x2={522} y={446} t={0.5} />
      {centre(458.5, "CERTIFICATE BY EMPLOYER", { b: true })}
      {justify(476.9, "Certified that the above declaration and nomination has been signed / thumb impressed before me by Shri / Smt./", 124.2, 395.8)}
      {t(90, 490.7, "Miss")}{UL("employerMember", "Member name", 107, 259, 496.5)}{t(367, 490.7, "employed in my establishment after he/she has", { w: 155, align: "right" })}
      {t(90, 504.5, "read the entries / the entries have been read over to him/her by me and got confirmed by him/her.")}
      {t(90, 587.3, "Date :")}{UL("employerDate", "Employer date", 115, 83, 593)}
      {t(332.3, 587.3, "Signature of the employer or other authorised officer of the")}{t(332.5, 596.4, "establishment")}
      {t(332.5, 651.6, "Place :")}<T x={358} y={650} w={150} s={8.6}><Blank k="place" label="Place" line="none" s={8.6} font={FONT.arial} /></T>
      {t(90, 660.9, "Name & address of the Factory /Establishment")}
      {t(332.6, 670.1, "Date :")}<T x={358} y={668.5} w={150} s={8.6}><Blank k="certificateDate" label="Certificate date" line="none" s={8.6} font={FONT.arial} /></T>
      <Box k="employer" label="Factory / establishment name and address" multi x={90} y={676} w={210} h={52} s={8.6} font={FONT.arial} />
    </Sheet>
  </>;
}
