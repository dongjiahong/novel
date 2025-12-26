/**
 * 正确处理 ArrayBuffer 类型
 */
export function decodeContent(content: string | Buffer | ArrayBuffer): string {
  if (content instanceof ArrayBuffer) {
    return new TextDecoder().decode(content);
  } else if (typeof content === 'string') {
    return content;
  } else {
    return content.toString();
  }
}
