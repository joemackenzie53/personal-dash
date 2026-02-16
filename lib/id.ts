import crypto from "crypto";
export function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}
