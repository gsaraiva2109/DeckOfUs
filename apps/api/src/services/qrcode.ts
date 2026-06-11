import QRCode from 'qrcode';

export function toDataUrl(joinUrl: string): Promise<string> {
  return QRCode.toDataURL(joinUrl, { margin: 1, width: 320 });
}
