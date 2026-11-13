import logo from "@/assets/compliance/esic-logo.png";
import { Blank, FONT, Rect, Sheet, T, VLine, useForm } from "./form-kit";

const H = FONT.hindi, E = FONT.arial;
const L = 123, R = 466, W = R - L;
const h = (t: string) => <span style={{ fontFamily: H }}>{t}</span>;

/** ESIC-MED 7A / ESIC-MED 37 — replica of the supplied one-page form. */
export function Esic37Form() {
  return <Sheet w={612} h={792} font={E}>
    {/* ESIC-MED 7A */}
    <T x={216} y={51} s={10.6} b font={H}>चिकित्सा की स्वीकृति के लिए प्रार्थना-पत्र</T>
    <T x={409} y={52} s={9.4} font={H}>एसिक &nbsp; मेडि-7ए</T>
    <T x={198} y={67.5} s={8.9}>Application for acceptance for medical treatment</T>
    <T x={409} y={67.5} s={8.9}>ESIC-MED 7A</T>
    <T x={L} y={86} w={W} s={9.4} align="right" font={H}>पीठ पृष्ठ पर दिए हुए नियोजन के &nbsp;प्रमाण-पत्र के संदर्भ में चिकित्सक................................</T>
    <T x={L} y={98.5} w={W} s={9.4} align="justify" font={H}>..........................द्वारा स्वीकृति के लिए निवेदन करता हूं कि जिनके साथ मैं पहले ही पंजीकृत था।</T>
    <T x={L} y={113} w={W} s={8.9} align="right">With reference to certificate of employment on the reverse I apply for acceptance</T>
    <T x={L} y={125} w={W} s={8.9}>by Dr.<Blank k="doctor" s={8.9} label="Registered doctor" /> with whom I was already registered.</T>
    <T x={L} y={152.5} w={100} s={9.4} font={H}>दिनांक<Blank k="medicalDate" s={8.9} label="Medical application date" /></T>
    <T x={288} y={152.5} s={9.4} font={H}>बीमांकित व्यक्ति के हस्ताक्षर या अंगूठे का निशान</T>
    <T x={L} y={164.5} s={8.9}>Dated</T>
    <T x={262} y={164.5} w={210} s={8.9} align="center">Signature or Thumb impression of the</T>
    <T x={262} y={176.5} w={210} s={8.9} align="center">insured person</T>
    <T x={L} y={201.5} w={W} s={9.4} align="center" font={H}>मैं इस व्यक्ति जिसका ब्यौरा पीछे दिया गया है कि अपनी सूची में सम्मिलित करना स्वीकार करता हूं।</T>
    <T x={L} y={213.5} w={W} s={8.9} align="center">I accept the person whose particulars are given on reverse on my list.</T>
    <T x={L} y={251} s={9.4} font={H}>दिनांक....................................</T>
    <T x={320} y={251} s={9.4} font={H}>चिकित्सक के हस्ताक्षर तथा कूट संख्या</T>
    <T x={L} y={263} s={8.9}>Dated</T>
    <T x={300} y={263} w={162} s={8.9} align="center">Signature and Code No.</T>
    <T x={300} y={276} w={162} s={8.9} align="center">of the Doctor</T>

    {/* ESIC-MED 37 */}
    <img src={logo} alt="ESIC" style={{ position: "absolute", left: "123pt", top: "363pt", width: "29pt", height: "29pt" }} />
    <T x={L} y={365} w={343} s={10.6} b font={H} align="center"><span>कर्मचारी राज्य बीमा निगम</span></T>
    <T x={409} y={366} s={9.4} font={H}>एसिक &nbsp; मेडि-37</T>
    <T x={187} y={379.5} s={9.15} b>EMPLOYEES’ STATE INSURANCE CORPORATION</T>
    <T x={409} y={379.5} s={8.9}>ESIC-MED 37</T>
    <T x={L} y={393} w={W} s={10.2} align="center" font={H}><span>पुनर्नियोजन/निरन्तर नियोजन का प्रमाण पत्र</span></T>
    <T x={L} y={407} w={W} s={8.9} align="center"><span>Certificate of Re-employment, continuing Employment.</span></T>
    <T x={L} y={420} w={W} s={10.2} align="center" font={H}><span>(तब जारी किया जाये जब कि निम्नलिखित शर्त) <span style={{ fontFamily: E }}>(i)</span> और <span style={{ fontFamily: E }}>(ii)</span> की संतुष्टि हो)</span></T>
    <T x={L} y={434} w={W} s={8.9} align="center"><span>(To be issued only if condition (i) or (ii) below are satisfied)</span></T>
    <T x={146} y={451} w={314} s={9.4} font={H}>नियोजक का नाम और पता<Blank k="employerName" s={8.9} label="Employer name" /><span>, </span><Blank k="employerAddress" s={8.9} label="Employer address" /></T>
    <T x={L} y={461.5} s={8.9}>Name &amp; Address of the Employer.</T>
    <T x={L} y={475} s={9.4}>{h("......................कूट संख्या/")}Code No.</T>
    <Rect x={292} y={463.5} w={153} h={21.5} />
    <VLine x={325} y1={463.5} y2={485} t={0.75} />
    <VLine x={413.5} y1={463.5} y2={485} t={0.75} />
    <EsicCode />
    <T x={L} y={488.5} w={W} s={8.9}>{h("प्रमाणित किया जाता है कि श्री ")}Certified that Shri<Blank k="name" s={8.9} label="Employee name" /></T>
    <T x={L} y={502} w={W} s={8.9}>{h("पुत्र श्री ")}S/o<Blank k="father" s={8.9} label="Father’s name" />{h("बीमांक ")}Ins. No<Blank k="esic" w={62} s={8.9} label="Insurance number" /></T>
    <T x={L} y={513.5} w={W} s={7.9}>(i) has continued to be in employment/re-entered insurable employment on<Blank k="employmentDate" w={86} s={7.9} label="Employment / re-entry date" /></T>
    <T x={L} y={522.5} w={W} s={7.9} align="justify">and contrbution have been payable/paid in respect of him/her during the contribution period which</T>
    <T x={L} y={531.5} s={7.9}>began on<Blank k="periodStart" w={72} s={7.9} label="Contribution period began" /></T>
    <T x={L} y={542} w={W} s={7.9} align="justify">(ii) has paid contributions for seventy eight days in the preceding contribution period which ended</T>
    <T x={L} y={551} s={7.9}>on<Blank k="periodEnd" w={84} s={7.9} label="Contribution period ended" /></T>
    <T x={L} y={562} s={8.9}>{h("दिनांक ")}Date<Blank k="date" w={102} s={8.9} label="Certificate date" /></T>
    <T x={300} y={562} w={166} s={8.9} align="right">{h("हस्ताक्षर और पद ")}&nbsp;Signature &amp; Designation</T>
    <T x={L} y={575} s={10.2} font={H}>टिप्पणी - यह प्रमाण-पत्र उपर्युक्त <span style={{ fontFamily: E }}>(i)</span> और <span style={{ fontFamily: E }}>(ii)</span> में अंकित तिथि से 9 मास के लिये वैध है।</T>
    <T x={L} y={589} s={7.6}>Note :- This certificate is valid for 9 months from the dates indicated under (i) or (ii) above.</T>
  </Sheet>;
}

/** Employer code written into the three printed compartments (2 | middle | last 4). */
function EsicCode() {
  return <>
    <CodePart from={0} to={2} x={293} w={31} />
    <CodePart from={2} to={-4} x={326} w={86.5} />
    <CodePart from={-4} to={undefined} x={414.5} w={29.5} />
  </>;
}
function CodePart({ from, to, x, w }: { from: number; to: number | undefined; x: number; w: number }) {
  const { values, set } = useForm();
  const raw = (values.employerEsic ?? "").replace(/[^0-9A-Za-z]/g, "");
  const parts = [raw.slice(0, 2), raw.slice(2, Math.max(2, raw.length - 4)), raw.length > 6 ? raw.slice(-4) : ""];
  const idx = from === 0 ? 0 : to === -4 ? 1 : 2;
  return <input className="stat-field" aria-label="Employer ESIC code" value={parts[idx]} onChange={e => { const p = [...parts]; p[idx] = e.target.value.replace(/\s/g, ""); set("employerEsic", p.join("")); }}
    style={{ position: "absolute", left: `${x}pt`, top: "465pt", width: `${w}pt`, height: "18.5pt", fontSize: "9pt", textAlign: "center", fontFamily: E, letterSpacing: "0.5pt" }} />;
}
