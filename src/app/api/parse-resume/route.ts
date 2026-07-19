import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let parser: PDFParse | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("resume");

    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No PDF file provided." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return Response.json(
        { error: "Please upload a PDF file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";

    if (!text) {
      return Response.json(
        { error: "Couldn't extract any text from that PDF." },
        { status: 422 }
      );
    }

    return Response.json({ text, fileName: file.name });
  } catch (err) {
    console.error("Resume parse failed:", err);
    return Response.json(
      { error: "Failed to read that PDF." },
      { status: 500 }
    );
  } finally {
    if (parser) await parser.destroy();
  }
}