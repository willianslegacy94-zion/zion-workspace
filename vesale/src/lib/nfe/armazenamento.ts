import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Arquivos de nota fiscal ficam fora de `public/` (RNF-003 / arquitetura-vesale
// § 5 — "armazenados fora do diretório público da aplicação"), num diretório
// próprio na raiz do projeto, referenciado pelo caminho relativo salvo em
// NotaFiscalEntrada.arquivoOriginal.
const DIRETORIO_BASE = path.join(process.cwd(), "storage", "notas-fiscais");

export async function salvarArquivoNota(
  id: string,
  extensao: "xml" | "pdf",
  bytes: Buffer,
): Promise<string> {
  await mkdir(DIRETORIO_BASE, { recursive: true });
  const nomeArquivo = `${id}.${extensao}`;
  await writeFile(path.join(DIRETORIO_BASE, nomeArquivo), bytes);
  return path.join("storage", "notas-fiscais", nomeArquivo);
}
