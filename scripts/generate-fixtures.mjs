import { mkdir, open, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = join(scriptDirectory, "..", "tests", "fixtures");
const generatedDirectory = join(fixtureDirectory, "generated");
await mkdir(fixtureDirectory, { recursive: true });
await mkdir(generatedDirectory, { recursive: true });

const fixedDate = new Date("2026-01-01T00:00:00.000Z");
function setDeterministicDates(pdfDocument) {
  pdfDocument.setCreationDate(fixedDate);
  pdfDocument.setModificationDate(fixedDate);
}

const document = await PDFDocument.create();
setDeterministicDates(document);
document.setTitle("Purpose-built PDF editor spike fixture");
document.setProducer("Privacy PDF Editor technical spike");
const font = await document.embedFont(StandardFonts.Helvetica);

const letter = document.addPage([612, 792]);
letter.drawText("Letter portrait — replace this text", {
  x: 72,
  y: 700,
  size: 18,
  font,
  color: rgb(0.1, 0.15, 0.25),
});
letter.drawRectangle({
  x: 72,
  y: 620,
  width: 220,
  height: 36,
  borderWidth: 1,
  borderColor: rgb(0.2, 0.3, 0.5),
});

const landscape = document.addPage([842, 595]);
landscape.drawText("A4-style landscape page", {
  x: 60,
  y: 520,
  size: 18,
  font,
});

const rotated = document.addPage([612, 792]);
rotated.setRotation(degrees(90));
rotated.drawText("Intrinsically rotated page", {
  x: 72,
  y: 700,
  size: 18,
  font,
});

const cropped = document.addPage([700, 900]);
cropped.setCropBox(40, 80, 560, 720);
cropped.drawText("Offset crop box page", {
  x: 70,
  y: 740,
  size: 18,
  font,
});

const bytes = await document.save();
await writeFile(join(fixtureDirectory, "representative.pdf"), bytes);
await writeFile(
  join(fixtureDirectory, "malformed.pdf"),
  new TextEncoder().encode("%PDF-1.7\nThis is intentionally malformed."),
);

const features = await PDFDocument.create();
setDeterministicDates(features);
features.setTitle("Feature preservation fixture");
features.setAuthor("Purpose-built test fixture");
features.setSubject("AcroForm, metadata, attachment, and annotation coverage");
features.setKeywords(["privacy", "pdf", "fixture"]);
const featureFont = await features.embedFont(StandardFonts.Helvetica);
const featurePage = features.addPage([612, 792]);
featurePage.drawText("Feature preservation fixture", {
  x: 50,
  y: 740,
  size: 20,
  font: featureFont,
});
const form = features.getForm();
const nameField = form.createTextField("profile.name");
nameField.setText("Original Name");
nameField.addToPage(featurePage, {
  x: 50,
  y: 650,
  width: 240,
  height: 28,
  borderWidth: 1,
});
const consentField = form.createCheckBox("profile.consent");
consentField.check();
consentField.addToPage(featurePage, {
  x: 50,
  y: 600,
  width: 18,
  height: 18,
  borderWidth: 1,
});
const roleField = form.createDropdown("profile.role");
roleField.addOptions(["Student", "Freelancer", "Office worker"]);
roleField.select("Freelancer");
roleField.addToPage(featurePage, {
  x: 50,
  y: 540,
  width: 180,
  height: 28,
  borderWidth: 1,
});
await features.attach(new TextEncoder().encode("PRIVATE-FIXTURE-ATTACHMENT"), "fixture.txt", {
  mimeType: "text/plain",
  description: "Purpose-built attachment",
});
const featureBytes = await features.save();
await writeFile(join(fixtureDirectory, "features.pdf"), featureBytes);

const coordinateDocument = await PDFDocument.create();
setDeterministicDates(coordinateDocument);
const coordinatePortrait = coordinateDocument.addPage([300, 300]);
coordinatePortrait.drawRectangle({
  x: 0,
  y: 0,
  width: 300,
  height: 300,
  color: rgb(0.45, 0.45, 0.45),
});
const coordinateRotated = coordinateDocument.addPage([300, 400]);
coordinateRotated.setRotation(degrees(90));
coordinateRotated.drawRectangle({
  x: 0,
  y: 0,
  width: 300,
  height: 400,
  color: rgb(0.45, 0.45, 0.45),
});
const coordinateBytes = await coordinateDocument.save();
await writeFile(
  join(fixtureDirectory, "coordinate-gray.pdf"),
  coordinateBytes,
);

const pageBoundary = await PDFDocument.create();
setDeterministicDates(pageBoundary);
for (let index = 0; index < 501; index += 1) {
  pageBoundary.addPage([200, 200]);
}
const pageBoundaryBytes = await pageBoundary.save();
await writeFile(
  join(generatedDirectory, "page-boundary-501.pdf"),
  pageBoundaryBytes,
);

const oversizedPage = await PDFDocument.create();
setDeterministicDates(oversizedPage);
oversizedPage.addPage([20_000, 20_000]);
const oversizedPageBytes = await oversizedPage.save();
await writeFile(
  join(generatedDirectory, "oversized-page.pdf"),
  oversizedPageBytes,
);
const overLimitPath = join(generatedDirectory, "over-100mb.pdf");
const overLimitHandle = await open(overLimitPath, "w");
try {
  await overLimitHandle.truncate(100 * 1024 * 1024 + 1);
} finally {
  await overLimitHandle.close();
}

function deterministicBytes(byteLength) {
  const output = new Uint8Array(byteLength);
  let state = 0x6d2b79f5;
  for (let index = 0; index < output.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    output[index] = state & 0xff;
  }
  return output;
}

async function createPerformanceFixture(name, pageCount, attachmentMiB) {
  const performanceDocument = await PDFDocument.create();
  setDeterministicDates(performanceDocument);
  const performanceFont = await performanceDocument.embedFont(
    StandardFonts.Helvetica,
  );
  for (let index = 0; index < pageCount; index += 1) {
    const page = performanceDocument.addPage([612, 792]);
    page.drawText(`Performance fixture page ${index + 1} of ${pageCount}`, {
      x: 50,
      y: 730,
      size: 16,
      font: performanceFont,
    });
    for (let row = 0; row < 20; row += 1) {
      page.drawText(`Row ${row + 1}: deterministic vector content`, {
        x: 50,
        y: 680 - row * 28,
        size: 10,
        font: performanceFont,
      });
    }
  }
  await performanceDocument.attach(
    deterministicBytes(attachmentMiB * 1024 * 1024),
    `deterministic-${attachmentMiB}mib.bin`,
    { mimeType: "application/octet-stream" },
  );
  const performanceBytes = await performanceDocument.save({
    useObjectStreams: true,
  });
  await writeFile(join(generatedDirectory, name), performanceBytes);
  return performanceBytes.byteLength;
}

const mediumBytes = await createPerformanceFixture(
  "performance-25p-20m.pdf",
  25,
  20,
);
const largeBytes = await createPerformanceFixture(
  "performance-100p-50m.pdf",
  100,
  50,
);

const qpdfBinary = process.env.QPDF_BIN;
const derived = [];
if (qpdfBinary) {
  const representativePath = join(fixtureDirectory, "representative.pdf");
  const encryptedPath = join(generatedDirectory, "encrypted-aes256.pdf");
  const linearizedPath = join(generatedDirectory, "linearized.pdf");
  const commands = [
    {
      args: [
        "--encrypt",
        "userpass",
        "ownerpass",
        "256",
        "--modify=none",
        "--",
        representativePath,
        encryptedPath,
      ],
      name: "encrypted-aes256.pdf",
    },
    {
      args: ["--linearize", representativePath, linearizedPath],
      name: "linearized.pdf",
    },
  ];
  for (const command of commands) {
    const result = spawnSync(qpdfBinary, command.args, {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(
        `QPDF failed for ${command.name}: ${result.stderr || result.stdout}`,
      );
    }
    derived.push(command.name);
  }
}

console.log(
  JSON.stringify(
    {
      fixtures: {
        "representative.pdf": {
          pages: 4,
          bytes: bytes.byteLength,
          cases: ["portrait", "landscape", "rotation-90", "offset-crop-box"],
        },
        "features.pdf": {
          pages: 1,
          bytes: featureBytes.byteLength,
          cases: ["AcroForm", "metadata", "attachment"],
        },
        "coordinate-gray.pdf": {
          pages: 2,
          bytes: coordinateBytes.byteLength,
          cases: ["raster-placement-0", "raster-placement-90"],
        },
        "page-boundary-501.pdf": {
          pages: 501,
          bytes: pageBoundaryBytes.byteLength,
        },
        "oversized-page.pdf": {
          pages: 1,
          bytes: oversizedPageBytes.byteLength,
          dimensions: [20000, 20000],
        },
        "over-100mb.pdf": {
          bytes: 100 * 1024 * 1024 + 1,
          expected: "rejected-before-parse",
        },
        "performance-25p-20m.pdf": {
          pages: 25,
          bytes: mediumBytes,
        },
        "performance-100p-50m.pdf": {
          pages: 100,
          bytes: largeBytes,
        },
      },
      qpdfDerived: derived,
    },
    null,
    2,
  ),
);
