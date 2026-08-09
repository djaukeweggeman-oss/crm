import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDateNL,
  isValidDateValue,
  prepareInvoiceDeletion,
} from "../app/crm-state.ts";

test("removes a sales invoice and reverses only its related stock and customer totals", () => {
  const deleted = { id: 10, number: "FAC-2026-0001", customer: "Klant A", total: 50 };
  const kept = { id: 11, number: "FAC-2026-0002", customer: "Klant A", total: 25 };
  const result = prepareInvoiceDeletion(
    deleted,
    [deleted, kept],
    [{
      id: 1,
      stock: 8,
      stockHistory: [
        { id: 1, date: "2026-08-07", type: "afboeking", quantity: 2, sourceInvoiceId: 10 },
        { id: 2, date: "2026-08-07", type: "afboeking", quantity: 1, sourceInvoiceId: 11 },
      ],
    }],
    [{ id: 1, company: "Klant A", revenue: 75, purchases: 2 }],
  );

  assert.deepEqual(result.remainingInvoices.map((invoice) => invoice.id), [11]);
  assert.equal(result.restoredProducts[0].stock, 10);
  assert.deepEqual(result.restoredProducts[0].stockHistory?.map((movement) => movement.id), [2]);
  assert.equal(result.restoredCustomers[0].revenue, 25);
  assert.equal(result.restoredCustomers[0].purchases, 1);
});

test("supports older sales that were linked by reason instead of sourceInvoiceId", () => {
  const invoice = { id: 10, number: "FAC-2026-0001", customer: "Klant A", total: 50 };
  const result = prepareInvoiceDeletion(
    invoice,
    [invoice],
    [{ id: 1, stock: 8, stockHistory: [{ id: 1, date: "2026-08-07", type: "afboeking", quantity: 2, reason: "Verkoop FAC-2026-0001" }] }],
    [],
  );

  assert.equal(result.restoredProducts[0].stock, 10);
  assert.deepEqual(result.restoredProducts[0].stockHistory, []);
});

test("invalid or missing follow-up dates never crash the sales page formatter", () => {
  assert.equal(isValidDateValue(""), false);
  assert.equal(isValidDateValue("geen-datum"), false);
  assert.equal(formatDateNL(""), "—");
  assert.equal(formatDateNL("geen-datum"), "—");
  assert.equal(isValidDateValue("2026-08-07"), true);
});
