import { Box, FONT, HLine, Sheet, T, VLine } from "./form-kit";

const F = FONT.cambria;
const cols = [44, 71, 113.5, 156, 253, 277.5, 317, 404, 490, 533, 575.5, 618, 661, 703.5, 799.5, 906.5, 998.5, 1112, 1162];
const rows = [162, 214.5, 300, 385.5, 471, 556.5, 642, 728];
const keys: [string, string][] = [["serial", "Sl. No."], ["noticeDate", "Date of notice"], ["noticeTime", "Time of notice"], ["injured", "Name and address of injured person"], ["gender", "Sex"], ["age", "Age"], ["esic", "Insurance No."], ["occupation", "Shift, department and occupation"], ["cause", "Cause of injury"], ["nature", "Nature of injury"], ["injuryDate", "Date of injury"], ["injuryTime", "Time of injury"], ["injuryPlace", "Place of injury"], ["activity", "What the injured person was doing"], ["notifier", "Person giving notice"], ["recorder", "Person making the entry"], ["witnesses", "Two witnesses"], ["remarks", "Remarks"]];
// Header text: column index, lines (top y).
const head: [number, [number, string][]][] = [
  [0, [[180.1, "Sl."], [190.4, "No."]]], [1, [[180.1, "Date of"], [190.4, "Notice"]]], [2, [[180.1, "Time of"], [190.4, "Notice"]]],
  [3, [[180.1, "Name and Address of"], [190.4, "Injured Person"]]], [4, [[185.4, "Sex"]]], [5, [[185.4, "Age"]]], [6, [[185.4, "Insurance No."]]],
  [7, [[174.8, "Shift, department"], [185.4, "and Occupation of"], [195.7, "the employee"]]],
  [8, [[197.4, "Cause"]]], [9, [[197.4, "Nature"]]], [10, [[197.4, "Date"]]], [11, [[197.4, "Time"]]], [12, [[197.4, "Place"]]],
  [13, [[174.8, "What exactly was the"], [185.4, "injured person doing at"], [195.7, "the time of accident"]]],
  [14, [[164.5, "Name, occupation,"], [174.8, "address and signature or"], [185.4, "the thumb impression of"], [195.7, "the person(s) giving"], [206, "notice"]]],
  [15, [[164.5, "Signature and"], [174.8, "designation of the"], [185.4, "person who makes the"], [195.7, "entry in the Accident"], [206, "Book"]]],
  [16, [[180.1, "Name, address and"], [190.4, "occupation of two witnesses"]]], [17, [[180.1, "Remarks,"], [190.4, "if any"]]],
];

/** ESIC Form 11 — Accident Book (Regulation 66), replica of the supplied landscape page. */
export function AccidentBookForm() {
  return <Sheet w={1191} h={842} font={F}>
    <T x={0} y={37} w={1204} s={19.6} align="center">EMPLOYEES' STATE INSURANCE CORPORATION</T>
    <T x={0} y={69} w={1204} s={23.5} align="center">FORM 11</T>
    <T x={0} y={103.5} w={1204} s={17.4} align="center">ACCIDENT BOOK</T>
    <T x={0} y={131.8} w={1207} s={12.2} i align="center">(Regulation 66)</T>
    {rows.map(y => <HLine key={y} x1={cols[0]} x2={cols[cols.length - 1]} y={y} t={0.6} />)}
    <HLine x1={cols[8]} x2={cols[13]} y={186.5} t={0.6} />
    {cols.map((x, i) => <VLine key={x} x={x} y1={i > 8 && i < 13 ? 186.5 : 162} y2={728} t={0.6} />)}
    <T x={cols[8]} y={170.4} w={cols[13] - cols[8]} s={10.2} font={FONT.times} align="center">Details of Injury</T>
    {head.map(([c, lines]) => lines.map(([y, t]) => <T key={`${c}-${y}`} x={cols[c]} y={y - 1} w={cols[c + 1] - cols[c]} s={9.3} font={FONT.times} align="center">{t}</T>))}
    {keys.map(([k, label], i) => <Box key={k} k={k} label={label} multi x={cols[i] + 2} y={rows[1] + 2} w={cols[i + 1] - cols[i] - 4} h={rows[2] - rows[1] - 4} s={8} font={F} />)}
    <T x={376.6} y={809.5} s={9.6} style={{ color: "#7f7f7f" }}>All Forms Available at : <span style={{ textDecoration: "underline" }}>www.patelconsultancy.in</span></T>
    <T x={697.7} y={809.5} s={9.6} style={{ color: "#7f7f7f" }}>SURAT ☎ (0261) 653136</T>
  </Sheet>;
}
