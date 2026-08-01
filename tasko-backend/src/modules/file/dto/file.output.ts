import { FileKind } from '../../../common/constants/file-kind.enum';

/** Response shape for a stored file. Whitelisted by construction. */
export interface FileOutput {
  id: string;
  kind: FileKind;
  mimeType: string;
  size: number;
  originalName: string;
  url: string;
  createdAt: Date;
}
