import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { getS3Endpoint, getS3Region, getS3AccessKeyId, getS3SecretAccessKey, getS3ForcePathStyle } from "./env";

/** Server-only S3-compatible client — never import from a Client Component. */
export function getS3Client(): S3Client {
  return new S3Client({
    region: getS3Region(),
    endpoint: getS3Endpoint(),
    forcePathStyle: getS3ForcePathStyle(),
    credentials: {
      accessKeyId: getS3AccessKeyId(),
      secretAccessKey: getS3SecretAccessKey(),
    },
  });
}
