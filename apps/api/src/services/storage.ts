import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import type { ObjectStorageSettings } from '../settings.js'

export function createStorageClient (config: ObjectStorageSettings): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    },
    forcePathStyle: true
  })
}

export async function ensureBucket (
  client: S3Client,
  bucket: string
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
  }
}

export async function putObject (
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  }))
}

export async function deleteObject (
  client: S3Client,
  bucket: string,
  key: string
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function getObjectStream (
  client: S3Client,
  bucket: string,
  key: string
) {
  const response = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key
  }))
  if (!response.Body) {
    throw new Error('Empty object body')
  }
  return response
}
