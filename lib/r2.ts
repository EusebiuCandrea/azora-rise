import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'image/jpeg',
  'image/png',
  'image/webp',
]

export async function getPresignedUploadUrl(
  orgId: string,
  folder: 'clips' | 'audio' | 'images',
  filename: string,
  contentType: string
): Promise<string> {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${contentType}`)
  }

  // Sanitizare filename — previne path traversal
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${orgId}/${folder}/${sanitized}`

  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 900 } // 15 min TTL
  )
}

export async function getPresignedUploadUrlForKey(
  key: string,
  contentType: string
): Promise<string> {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${contentType}`)
  }
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 900 }
  )
}

export async function getPresignedDownloadUrl(key: string, forDownload = false): Promise<string> {
  const filename = key.split('/').pop() ?? 'file'
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ...(forDownload && {
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
      }),
    }),
    { expiresIn: 3600 } // 1 oră
  )
}

export async function deleteR2Object(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  }))
}

export function getR2Url(orgId: string, folder: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `r2://${orgId}/${folder}/${sanitized}`
}
