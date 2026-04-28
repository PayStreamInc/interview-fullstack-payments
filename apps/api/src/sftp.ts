import Client from "ssh2-sftp-client";
import path from "node:path";
import { env } from "./env.js";

export async function listSftpDirectory() {
  return withSftpClient((client) => client.list(env.sftp.remoteDir));
}

export async function uploadSftpFile(relativePath: string, contents: string | Buffer) {
  const remotePath = resolveRemotePath(relativePath);

  return withSftpClient(async (client) => {
    await client.put(contents, remotePath);
    return remotePath;
  });
}

export async function downloadSftpFile(relativePath: string) {
  const remotePath = resolveRemotePath(relativePath);

  return withSftpClient(async (client) => {
    const contents = await client.get(remotePath);
    return Buffer.isBuffer(contents) ? contents : Buffer.from(String(contents));
  });
}

async function withSftpClient<T>(callback: (client: Client) => Promise<T>) {
  const client = new Client();

  try {
    await client.connect({
      host: env.sftp.host,
      port: env.sftp.port,
      username: env.sftp.username,
      password: env.sftp.password,
    });

    return await callback(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function resolveRemotePath(relativePath: string) {
  const normalizedPath = path.posix.normalize(relativePath).replace(/^\/+/, "");

  if (normalizedPath === ".." || normalizedPath.startsWith("../")) {
    throw new Error("SFTP path must stay within the configured remote directory");
  }

  return path.posix.join(env.sftp.remoteDir, normalizedPath);
}
