import PDFDocument from 'pdfkit';

export interface ReceiptData {
  orderId: string;
  title: string;
  amount: string; // e.g. "USD 14.00"
  method: string;
  reference?: string | null;
  dateText: string;
  kindLabel: string; // "Purchase" | "Top-up"
}

/** Render a simple, branded PDF receipt and return it as a Buffer. */
export function buildReceiptPdf(d: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const teal = '#0d9488';
    const grey = '#71717a';

    // Header
    doc
      .fillColor(teal)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('GlobalSimify');
    doc
      .fillColor(grey)
      .fontSize(10)
      .font('Helvetica')
      .text('Travel eSIMs - stay connected abroad');
    doc.moveDown(1.5);

    doc
      .fillColor('#111827')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Payment receipt');
    doc.moveDown(0.5);

    const rows: Array<[string, string]> = [
      [d.kindLabel, d.title],
      ['Amount paid', d.amount],
      ['Payment method', d.method],
      ...(d.reference
        ? ([['Reference', d.reference]] as Array<[string, string]>)
        : []),
      ['Date', d.dateText],
      ['Order ID', d.orderId],
    ];

    doc.fontSize(11);
    for (const [label, value] of rows) {
      const y = doc.y;
      doc.fillColor(grey).font('Helvetica').text(label, 56, y, { width: 160 });
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text(value, 220, y, { width: 320 });
      doc.moveDown(0.6);
    }

    doc.moveDown(1.5);
    doc
      .fillColor(grey)
      .fontSize(9)
      .font('Helvetica')
      .text(
        'Thank you for your purchase. New eSIMs are delivered separately by email and in your account after provisioning. Top-ups update your existing eSIM; no new QR is needed. Help: globalsimify.com/help',
        { width: 460 },
      );

    doc.end();
  });
}
