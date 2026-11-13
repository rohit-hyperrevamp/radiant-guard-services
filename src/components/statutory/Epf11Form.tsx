import { Blank, Box, FONT, HLine, Sheet, T, Tick, VLine, YesNo } from "./form-kit";

const C = FONT.calibri, A = FONT.arial;
const X0 = 24.5, X1 = 45.5, X2 = 314, X3 = 528;
const S = 9.2;
// Row rules [y, from x]: main rows span the number column, sub-rows start at the label column.
const rules: [number, number][] = [[85, X0], [115.8, X0], [148.5, X0], [163.5, X0], [178.8, X0], [193.5, X0], [220, X0], [241.5, X0], [257, X0], [291.5, X1], [310, X1], [325.2, X1], [341, X1], [356.5, X0], [377.8, X1], [393, X1], [408, X1], [423.5, X0], [439, X1], [460.5, X1], [476.5, X1], [491.5, X0]];
const nums: [string, number][] = [["1.", 90], ["2.", 120], ["3.", 153], ["4", 168], ["5", 183], ["6", 198], ["7", 226], ["8", 246], ["9", 303], ["10", 386], ["11", 442]];
// Answer cells (field, top, bottom) in the right-hand column.
const cells: [string, number, number, string][] = [["name", 85, 115.8, "Name of the member"], ["father", 115.8, 148.5, "Father’s / Spouse’s name"], ["dob", 148.5, 163.5, "Date of birth"], ["gender", 163.5, 178.8, "Gender"], ["marital", 178.8, 193.5, "Marital status"], ["email", 193.5, 206.8, "Email ID"], ["mobile", 206.8, 220, "Mobile number"], ["uan", 257, 291.5, "Universal account number"], ["previousPf", 291.5, 310, "Previous PF account number"], ["exitDate", 310, 325.2, "Date of exit"], ["schemeCertificate", 325.2, 341, "Scheme certificate number"], ["ppo", 341, 356.5, "PPO number"], ["country", 377.8, 393, "Country of origin"], ["passport", 393, 408, "Passport number"], ["passportValidity", 408, 423.5, "Passport validity"], ["bank", 439, 460.5, "Bank account & IFSC"], ["aadhaar", 460.5, 476.5, "Aadhaar number"], ["pan", 476.5, 491.5, "PAN"]];
const L = (x: number, y: number, t: React.ReactNode, s = S) => <T x={x} y={y} s={s} font={C}>{t}</T>;
const sub = (k: string, y: number, t: React.ReactNode) => <>{L(51.5, y, `${k})`)}{L(68, y, t)}</>;

