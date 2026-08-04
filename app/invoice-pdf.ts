import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type InvoicePdfData = {
  number: string;
  date: string;
  due: string;
  customer: { company: string; contact?: string; email?: string; city?: string };
  lines: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  total: number;
};

const money = (amount: number) => `EUR ${amount.toFixed(2).replace(".", ",")}`;

function wrap(text: string, maxCharacters: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines;
}

export async function createInvoicePdf(data: InvoicePdfData) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.04, 0.38, 0.32);
  const ink = rgb(0.08, 0.13, 0.11);
  const muted = rgb(0.39, 0.46, 0.43);
  const line = rgb(0.84, 0.88, 0.86);
  const pale = rgb(0.94, 0.97, 0.96);
  const left = 52;
  const right = 543;

  page.drawRectangle({ x: 0, y: 780, width: 595.28, height: 62, color: green });
  page.drawText("N", { x: left, y: 800, size: 24, font: bold, color: rgb(1, 1, 1) });
  page.drawText("NFC ADMINISTRATIE", { x: 88, y: 807, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Factuur", { x: 448, y: 802, size: 24, font: bold, color: rgb(1, 1, 1) });

  page.drawText("FACTUUR AAN", { x: left, y: 735, size: 8, font: bold, color: green });
  page.drawText(data.customer.company, { x: left, y: 715, size: 12, font: bold, color: ink });
  let customerY = 699;
  for (const value of [data.customer.contact, data.customer.city, data.customer.email].filter(Boolean) as string[]) {
    page.drawText(value, { x: left, y: customerY, size: 9, font: regular, color: muted });
    customerY -= 14;
  }

  const metaX = 350;
  [["Factuurnummer", data.number], ["Factuurdatum", data.date], ["Vervaldatum", data.due]].forEach(([label, value], index) => {
    const y = 735 - index * 24;
    page.drawText(label, { x: metaX, y, size: 8, font: bold, color: muted });
    page.drawText(value, { x: 440, y, size: 9, font: regular, color: ink });
  });

  const tableTop = 625;
  page.drawRectangle({ x: left, y: tableTop, width: right - left, height: 28, color: pale });
  page.drawText("OMSCHRIJVING", { x: left + 10, y: tableTop + 10, size: 8, font: bold, color: green });
  page.drawText("AANTAL", { x: 377, y: tableTop + 10, size: 8, font: bold, color: green });
  page.drawText("PRIJS", { x: 432, y: tableTop + 10, size: 8, font: bold, color: green });
  page.drawText("TOTAAL", { x: 500, y: tableTop + 10, size: 8, font: bold, color: green });

  let rowY = tableTop - 24;
  for (const item of data.lines) {
    const descriptionLines = wrap(item.description, 52).slice(0, 3);
    descriptionLines.forEach((text, index) => page.drawText(text, { x: left + 10, y: rowY - index * 12, size: 9, font: index === 0 ? bold : regular, color: ink }));
    page.drawText(String(item.quantity), { x: 388, y: rowY, size: 9, font: regular, color: ink });
    page.drawText(money(item.unitPrice), { x: 425, y: rowY, size: 9, font: regular, color: ink });
    page.drawText(money(item.total), { x: 493, y: rowY, size: 9, font: bold, color: ink });
    rowY -= Math.max(42, descriptionLines.length * 14 + 14);
    page.drawLine({ start: { x: left, y: rowY + 12 }, end: { x: right, y: rowY + 12 }, thickness: 0.7, color: line });
  }

  const totalY = Math.max(250, rowY - 20);
  page.drawText("TOTAAL", { x: 397, y: totalY, size: 10, font: bold, color: ink });
  page.drawText(money(data.total), { x: 485, y: totalY, size: 12, font: bold, color: green });
  page.drawLine({ start: { x: 390, y: totalY - 8 }, end: { x: right, y: totalY - 8 }, thickness: 1.4, color: green });

  page.drawRectangle({ x: left, y: 105, width: right - left, height: 82, color: pale });
  page.drawText("BETAALINFORMATIE", { x: left + 14, y: 165, size: 8, font: bold, color: green });
  page.drawText(`Betaal uiterlijk op ${data.due} onder vermelding van ${data.number}.`, { x: left + 14, y: 145, size: 9, font: regular, color: ink });
  page.drawText("Bedankt voor je aankoop.", { x: left + 14, y: 126, size: 9, font: regular, color: muted });
  page.drawText("NFC Administratie", { x: left, y: 55, size: 9, font: bold, color: green });
  page.drawText("Dit document is automatisch en uniform gegenereerd.", { x: 350, y: 55, size: 7, font: regular, color: muted });

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function downloadInvoicePdf(blob: Blob, number: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${number}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
