import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

async function main() {
  await r2.send(new PutBucketCorsCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ['http://localhost:3000', 'https://*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }))
  console.log('✅ R2 CORS configurat cu succes')
}

main().catch(console.error)
