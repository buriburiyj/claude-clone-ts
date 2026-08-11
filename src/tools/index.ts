export { readFileTool, writeFileTool, listDirTool } from './fs.js';
export { editFileTool } from './edit.js';
export { bashTool } from './shell.js';

import { readFileTool, writeFileTool, listDirTool } from './fs.js';
import { editFileTool } from './edit.js';
import { bashTool } from './shell.js';

export const tools = [
  readFileTool,
  writeFileTool,
  listDirTool,
  editFileTool,
  bashTool,
] as const;
