import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'

/*
usage:
https://graperank.tech/api/s3/fetchEventIds

*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

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
    const params = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Delimiter: 'eventsByEventId',
    }
    const command = new ListObjectsCommand(params);
    const data = await client.send(command);

    const response:ResponseData = {
      success: true,
      message: `api/s3/fetchEventIds data:`,
      data: { 
        data
      }
    }
    res.status(200).json(response)
  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/s3/fetchEventIds error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}