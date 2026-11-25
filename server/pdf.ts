import PDFDocument from 'pdfkit';
import type { Certificate } from '../src/types';

export function generateCertificatePdfBuffer(cert: Certificate): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const w = doc.page.width;
    const h = doc.page.height;
    const navy = '#0F2442';
    const accent = cert.accentColor && /^#[0-9A-Fa-f]{6}$/.test(cert.accentColor)
      ? cert.accentColor
      : '#0D9488';
    const slate = '#475569';
    const lightBg = '#F8FAFC';

    doc.rect(0, 0, w, h).fill(lightBg);

    // Outer frame
    doc.lineWidth(3).strokeColor(navy).rect(24, 24, w - 48, h - 48).stroke();
    doc.lineWidth(1).strokeColor(accent).rect(34, 34, w - 68, h - 68).stroke();

    // Top accent bar
    doc.rect(34, 34, w - 68, 10).fill(navy);
    doc.rect(34, 44, w - 68, 4).fill(accent);

    // Organization header
    doc
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(cert.organizationName || 'RxOrbit', 0, 76, { align: 'center' });

    doc
      .fillColor(accent)
      .font('Helvetica')
      .fontSize(10)
      .text('PHARMACY STUDENT EDUCATIONAL COMMUNITY  ·  CONNECT · DISCOVER · ADVANCE', 0, 104, {
        align: 'center',
      });

    // Title
    doc
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(32)
      .text(cert.templateTitle || 'Certificate of Participation', 0, 146, {
        align: 'center',
      });

    doc
      .fillColor(slate)
      .font('Helvetica')
      .fontSize(13)
      .text(cert.templateSubtitle || 'This certificate is proudly awarded to', 0, 198, {
        align: 'center',
      });

    // Recipient name
    doc
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(30)
      .text(cert.participantName, 60, 232, { align: 'center', width: w - 120 });

    // Divider under name
    doc
      .moveTo(w / 2 - 160, 274)
      .lineTo(w / 2 + 160, 274)
      .lineWidth(1.5)
      .strokeColor(accent)
      .stroke();

    // Event description
    doc
      .fillColor(slate)
      .font('Helvetica')
      .fontSize(13)
      .text('for active participation and successful completion of', 0, 294, {
        align: 'center',
      });

    doc
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(19)
      .text(cert.eventName, 80, 322, { align: 'center', width: w - 160 });

    doc
      .fillColor(slate)
      .font('Helvetica')
      .fontSize(12)
      .text(`Held on ${cert.eventDate}`, 0, 360, { align: 'center' });

    // Footer signatures and verification metadata
    const footerY = h - 130;
    doc
      .moveTo(90, footerY)
      .lineTo(290, footerY)
      .lineWidth(1)
      .strokeColor('#94A3B8')
      .stroke();
    doc
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(cert.signatoryName || 'Authorized Signatory', 90, footerY + 8, {
        width: 200,
        align: 'center',
      });
    if (cert.signatoryRole) {
      doc
        .fillColor(slate)
        .font('Helvetica')
        .fontSize(10)
        .text(cert.signatoryRole, 90, footerY + 24, {
          width: 200,
          align: 'center',
        });
    }

    // Verification Box on right
    doc
      .roundedRect(w - 310, footerY - 14, 220, 56, 4)
      .lineWidth(1)
      .strokeColor('#CBD5E1')
      .fillAndStroke('#FFFFFF', '#CBD5E1');
    doc
      .fillColor(slate)
      .font('Helvetica')
      .fontSize(9)
      .text('VERIFIED CERTIFICATE ID', w - 298, footerY - 4);
    doc
      .fillColor(navy)
      .font('Courier-Bold')
      .fontSize(12)
      .text(cert.certificateCode, w - 298, footerY + 10);
    doc
      .fillColor(accent)
      .font('Helvetica')
      .fontSize(8)
      .text(`Issued: ${cert.issuedAt.slice(0, 10)}  ·  Verify on RxOrbit`, w - 298, footerY + 26);

    doc.end();
  });
}

export function generateStudyMaterialPdfBuffer(material: {
  title: string;
  program: string;
  semesterOrSpec: string;
  subject: string;
  materialType: string;
  description: string;
  keyPoints: string[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 54 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#0F2442';
    const teal = '#0D9488';
    const slate = '#334155';

    doc.rect(0, 0, doc.page.width, 72).fill(navy);
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('RxOrbit Study Hub', 54, 22);
    doc
      .fillColor('#99F6E4')
      .font('Helvetica')
      .fontSize(10)
      .text(
        `${material.program}  ·  ${material.semesterOrSpec}  ·  ${material.materialType}`,
        54,
        46
      );

    doc.moveDown(3);
    doc.fillColor(teal).font('Helvetica-Bold').fontSize(11).text(material.subject.toUpperCase());
    doc.moveDown(0.3);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(20).text(material.title);
    doc.moveDown(0.7);
    doc
      .fillColor(slate)
      .font('Helvetica')
      .fontSize(11.5)
      .text(material.description, { lineGap: 4 });

    doc.moveDown(1.2);
    doc
      .moveTo(54, doc.y)
      .lineTo(doc.page.width - 54, doc.y)
      .lineWidth(1)
      .strokeColor('#E2E8F0')
      .stroke();
    doc.moveDown(1);

    doc
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('Academic Summary & Key Concepts');
    doc.moveDown(0.5);

    material.keyPoints.forEach((pt, idx) => {
      doc
        .fillColor(navy)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(`${idx + 1}. `, { continued: true });
      doc.fillColor(slate).font('Helvetica').fontSize(11).text(pt, { lineGap: 4 });
      doc.moveDown(0.6);
    });

    doc.moveDown(1.5);
    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(9.5)
      .text(
        'Prepared for the RxOrbit Pharmacy Student Educational Community (Connect · Discover · Advance). For academic reference and university exam preparation.'
      );

    doc.end();
  });
}
