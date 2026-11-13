/**
 * COLE ESTE CÓDIGO EM https://script.google.com/
 * 1. Clique em "Novo Projeto"
 * 2. Apague tudo e cole o código abaixo
 * 3. Clique em "Implantar" -> "Nova implantação"
 * 4. Tipo: "App da Web" | Executar como: "Eu" | Quem pode acessar: "Qualquer pessoa"
 * 5. Copie a URL gerada (terminada em /exec) e cole no botão "Configurar Google Drive" na tela de Fluxos.
 */

const FOLDER_ID = "1XDGKKU52DY_5Kw2mc6kKmjs5FRpfz2SH";
const DB_FILE_NAME = "cymi_fluxos_abastecimento.json";

function getOrCreateDbFile(folder) {
  const files = folder.getFilesByName(DB_FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  }
  return folder.createFile(DB_FILE_NAME, "[]", MimeType.PLAIN_TEXT);
}

function doGet(e) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const dbFile = getOrCreateDbFile(folder);
  const content = dbFile.getBlob().getDataAsString() || "[]";
  return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const body = JSON.parse(e.postData.contents);

    // Upload de PDF Assinado para a pasta do Google Drive
    if (body.action === "upload_pdf") {
      const bytes = Utilities.base64Decode(body.base64);
      const blob = Utilities.newBlob(bytes, "application/pdf", body.fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fileUrl = file.getUrl();

      // Atualiza também o registro no JSON do Drive se enviado
      if (body.fluxos) {
        const dbFile = getOrCreateDbFile(folder);
        dbFile.setContent(JSON.stringify(body.fluxos, null, 2));
      }

      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, fileUrl: fileUrl, fileId: file.getId() })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Salvar / Atualizar lista de solicitações no arquivo JSON dentro da pasta do Drive
    if (body.action === "save_all" && body.fluxos) {
      const dbFile = getOrCreateDbFile(folder);
      dbFile.setContent(JSON.stringify(body.fluxos, null, 2));
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
        ContentService.MimeType.JSON
      );
    }

    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: "Ação desconhecida" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
