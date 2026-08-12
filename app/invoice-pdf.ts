import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type InvoicePdfData = {
  number: string;
  date: string;
  due: string;
  deliveryDate: string;
  customer: { company: string; contact?: string; email?: string; address: string };
  lines: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  total: number;
  subtotal?: number;
  vatAmount?: number;
  vatRate?: number;
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
  const green = rgb(0.04, 0.20, 0.29);
  const accent = rgb(0.05, 0.58, 0.67);
  const ink = rgb(0.08, 0.13, 0.11);
  const muted = rgb(0.39, 0.46, 0.43);
  const line = rgb(0.84, 0.88, 0.86);
  const pale = rgb(0.93, 0.97, 0.98);
  const left = 52;
  const right = 543;
  const drawAmountRight = (value: string, y: number, size: number, font: typeof regular, color = ink) => {
    page.drawText(value, { x: right - font.widthOfTextAtSize(value, size), y, size, font, color });
  };

  page.drawRectangle({ x: 0, y: 780, width: 595.28, height: 62, color: green });
  page.drawRectangle({ x: left, y: 795, width: 32, height: 32, color: accent });
  page.drawText("W", { x: left + 6, y: 803, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("WGMN DIGITAL", { x: 94, y: 807, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Factuur", { x: 448, y: 802, size: 24, font: bold, color: rgb(1, 1, 1) });

  page.drawText("FACTUUR AAN", { x: left, y: 735, size: 8, font: bold, color: green });
  page.drawText(data.customer.company, { x: left, y: 715, size: 12, font: bold, color: ink });
  let customerY = 699;
  for (const value of [data.customer.contact, ...data.customer.address.split("\n"), data.customer.email].filter(Boolean) as string[]) {
    page.drawText(value, { x: left, y: customerY, size: 9, font: regular, color: muted });
    customerY -= 14;
  }

  const metaX = 350;
  [["Factuurnummer", data.number], ["Factuurdatum", data.date], ["Leverdatum", data.deliveryDate], ["Vervaldatum", data.due]].forEach(([label, value], index) => {
    const y = 735 - index * 24;
    page.drawText(label, { x: metaX, y, size: 8, font: bold, color: muted });
    page.drawText(value, { x: 440, y, size: 9, font: regular, color: ink });
  });

  const tableTop = 625;
  page.drawRectangle({ x: left, y: tableTop, width: right - left, height: 28, color: pale });
  page.drawText("OMSCHRIJVING", { x: left + 10, y: tableTop + 10, size: 8, font: bold, color: green });
  page.drawText("AANTAL", { x: 377, y: tableTop + 10, size: 8, font: bold, color: green });
  page.drawText("PRIJS EXCL.", { x: 422, y: tableTop + 10, size: 8, font: bold, color: green });
  page.drawText("TOTAAL", { x: 500, y: tableTop + 10, size: 8, font: bold, color: green });

  let rowY = tableTop - 24;
  for (const item of data.lines) {
    const descriptionLines = wrap(item.description, 52).slice(0, 3);
    descriptionLines.forEach((text, index) => page.drawText(text, { x: left + 10, y: rowY - index * 12, size: 9, font: index === 0 ? bold : regular, color: ink }));
    page.drawText(String(item.quantity), { x: 388, y: rowY, size: 9, font: regular, color: ink });
    const unitPriceExVat = item.unitPrice / (1 + (data.vatRate ?? 21) / 100);
    const totalExVat = item.total / (1 + (data.vatRate ?? 21) / 100);
    page.drawText(money(unitPriceExVat), { x: 425, y: rowY, size: 9, font: regular, color: ink });
    drawAmountRight(money(totalExVat), rowY, 9, bold);
    rowY -= Math.max(42, descriptionLines.length * 14 + 14);
    page.drawLine({ start: { x: left, y: rowY + 12 }, end: { x: right, y: rowY + 12 }, thickness: 0.7, color: line });
  }

  const vatRate = data.vatRate ?? 21;
  const subtotal = data.subtotal ?? Math.round((data.total / (1 + vatRate / 100)) * 100) / 100;
  const vatAmount = data.vatAmount ?? Math.round((data.total - subtotal) * 100) / 100;
  const totalY = Math.max(250, rowY - 20);
  page.drawText("Subtotaal excl. btw", { x: 390, y: totalY + 34, size: 9, font: regular, color: muted });
  drawAmountRight(money(subtotal), totalY + 34, 9, regular);
  page.drawText(`Btw ${vatRate}%`, { x: 390, y: totalY + 15, size: 9, font: regular, color: muted });
  drawAmountRight(money(vatAmount), totalY + 15, 9, regular);
  page.drawText("Totaal incl. btw", { x: 390, y: totalY - 8, size: 10, font: bold, color: ink });
  drawAmountRight(money(data.total), totalY - 8, 12, bold, accent);
  page.drawLine({ start: { x: 390, y: totalY - 17 }, end: { x: right, y: totalY - 17 }, thickness: 1.4, color: accent });

  page.drawRectangle({ x: left, y: 105, width: right - left, height: 82, color: pale });
  page.drawText("BETAALINFORMATIE", { x: left + 14, y: 165, size: 8, font: bold, color: green });
  page.drawText(`Betaal uiterlijk op ${data.due} onder vermelding van ${data.number}.`, { x: left + 14, y: 145, size: 9, font: regular, color: ink });
  page.drawText("Bedankt voor je aankoop.", { x: left + 14, y: 126, size: 9, font: regular, color: muted });
  page.drawText("WGMN Digital", { x: left, y: 55, size: 9, font: bold, color: green });
  page.drawText("Zwaanstraat 26 · 6921 WN Duiven", { x: left, y: 42, size: 8, font: regular, color: muted });
  page.drawText("BTW-id NL004677786B36 · KVK 88955125", { x: left, y: 29, size: 8, font: regular, color: muted });
  page.drawText("Digitale oplossingen, professioneel geleverd.", { x: 365, y: 55, size: 7, font: regular, color: muted });

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
