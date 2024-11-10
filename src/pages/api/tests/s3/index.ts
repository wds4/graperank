import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListBucketsCommand, ListObjectsCommand } from '@aws-sdk/client-s3'

const client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})
const params1 = {
  /** input parameters */
};
const command1 = new ListBucketsCommand(params1);
const command2 = new ListObjectsCommand({ Bucket: 'grapevine-nostr-cache-bucket' });

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    console.log(`key: ${process.env.AWS_ACCESS_KEY_ID}`)
    const data1 = await client.send(command1);
    console.log(`data1: ${JSON.stringify(data1)}`)
    
    const data2 = await client.send(command2);
    console.log(`data2: ${JSON.stringify(data2)}`)
    const response:ResponseData = {
      success: true,
      message: `api/tests/s3 data!`,
      data: { data1, data2 },
    }
    res.status(200).json(response)
  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: true,
      message: `api/tests/s3 error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}