import type { NextApiRequest, NextApiResponse } from 'next'
// import { S3Client, ListObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3'
/*
const Bucket = process.env.AMPLIFY_BUCKET;
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})
*/
type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: 'api/tests/s3 Hello from Next.js!' })
}