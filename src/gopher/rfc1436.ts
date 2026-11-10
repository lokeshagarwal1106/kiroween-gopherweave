export type GopherItemType = '0' | '1' | '3' | '7' | '9' | 'i' | 'h';

export interface GopherMenuItem {
  type: GopherItemType;
  display: string;
  selector: string;
  host: string;
  port: number;
}

export function serializeGopherMenu(items: GopherMenuItem[]): string {
  const lines = items.map(
    (item) => `${item.type}${item.display}\t${item.selector}\t${item.host}\t${item.port}`
  );
  return `${lines.join('\r\n')}\r\n.\r\n`;
}

export function parseGopherMenu(rawPayload: string): GopherMenuItem[] {
  const lines = rawPayload.split(/\r?\n/);
  const items: GopherMenuItem[] = [];

  for (const line of lines) {
    if (!line || line === '.') continue;
    const typeChar = line.charAt(0) as GopherItemType;
    const rest = line.slice(1);
    const parts = rest.split('\t');
    items.push({
      type: typeChar,
      display: parts[0] ?? '',
      selector: parts[1] ?? '',
      host: parts[2] ?? '127.0.0.1',
      port: Number.parseInt(parts[3] ?? '7070', 10) || 7070,
    });
  }
  return items;
}
