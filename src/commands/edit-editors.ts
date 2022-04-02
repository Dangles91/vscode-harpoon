import * as vscode from "vscode";
import ActiveProjectService from "../service/active-project-service";
import WorkspaceService from "../service/workspace-service";
import { getSlash } from "../util/system";

const HARPOON_FILE = "vscodeHarpoon.harpoon";

function prepareEditFile(workspace: readonly vscode.WorkspaceFolder[]) {
  const wsedit = new vscode.WorkspaceEdit();
  const wsPath = workspace[0].uri.fsPath; // gets the path of the first workspace folder
  const filePath = vscode.Uri.file(`${wsPath}${getSlash()}${HARPOON_FILE}`);
  wsedit.createFile(filePath, { overwrite: true });
  return vscode.workspace.applyEdit(wsedit).then(() => filePath);
}

export default function createEditEditorsCommand(
  activeProjectService: ActiveProjectService,
  workspaceService: WorkspaceService
) {
  function onEditListener() {
    return vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.fileName.includes(HARPOON_FILE)) {
        // This has to be done so the user doens't need to save manually and doesn't get the annoying popup
        e.document.save();
        activeProjectService.activeEditors = e.document
          .getText()
          .split("\n")
          .filter(editor => editor.startsWith(getSlash()))
          .map(editor => ({
            fileName: editor,
          }));
      }
    });
  }

  function onEditorCloseListener(filePath: vscode.Uri, onDispose: () => void) {
    const disposable = vscode.workspace.onDidCloseTextDocument(doc => {
      if (!doc.fileName.includes(HARPOON_FILE)) {
        return;
      }
      vscode.workspace.fs.delete(filePath);
      disposable.dispose();
      onDispose();
      workspaceService.saveWorkspace();
    });
  }

  function insertCurrentEditors(textEditor: vscode.TextEditor) {
    const startPosition = new vscode.Position(0, 0);
    textEditor
      .edit(builder => {
        builder.replace(
          startPosition,
          activeProjectService.activeEditors.map(editor => editor.fileName).join("\n")
        );
      })
      .then(() => {
        textEditor.selection = new vscode.Selection(startPosition, startPosition);
      });
  }

  return () => {
    const workspace = vscode.workspace.workspaceFolders;
    if (!workspace) {
      return;
    }
    prepareEditFile(workspace).then(filePath => {
      const disposable = onEditListener();
      onEditorCloseListener(filePath, disposable.dispose);
      vscode.workspace.openTextDocument(filePath).then(doc => {
        vscode.window.showTextDocument(doc).then(textEditor => {
          insertCurrentEditors(textEditor);
        });
      });
    });
  };
}