/** EPF New Form No. 11 — Declaration Form, replica of the supplied page. */
export function Epf11Form() {
  return <Sheet w={595.2} h={841.68} font={C}>
    <T x={300} y={7} w={221} s={10.1} b align="right">New Form No.-11 &nbsp;– Declaration Form</T>
    <T x={300} y={20.5} w={221} s={8.1} b i align="right">(To be retained by the employer for future reference)</T>
    <T x={0} y={31.5} w={586} s={9.9} b align="center">EMPLOYEES’ PROVIDENT FUND ORGANISATION</T>
    <T x={0} y={45} w={588} s={7.1} font={A} align="center">Employees’ Provident Funds Scheme, 1952 (Paragraph 34 &amp; 57) &amp;</T>
    <T x={0} y={56} w={588} s={7.1} font={A} align="center">Employees’ Pension Scheme, 1995 (Paragraph 24)</T>
    <T x={62} y={68.5} w={465} s={8.0} font={A} align="center">(Declaration by a person taking up employment in any establishment on which EPF Scheme, 1952 and /or EPS, 1995 is applicable)</T>

    {rules.map(([y, x]) => <HLine key={y} x1={x} x2={X3} y={y} t={0.6} />)}
    <VLine x={X0} y1={85} y2={491.5} /><VLine x={X1} y1={85} y2={491.5} /><VLine x={X2} y1={85} y2={491.5} />
    {nums.map(([n, y]) => <T key={n} x={X0} y={y} w={X1 - X0} s={S} align="center">{n}</T>)}
    {L(51.5, 87, "Name of the member")}
    {L(51.5, 119.5, "Father’s Name")}{L(137, 119.5, "Spouse’s Name")}
    <Tick k="parentKind" option="Father" x={113.5} y={120.5} /><Tick k="parentKind" option="Spouse" x={214.5} y={120.5} />
    {L(51.5, 135.5, "(Please tick whichever is applicable)")}
    {L(51.5, 152, <>Date of Birth: <b>( DD / MM / YYYY )</b></>)}
    {L(51.5, 166.5, "Gender: (Male/Female/Transgender)")}
    {L(51.5, 181.5, "Marital Status: (Married/Unmarried/Widow/Widower/Divorcee)")}
    {L(51.5, 196.5, <>(a)&nbsp;&nbsp; Email ID:</>)}{L(51.5, 211.5, <>(b)&nbsp;&nbsp; Mobile No.:</>)}
    {L(51.5, 222, "Whether earlier a member of Employees’ Provident Fund Scheme,")}{L(51.5, 231.5, "1952")}
    {L(51.5, 244, "Whether earlier a member of Employees’ Pension Scheme, 1995")}
    <T x={51.5} y={258.5} s={9.6} b font={C}>Previous employment details: [if Yes to 7 AND/OR 8 above]</T>
    {sub("a", 273, "Universal Account Number:")}{sub("b", 294, "Previous PF Account Number:")}
    {sub("c", 312, "Date of exit from previous employment: (DD/MM/YYYY)")}{sub("d", 328, "Scheme Certificate No. (if issued)")}
    {sub("e", 344, "Pension Payment Order (PPO) No. (if issued)")}
    {sub("a", 359.5, "International Worker:")}{sub("b", 380, "If yes, state country of origin (India/Name of other country)")}
    {sub("c", 395, "Passport No.")}{sub("d", 410, <>Validity of passport [(DD/MM/YYYY) <b>to</b> (DD/MM/YYYY)]</>)}
    {L(51.5, 426, <><b>KYC Details:</b> (attach self attested copies of following KYCs)</>)}
    {sub("a", 441, "Bank Account No. & IFS Code")}{sub("b", 463, "AADHAR Number")}{sub("c", 478, "Permanent Account Number (PAN), if available")}
    <YesNo k="previousEpf" x={403.5} y={224.5} s={7.9} />
    <YesNo k="previousEps" x={403.5} y={246} s={7.9} />
    <YesNo k="international" x={403.5} y={361} s={7.9} />
    {cells.map(([k, t, b, label]) => <Box key={k} k={k} label={label} x={X2 + 3} y={t + (b - t - 12) / 2} w={X3 - X2 - 6} h={12} s={8.6} font={A} />)}

    <T x={0} y={496} w={639} s={11.2} b align="center" style={{ textDecoration: "underline" }}>U<small style={{ fontSize: "8.6pt" }}>NDERTAKING</small></T>
    {([[510, "1)", "Certified that the particulars are true to the best of my knowledge."], [521, "2)", "I authorize EPFO to use my Aadhar for verification/authentication/eKYC purpose for service delivery."], [532, "3)", "Kindly transfer the funds and service details, if applicable, from the previous PF account as declared above to the present P.F. Account."], [543, "", "(The transfer would be possible only if the identified KYC detail approved by previous employer has been verified by present employer"], [554, "", "using his Digital Signature Certificate)"], [565.5, "4)", "In case of changes in above details, the same will be intimated to employer at the earliest."]] as const).map(([y, n, t]) => <span key={y}>{n && <T x={45.5} y={y + 0.5} s={7.6}>{n}</T>}<T x={60} y={y} s={8.7}>{t}</T></span>)}
    <T x={46} y={586} w={140} s={8.9}>Date:<Blank k="date" s={8.9} line="none" font={A} label="Declaration date" /></T>
    <T x={46} y={596} w={140} s={8.9}>Place:<Blank k="place" s={8.9} line="none" font={A} label="Declaration place" /></T>
    <T x={442} y={595.5} s={8.9}>Signature of Member</T>
    <T x={0} y={607.5} w={641} s={10.6} b align="center" style={{ textDecoration: "underline" }}>D<small style={{ fontSize: "8.2pt" }}>ECLARATION &nbsp;BY </small>P<small style={{ fontSize: "8.2pt" }}>RESENT </small>E<small style={{ fontSize: "8.2pt" }}>MPLOYER</small></T>
    <T x={52} y={623.5} s={8.9}>A.</T>
    {([[73, "The"], [97, "member"], [133, "Mr./Ms./Mrs."], [265, "has"], [287, "joined"], [316, "on"], [393, "and"], [415, "has"], [438, "been"], [462, "allotted"], [498, "PF"], [515, "Number"]] as const).map(([x, t]) => <T key={x} x={x} y={623.5} s={8.9}>{t}</T>)}
    <T x={184} y={623.5} w={74} s={8.9}><Blank k="employerMember" s={8.9} label="Member name" font={A} /></T>
    <T x={330} y={623.5} w={56} s={8.9}><Blank k="joining" s={8.9} label="Joining date" font={A} /></T>
    <T x={73} y={635} w={113} s={8.9}><Blank k="pf" s={8.9} label="PF number" font={A} /></T>
    <T x={52} y={644} s={8.9}>B.</T><T x={73} y={644} s={8.9}>In case the person was earlier not a member of EPF Scheme, 1952 and EPS, 1995:</T>
    <T x={75} y={658} s={8.9}>•</T><T x={100} y={658} w={293} s={8.9}><b>(Post allotment of UAN)</b>&nbsp;The UAN allotted for the member is&nbsp;<Blank k="allottedUan" s={8.9} label="UAN allotted" font={A} /></T>
    <T x={75} y={668} s={8.9}>•</T><T x={100} y={668} s={8.9} b>Please Tick the Appropriate Option:</T>
    <T x={118} y={677.5} s={8.9}>The KYC details of the above member in the UAN database</T>
    {([[689.5, "Not uploaded", "Have not been uploaded"], [699, "Uploaded, not approved", "Have been uploaded but not approved"], [709, "Approved with DSC", "Have been uploaded and approved with DSC"]] as const).map(([y, o, t]) => <span key={o}><Tick k="kycStatus" option={o} x={90.5} y={y - 1} size={6} /><T x={114} y={y - 2} s={8.9}>{t}</T></span>)}
    <T x={52} y={717} s={8.9}>C.</T><T x={73} y={717} s={8.9}>In case the person was earlier a member of EPF Scheme, 1952 and EPS, 1995:</T>
    <T x={80} y={727} s={8.9}>•</T><T x={105} y={727} w={437} s={8.9} align="justify">The above PF Account number/UAN of the member as mentioned in (A) above has been tagged with his/her UAN/Previous</T>
    <T x={105} y={736.5} s={8.9}>Member ID as declared by member.</T>
    <T x={80} y={746} s={8.9}>•</T><T x={105} y={746} s={8.9} b>Please Tick the Appropriate Option:-</T>
    <Tick k="transferStatus" option="Digital transfer approved" x={91} y={758} size={6} />
    <T x={114} y={756} w={428} s={8.9} align="justify">The KYC details of the above member in the UAN database have been approved with Digital Signature Certificate and</T>
    <T x={114} y={765.5} s={8.9}>transfer request has been generated on portal.</T>
    <Tick k="transferStatus" option="Physical transfer claim informed" x={91} y={777.5} size={6} />
    <T x={114} y={775.5} w={428} s={8.9} align="justify">As the DSC of establishment are not registered with EPFO, the member has been informed to file physical claim (Form-</T>
    <T x={114} y={785} s={8.9}>13) for transfer of funds from his previous establishment.</T>
    <T x={84} y={811.5} w={140} s={8.9}>Date:&nbsp;<Blank k="employerDate" s={8.9} line="none" font={A} label="Employer declaration date" /></T>
    <T x={365} y={809.5} s={8.9}>Signature of Employer with Seal of Establishment</T>
  </Sheet>;
}
