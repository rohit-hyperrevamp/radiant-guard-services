# Case Desk upgrade for the Legal team

## 1. Court history and reference numbers (per case)
- New "Court history" section on each case: every row stores court, reference / case number, state, from-date, and a note (e.g. "Transferred from Civil Court Pune").
- The first row is the original filing. Shifting the case to another court adds a new row; earlier rows stay as history.
- The case card shows the current court and reference number. Older ones show as a timeline.
- Hearings link to the court that was current at the time. The next-hearing date and outcome still update together, as they do now.

## 2. Court master (all of India)
- A searchable list of court types: Supreme Court; High Courts and their benches; District and Sessions Courts; Civil Courts (Senior and Junior Division); JMFC and CJM; Family; Labour and Industrial; Consumer Commissions (District, State and National); NCLT and NCLAT; DRT and DRAT; Motor Accident Claims Tribunal; Commissioners for PF, ESIC and Labour; Tax Tribunals; and others.
- Courts are grouped by state and city. Maharashtra and Pune come pre-filled in detail (Shivajinagar District Court, Pune Labour Court, Industrial Court, and so on).
- If a court is missing, the team can type it in. It is saved for future use and managed in Control Center.

## 3. Client or party: picked from our list or typed in
- The client field searches our organisations and units. You can also type a name that isn't in our system.
- A typed name is saved as a new "party" and shows up in later searches.
- **State:** picking one of our clients fills the state automatically. For outside parties, you choose the state yourself.

## 4. Advocates (our own and outside retainers)
- An advocate register stores name (the only required field), phone, email, firm, Bar Council number, type (in-house or retainer), and the date they were engaged.
- Each case gets a "Filed by / Advocate" field. Changing the advocate is logged, so we keep a record of who handled the case and when.
- New names typed into a case are saved to the register.

## 5. Representative
- Choose any team member or Field Officer from our staff. Their phone, designation and unit are shown.
- This can be set on new and existing cases.

## 6. Legal notices
- A new "Legal Notices" tab where you create, edit, save, and download the notice as a PDF.
- Pick a client from our system to fill in name, address, GSTIN and contact automatically, or type everything by hand.
- Templates follow the standard Indian notice format: advocate letterhead, Ref No., date, mode of delivery (RPAD, Speed Post or Email), To/From, Subject, numbered paragraphs, demand with a deadline, and signature. Templates included: payment recovery, breach of contract, employee absconding or misconduct, cheque bounce (Sec 138 NI Act), and a general notice.
- A notice can be linked to a case. It keeps its status: Draft, Sent, Replied, or Closed.

## 7. Party History
- Search any client or party name and see every case and notice involving them: open and closed cases, outcomes, amounts, and dates.

## 8. Employee Summary
- On any case with an employee, or through a search box, open a single summary page showing:
  - joining and exit dates, and total time with us
  - primary unit and every unit they worked at
  - designation and current salary structure from the contract
  - their Field Officer and that officer's phone
  - their last few payslips

## 9. Access
- Each new section (Court history, Notices, Advocates, Party History, Employee Summary) gets its own switch in Access Control under the Case Desk module.
- They are on by default for the Legal team, Leadership, and Super Admin, and off for everyone else. You can switch them on for anyone.

## 10. New legal users
- **Advocate Prajakta Tambare:** phone 7757931624, designation Advocate.
- **Anuja Gule:** phone 7984690077, designation Legal Executive.
- Both are set up with the same role, department, and Access Control permissions as Sanyam Shah, and can sign in with phone OTP.
- **Note:** Sanyam's role is currently "admin". If you want them limited to legal access only, tell me and I'll give them the Legal role instead.

## Technical details
- New tables: `legal_courts`, `legal_case_courts`, `legal_parties`, `legal_advocates`, `legal_case_advocate_log`, `legal_notices`. Each is covered by RLS through `current_user_module_access('legal_cases', …)` plus sub-module keys, and has a `zz_audit` trigger.
- New columns on `legal_cases`: `party_id`, `party_name`, `state`, `advocate_id`, `representative_id`. Existing court and reference data gets backfilled into `legal_case_courts`.
- Notice PDFs are made with jsPDF in the browser, and attachments go in the `legal-docs` bucket.
- The employee summary reads `candidates`, `candidate_units`, `contract_resources` and `payroll_run_snapshots` through a security-definer RPC that checks `legal_cases::employee_summary`.
- Changes are applied as migrations in `db/prod-migrations` against production only.
