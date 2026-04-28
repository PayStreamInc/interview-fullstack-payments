import Client from "ssh2-sftp-client";
import { env } from "./env.js";

export async function listSftpDirectory() {
  const client = new Client();

  try {
    await client.connect({
      host: env.sftp.host,
      port: env.sftp.port,
      username: env.sftp.username,
      password: env.sftp.password,
    });

    return await client.list(env.sftp.remoteDir);
  } finally {
    await client.end().catch(() => undefined);
  }
}
