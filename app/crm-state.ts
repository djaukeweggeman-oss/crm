export type DeletableInvoice = {
  id: number;
  number: string;
  customer: string;
  total: number;
};

export type InvoiceStockMovement = {
  id: number;
  date: string;
  type: "inkoop" | "afboeking";
  quantity: number;
  reason?: string;
  sourceInvoiceId?: number;
};

export type InvoiceProduct = {
  id: number;
  stock: number;
  stockHistory?: InvoiceStockMovement[];
};

export type InvoiceCustomer = {
  id: number;
  company: string;
  revenue: number;
  purchases: number;
};

export function isValidDateValue(value?: string | null) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

export function formatDateNL(value?: string | null) {
  if (!isValidDateValue(value)) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value as string));
}

export function prepareInvoiceDeletion<
  TInvoice extends DeletableInvoice,
  TProduct extends InvoiceProduct,
  TCustomer extends InvoiceCustomer,
>(invoice: TInvoice, invoices: TInvoice[], products: TProduct[], customers: TCustomer[]) {
  const saleReason = `Verkoop ${invoice.number}`;
  const remainingInvoices = invoices.filter((item) => item.id !== invoice.id);
  const restoredProducts = products.map((product) => {
    const history = Array.isArray(product.stockHistory) ? product.stockHistory : [];
    const linkedMovements = history.filter(
      (movement) =>
        movement.type === "afboeking" &&
        (movement.sourceInvoiceId === invoice.id || movement.reason === saleReason),
    );
    if (!linkedMovements.length) return product;
    const restoredQuantity = linkedMovements.reduce(
      (sum, movement) => sum + Math.max(0, Number(movement.quantity) || 0),
      0,
    );
    return {
      ...product,
      stock: product.stock === 999 ? product.stock : product.stock + restoredQuantity,
      stockHistory: history.filter(
        (movement) =>
          movement.sourceInvoiceId !== invoice.id && movement.reason !== saleReason,
      ),
    };
  });
  const restoredCustomers = customers.map((customer) =>
    customer.company === invoice.customer
      ? {
          ...customer,
          revenue: Math.max(0, (Number(customer.revenue) || 0) - (Number(invoice.total) || 0)),
          purchases: Math.max(0, (Number(customer.purchases) || 0) - 1),
        }
      : customer,
  );

  return { remainingInvoices, restoredProducts, restoredCustomers };
}
