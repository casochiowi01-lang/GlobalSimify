import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface EsimInstallation {
  title: string;
  lpa: string;
  iccid: string;
  smdpAddress: string;
  matchingId: string;
}

/** Private installation document. Callers must authorize access before rendering. */
export async function buildEsimPdf(data: EsimInstallation): Promise<Buffer> {
  const qr = await QRCode.toBuffer(data.lpa, {
    width: 900,
    margin: 4,
    errorCorrectionLevel: 'M',
  });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: { Title: 'GlobalSimify eSIM installation', Author: 'GlobalSimify' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(22).text('GlobalSimify');
    doc.moveDown(0.3).fontSize(16).text('Your eSIM installation guide');
    doc
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(11)
      .text(data.title, { width: 499 });
    doc.moveDown(0.7);
    const y = doc.y;
    doc.image(qr, (doc.page.width - 210) / 2, y, { width: 210, height: 210 });
    doc.y = y + 220;
    doc
      .fontSize(10)
      .text(
        'Scan this QR code using Add eSIM in your phone settings.',
        48,
        doc.y,
        { width: 499, align: 'center' },
      );
    doc
      .moveDown(1)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Setting up on the same phone?', { align: 'left' });
    doc
      .moveDown(0.4)
      .font('Helvetica')
      .fontSize(10)
      .text(
        'Choose manual entry and use the details below. Some phones also support importing a saved QR image.',
      );
    for (const [label, value] of [
      ['SM-DP+ address', data.smdpAddress],
      ['Activation code', data.matchingId],
      ['ICCID', data.iccid],
    ]) {
      doc.moveDown(0.7).font('Helvetica-Bold').fontSize(10).text(label);
      doc.font('Courier').fontSize(10).text(value, { width: 499 });
    }
    doc
      .moveDown(1)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Before you connect');
    doc.moveDown(0.4).font('Helvetica').fontSize(10);
    for (const line of [
      '1. Use an unlocked, eSIM-compatible phone and a stable Wi-Fi connection.',
      '2. Open Settings > Mobile / Cellular > Add eSIM and scan or enter the details.',
      '3. At your destination, select this eSIM for mobile data and enable its data roaming. Keep roaming off on your home SIM to avoid home-network roaming charges.',
      '4. Your package follows the travel dates selected at checkout. Do not delete the installed eSIM; it may not be reusable after deletion.',
    ]) {
      doc.text(line, { width: 499 });
      doc.moveDown(0.4);
    }
    doc
      .moveDown(0.4)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        'Keep this document private. Anyone with this QR or activation code may be able to install your eSIM.',
      );
    doc
      .moveDown(0.7)
      .font('Helvetica')
      .fontSize(10)
      .text(
        'View your eSIMs: https://globalsimify.com/account/esims\nSign in with the email used at checkout. Help: https://globalsimify.com/help',
      );
    doc.end();
  });
}
