import { strict as assert } from "node:assert";
import { documentNames, documentPath } from "./named-documents";

for (const [title, filename] of [
  ["Court notice", "notice.pdf"],
  ["Completion / signed proof", "signed.jpg"],
  ["Hearing -- order", "order--final.pdf"],
]) {
  const path = documentPath("case-id", title, filename);
  assert.equal(path.split("/").length, 2);
  assert.deepEqual(documentNames(path), { title, filename });
}
assert.deepEqual(documentNames("task-id/1720000000000-original.pdf"), {
  title: "original.pdf",
  filename: "original.pdf",
});
console.log("Custom names and original filenames round-trip; legacy attachments remain readable.");
