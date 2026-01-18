import { jsPDF } from "jspdf";

interface CertificateData {
  userName: string;
  courseName: string;
  courseLevel: string;
  quizScore: number;
  passingScore: number;
  completionDate: Date;
  certificateId: string;
}

export const generateCertificatePDF = (data: CertificateData): jsPDF => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Background gradient effect using rectangles
  doc.setFillColor(15, 23, 42); // Dark slate background
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Decorative border
  doc.setDrawColor(220, 38, 38); // Crimson red
  doc.setLineWidth(3);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Inner decorative border
  doc.setDrawColor(180, 83, 9); // Amber
  doc.setLineWidth(1);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

  // Corner decorations
  const cornerSize = 20;
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(2);
  
  // Top left corner
  doc.line(10, 30, 10 + cornerSize, 30);
  doc.line(30, 10, 30, 10 + cornerSize);
  
  // Top right corner
  doc.line(pageWidth - 10, 30, pageWidth - 10 - cornerSize, 30);
  doc.line(pageWidth - 30, 10, pageWidth - 30, 10 + cornerSize);
  
  // Bottom left corner
  doc.line(10, pageHeight - 30, 10 + cornerSize, pageHeight - 30);
  doc.line(30, pageHeight - 10, 30, pageHeight - 10 - cornerSize);
  
  // Bottom right corner
  doc.line(pageWidth - 10, pageHeight - 30, pageWidth - 10 - cornerSize, pageHeight - 30);
  doc.line(pageWidth - 30, pageHeight - 10, pageWidth - 30, pageHeight - 10 - cornerSize);

  // Certificate title
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("CERTIFICATE", pageWidth / 2, 40, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text("OF COMPLETION", pageWidth / 2, 55, { align: "center" });

  // Decorative line
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 60, 62, pageWidth / 2 + 60, 62);

  // "This is to certify that"
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("This is to certify that", pageWidth / 2, 80, { align: "center" });

  // User name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(data.userName, pageWidth / 2, 95, { align: "center" });

  // Underline for name
  const nameWidth = doc.getTextWidth(data.userName);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - nameWidth / 2, 98, pageWidth / 2 + nameWidth / 2, 98);

  // "has successfully completed"
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("has successfully completed the course", pageWidth / 2, 112, { align: "center" });

  // Course name
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(data.courseName, pageWidth / 2, 128, { align: "center" });

  // Course level
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Level: ${data.courseLevel.charAt(0).toUpperCase() + data.courseLevel.slice(1)}`, pageWidth / 2, 138, { align: "center" });

  // Quiz score section
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("with a quiz score of", pageWidth / 2, 152, { align: "center" });

  doc.setTextColor(220, 38, 38);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.quizScore}%`, pageWidth / 2, 165, { align: "center" });

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`(Passing Score: ${data.passingScore}%)`, pageWidth / 2, 173, { align: "center" });

  // Date
  const formattedDate = data.completionDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(`Issued on ${formattedDate}`, pageWidth / 2, 188, { align: "center" });

  // Certificate ID
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text(`Certificate ID: ${data.certificateId}`, pageWidth / 2, pageHeight - 18, { align: "center" });

  // Footer text
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text("This certificate verifies the successful completion of the course and quiz assessment.", pageWidth / 2, pageHeight - 25, { align: "center" });

  return doc;
};

export const downloadCertificatePDF = (data: CertificateData, filename?: string) => {
  const doc = generateCertificatePDF(data);
  const defaultFilename = `certificate-${data.courseName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  doc.save(filename || defaultFilename);
};
